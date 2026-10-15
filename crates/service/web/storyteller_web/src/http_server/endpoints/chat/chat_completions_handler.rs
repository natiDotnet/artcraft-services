use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use actix_web::{web, HttpRequest, HttpResponse};
use enums::common::payments_namespace::PaymentsNamespace;
use futures::StreamExt;
use log::{error, info, warn};
use mysql_queries::queries::wallets::find_primary_wallet_for_owner::find_primary_wallet_for_owner_using_connection;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;

use crate::billing::wallets::attempt_wallet_deduction::{
  attempt_wallet_deduction_decimal_else_common_web_error,
  attempt_wallet_deduction_else_common_web_error,
};
use crate::http_server::common_responses::common_web_error::CommonWebError;
use crate::http_server::endpoints::chat::chat_pricing::{
  calculate_token_cost_credits, get_model_pricing,
};
use crate::http_server::endpoints::developer_api_keys::db::{
  get_user_and_token_by_developer_key, increment_key_spend,
};
use crate::http_server::user_lookup::api_or_web_session::require_any_session_or_key::require_any_session_or_key;
use crate::http_server::web_utils::get_authorization_header_api_key::get_authorization_header_api_key;
use crate::state::server_state::ServerState;
use openrouter_client::{
  ChatCompletionRequest, ChatMessage, OpenRouterClient, StreamOptions,
};
use tokens::tokens::users::UserToken;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ChatMessagePayload {
  pub role: String,
  pub content: String,
  #[serde(default)]
  pub name: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ChatCompletionsPayload {
  #[serde(default)]
  pub model: Option<String>,
  pub messages: Vec<ChatMessagePayload>,
  #[serde(default)]
  pub temperature: Option<f32>,
  #[serde(default)]
  pub stream: Option<bool>,
}

/// Helper to parse SSE stream bytes and extract prompt/completion token usage if present.
fn extract_usage_from_sse_bytes(bytes: &[u8]) -> Option<(u64, u64)> {
  let text = std::str::from_utf8(bytes).ok()?;
  if !text.contains("\"usage\"") {
    return None;
  }

  for line in text.lines() {
    let line = line.trim();
    if let Some(data) = line.strip_prefix("data:") {
      let data = data.trim();
      if data == "[DONE]" || data.is_empty() {
        continue;
      }
      if let Ok(val) = serde_json::from_str::<serde_json::Value>(data) {
        if let Some(usage) = val.get("usage") {
          let prompt = usage.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
          let completion = usage.get("completion_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
          if prompt + completion > 0 {
            return Some((prompt, completion));
          }
        }
      }
    }
  }

  None
}

pub async fn chat_completions_handler(
  http_request: HttpRequest,
  payload: web::Json<ChatCompletionsPayload>,
  server_state: web::Data<Arc<ServerState>>,
) -> Result<HttpResponse, CommonWebError> {
  let mut mysql_connection = server_state
    .mysql_pool
    .acquire()
    .await
    .map_err(|err| {
      error!("Error acquiring MySQL connection: {:?}", err);
      CommonWebError::from_error(err)
    })?;

  // 1. Authenticate caller: checks Developer API keys (Authorization: Bearer artcraft_dev_...),
  //    Platform API keys, MCP sessions, or web browser session cookies.
  let maybe_auth_key = get_authorization_header_api_key(&http_request);
  let (user_token, maybe_dev_key_token) = if let Some(ref auth_key) = maybe_auth_key {
    if let Ok(Some((dev_user_token_str, dev_key_token))) =
      get_user_and_token_by_developer_key(&mut *mysql_connection, auth_key.as_str_be_careful())
        .await
    {
      (UserToken(dev_user_token_str), Some(dev_key_token))
    } else {
      let session = require_any_session_or_key(
        &http_request,
        &server_state.session_checker,
        &server_state.avt_cookie_manager,
        &mut *mysql_connection,
      )
      .await?;
      (session.user_token, None)
    }
  } else {
    let session = require_any_session_or_key(
      &http_request,
      &server_state.session_checker,
      &server_state.avt_cookie_manager,
      &mut *mysql_connection,
    )
    .await?;
    (session.user_token, None)
  };

  // 2. OpenRouter configuration check
  let openrouter_config = &server_state.inference_providers.openrouter;
  if openrouter_config.api_key.trim().is_empty() || openrouter_config.api_key == "unset" {
    return Err(CommonWebError::BadInputWithSimpleMessage(
      "OpenRouter API key is not configured on the server. Please set OPENROUTER_API_KEY in .env"
        .to_string(),
    ));
  }

  let model = payload
    .model
    .clone()
    .unwrap_or_else(|| openrouter_config.default_model.clone());

  // 3. Pre-flight check: ensure user has active credits in their primary wallet,
  //    unless the requested model is free.
  let is_free_model = {
    let pricing = get_model_pricing(&model);
    pricing.input_per_million == 0.0 && pricing.output_per_million == 0.0
  };

  if !is_free_model {
    let primary_wallet = find_primary_wallet_for_owner_using_connection(
      &user_token,
      PaymentsNamespace::Artcraft,
      &mut mysql_connection,
    )
    .await
    .map_err(|err| {
      error!("Error querying primary wallet: {:?}", err);
      CommonWebError::from_error(err)
    })?;

    let available_balance = primary_wallet
      .map(|w| w.banked_credits + w.monthly_credits)
      .unwrap_or(Decimal::ZERO);

    if available_balance <= Decimal::ZERO {
      return Err(CommonWebError::PaymentRequired);
    }
  }

  let base_url = if openrouter_config.base_url.trim().is_empty() {
    "https://openrouter.ai/api/v1".to_string()
  } else {
    openrouter_config.base_url.clone()
  };

  let client = OpenRouterClient::new(&openrouter_config.api_key).with_base_url(&base_url);

  // 4. Map messages to standard format
  let mut messages: Vec<ChatMessage> = payload
    .messages
    .iter()
    .map(|m| ChatMessage {
      role: m.role.clone(),
      content: m.content.clone(),
      name: m.name.clone(),
      tool_calls: None,
      tool_call_id: None,
    })
    .collect();

  // Inject system instructions if not already present
  if !messages.iter().any(|m| m.role == "system") {
    messages.insert(
      0,
      ChatMessage::system(
        "You are ArtCraft AI, an advanced conversational intelligence. \
         You assist users with dialogue, brainstorming, storytelling, technical explanations, \
         creative ideation, and reasoning.",
      ),
    );
  }

  let request = ChatCompletionRequest {
    model: model.clone(),
    messages,
    stream: true,
    stream_options: Some(StreamOptions { include_usage: true }),
    temperature: payload.temperature,
    max_tokens: None,
    tools: None,
    user: Some(user_token.to_string()),
  };

  // 5. Connect and stream from OpenRouter
  let stream = client.stream_chat(request).await.map_err(|err| {
    error!("OpenRouter streaming error: {:?}", err);
    CommonWebError::BadInputWithSimpleMessage(format!("Inference provider error: {}", err))
  })?;

  // 6. Real-time stream with Token-Based Billing:
  //    As chunks pass through, intercept the final chunk containing usage metrics,
  //    calculate the exact credit cost based on the model's token pricing, and
  //    deduct atomically from the user's ArtCraft wallet.
  let pool = server_state.mysql_pool.clone();
  let bill_user_token = user_token.clone();
  let bill_dev_key_token = maybe_dev_key_token.clone();
  let bill_model = model.clone();
  let deduction_performed = Arc::new(AtomicBool::new(false));

  let sse_stream = stream.map(move |chunk_res| match chunk_res {
    Ok(chunk) => {
      // Check for token usage in chunk
      if !deduction_performed.load(Ordering::SeqCst) {
        if let Some((prompt_tokens, completion_tokens)) = extract_usage_from_sse_bytes(&chunk) {
          deduction_performed.store(true, Ordering::SeqCst);
          let cost_credits =
            calculate_token_cost_credits(&bill_model, prompt_tokens, completion_tokens);

          if cost_credits <= Decimal::ZERO {
            info!(
              "Model '{}' is free: 0 credits charged for user '{}' (prompt: {}, completion: {})",
              bill_model,
              bill_user_token.as_str(),
              prompt_tokens,
              completion_tokens
            );
          } else {
            let pool_inner = pool.clone();
            let u_token = bill_user_token.clone();
            let dev_key_tok = bill_dev_key_token.clone();
            let model_id = bill_model.clone();

            actix_web::rt::spawn(async move {
              match pool_inner.acquire().await {
                Ok(mut conn) => {
                  match attempt_wallet_deduction_decimal_else_common_web_error(
                    &u_token,
                    Some("openrouter_chat_token_spend"),
                    cost_credits,
                    &mut conn,
                  )
                  .await
                  {
                    Ok(_) => {
                      info!(
                        "Deducted {} credits from user '{}' on model '{}' (prompt: {}, completion: {})",
                        cost_credits,
                        u_token.as_str(),
                        model_id,
                        prompt_tokens,
                        completion_tokens
                      );
                      if let Some(ref dev_tok) = dev_key_tok {
                        let cost_f64 = cost_credits.to_f64().unwrap_or(0.0);
                        let _ = increment_key_spend(&mut conn, dev_tok, cost_f64).await;
                      }
                    }
                    Err(e) => {
                      warn!(
                        "Could not deduct {} credits for user '{}': {:?}",
                        cost_credits,
                        u_token.as_str(),
                        e
                      );
                    }
                  }
                }
                Err(err) => {
                  error!("Failed to acquire connection for chat billing: {:?}", err);
                }
              }
            });
          }
        }
      }

      Ok::<web::Bytes, actix_web::Error>(web::Bytes::from(chunk))
    }
    Err(e) => {
      error!("Stream chunk error: {:?}", e);
      Ok::<web::Bytes, actix_web::Error>(web::Bytes::from(format!(
        "data: {{\"error\": \"{}\"}}\n\n",
        e
      )))
    }
  });

  Ok(
    HttpResponse::Ok()
      .content_type("text/event-stream")
      .streaming(sse_stream),
  )
}
