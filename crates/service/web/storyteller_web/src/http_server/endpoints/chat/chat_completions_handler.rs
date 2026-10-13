use std::sync::Arc;
use actix_web::{web, HttpRequest, HttpResponse};
use futures::StreamExt;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::billing::wallets::attempt_wallet_deduction::attempt_wallet_deduction_else_common_web_error;
use crate::http_server::common_responses::common_web_error::CommonWebError;
use crate::state::server_state::ServerState;
use openrouter_client::{
  get_studio_tools, ChatCompletionRequest, ChatMessage, OpenRouterClient,
};

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ChatCompletionsPayload {
  #[serde(default)]
  pub model: Option<String>,
  pub messages: Vec<ChatMessage>,
  #[serde(default)]
  pub temperature: Option<f32>,
  #[serde(default)]
  pub stream: Option<bool>,
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

  // 1. Authenticate user
  let maybe_user_session = server_state
    .session_checker
    .maybe_get_user_session_from_connection(&http_request, &mut mysql_connection)
    .await
    .map_err(|e| {
      warn!("Session check failed for chat: {:?}", e);
      CommonWebError::from_error(e)
    })?;

  let user_session = match maybe_user_session {
    Some(s) => s,
    None => return Err(CommonWebError::NotAuthorized),
  };

  // 2. Validate OpenRouter configuration
  let openrouter_config = &server_state.inference_providers.openrouter;
  if openrouter_config.api_key.trim().is_empty() || openrouter_config.api_key == "unset" {
    return Err(CommonWebError::BadInputWithSimpleMessage(
      "OpenRouter API key is not configured on the server. Please set OPENROUTER_API_KEY in .env".to_string(),
    ));
  }

  // 3. Credit deduction (1 ETB = 1 Credit per turn)
  attempt_wallet_deduction_else_common_web_error(
    &user_session.user_token,
    Some("openrouter_chat"),
    1,
    &mut mysql_connection,
  )
  .await?;

  info!(
    "Deducted 1 credit for chat turn from user: {}",
    user_session.user_token.as_str()
  );

  // 4. Prepare OpenRouter client & request
  let model = payload
    .model
    .clone()
    .unwrap_or_else(|| openrouter_config.default_model.clone());

  let client = OpenRouterClient::new(&openrouter_config.api_key)
    .with_base_url(&openrouter_config.base_url)
    .with_site_info(&openrouter_config.site_url, &openrouter_config.app_name);

  // Inject system instructions if not already present
  let mut messages = payload.messages.clone();
  if !messages.iter().any(|m| m.role == "system") {
    messages.insert(
      0,
      ChatMessage::system(
        "You are ArtCraft Studio Assistant, a creative partner for artists, designers, and storytellers. \
         You help generate ideas, refine prompts, and create visuals. When the user asks you to create, \
         generate, or show an image or video, use the generate_image or generate_video function.",
      ),
    );
  }

  let request = ChatCompletionRequest {
    model,
    messages,
    stream: true,
    temperature: payload.temperature,
    max_tokens: None,
    tools: Some(get_studio_tools()),
  };

  // 5. Connect and stream from OpenRouter
  let stream = client
    .stream_chat(request)
    .await
    .map_err(|e| {
      error!("Failed to connect to OpenRouter: {:?}", e);
      CommonWebError::BadInputWithSimpleMessage(format!("OpenRouter error: {}", e))
    })?;

  let mapped_stream = stream.map(|item| {
    item.map_err(|e| {
      error!("Error during OpenRouter streaming: {:?}", e);
      actix_web::error::ErrorInternalServerError(e)
    })
  });

  Ok(
    HttpResponse::Ok()
      .content_type("text/event-stream")
      .insert_header(("Cache-Control", "no-cache"))
      .insert_header(("Connection", "keep-alive"))
      .streaming(mapped_stream),
  )
}
