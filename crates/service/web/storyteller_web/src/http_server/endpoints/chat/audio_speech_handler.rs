use std::sync::Arc;
use actix_web::{web, HttpRequest, HttpResponse};
use futures::StreamExt;
use log::{error, info};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::http_server::common_responses::common_web_error::CommonWebError;
use crate::http_server::endpoints::chat::chat_pricing::get_model_pricing;
use crate::http_server::endpoints::developer_api_keys::db::get_user_and_token_by_developer_key;
use crate::http_server::user_lookup::api_or_web_session::require_any_session_or_key::require_any_session_or_key;
use crate::http_server::web_utils::get_authorization_header_api_key::get_authorization_header_api_key;
use crate::state::server_state::ServerState;
use openrouter_client::OpenRouterClient;
use tokens::tokens::users::UserToken;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AudioSpeechPayload {
  #[serde(default)]
  pub model: Option<String>,
  pub input: String,
  #[serde(default)]
  pub voice: Option<String>,
  #[serde(default)]
  pub response_format: Option<String>,
  #[serde(default)]
  pub speed: Option<f32>,
}

pub async fn audio_speech_handler(
  http_request: HttpRequest,
  payload: web::Json<AudioSpeechPayload>,
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

  // 1. Authenticate caller (developer API key, MCP, or session)
  let maybe_auth_key = get_authorization_header_api_key(&http_request);
  let (_user_token, _maybe_dev_key_token) = if let Some(ref auth_key) = maybe_auth_key {
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
    .unwrap_or_else(|| "fish-audio/s2.1-pro-free:free".to_string());

  // 3. Pre-flight check: ensure user has active credits unless model is free
  let is_free_model = model.ends_with(":free") || {
    let pricing = get_model_pricing(&model);
    pricing.input_per_million == 0.0 && pricing.output_per_million == 0.0
  };

  if !is_free_model {
    use enums::common::payments_namespace::PaymentsNamespace;
    use mysql_queries::queries::wallets::find_primary_wallet_for_owner::find_primary_wallet_for_owner_using_connection;
    use rust_decimal::Decimal;

    let primary_wallet = find_primary_wallet_for_owner_using_connection(
      &_user_token,
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

  let client = OpenRouterClient::new(&openrouter_config.api_key)
    .with_base_url(&base_url)
    .with_site_info("https://artcraft.ai", "ArtCraft Studio");

  // 1. Response format (support mp3, pcm, cmp aliased to pcm, wav, opus, aac, flac)
  let normalized_format = match payload.response_format.as_deref() {
    Some("cmp") => "pcm",
    Some(fmt) if !fmt.trim().is_empty() => fmt.trim(),
    _ => "mp3",
  };

  // 2. Voice (use provided voice or default reference voice)
  let voice = match payload.voice.as_deref().map(|s| s.trim()) {
    Some(v) if v.eq_ignore_ascii_case("hannah") => "9a9cf47702da476aa4629e2506d4a857".to_string(),
    Some(v) if v.eq_ignore_ascii_case("adrian") => "bf322df2096a46f18c579d0baa36f41d".to_string(),
    Some(v) if v.eq_ignore_ascii_case("sarah") => "933563129e564b19a115bedd57b7406a".to_string(),
    Some(v) if v.eq_ignore_ascii_case("ethan") => "536d3a5e000945adb7038665781a4aca".to_string(),
    Some(v) if v.eq_ignore_ascii_case("laura") => "e3cd384158934cc9a01029cd7d278634".to_string(),
    Some(v) if v.eq_ignore_ascii_case("jordan") => "79d0bd3e4e5444b18f7b6d89b5927bf1".to_string(),
    Some(v) if v.eq_ignore_ascii_case("selene") => "b347db033a6549378b48d00acb0d06cd".to_string(),
    Some(v) if !v.is_empty() => v.to_string(),
    _ => "b347db033a6549378b48d00acb0d06cd".to_string(),
  };

  // Build the request body for OpenRouter
  let mut request_body = serde_json::json!({
    "model": model,
    "input": payload.input,
    "voice": voice,
    "response_format": normalized_format,
  });

  if let Some(speed) = payload.speed {
    request_body["speed"] = serde_json::json!(speed);
  }

  info!("Forwarding speech request to OpenRouter with model: {}, format: {}", model, normalized_format);

  let (stream, content_type) = client.stream_speech(&request_body).await.map_err(|err| {
    error!("OpenRouter speech streaming error: {:?}", err);
    CommonWebError::BadInputWithSimpleMessage(format!("Speech provider error: {}", err))
  })?;

  let byte_stream = stream.map(|res| match res {
    Ok(bytes) => Ok::<web::Bytes, actix_web::Error>(web::Bytes::from(bytes)),
    Err(err) => {
      error!("Speech chunk error: {:?}", err);
      Err(actix_web::error::ErrorInternalServerError(err))
    }
  });

  let final_content_type = if !content_type.is_empty() && content_type != "application/octet-stream" {
    content_type
  } else {
    match normalized_format {
      "pcm" => "audio/pcm".to_string(),
      "wav" => "audio/wav".to_string(),
      "opus" => "audio/opus".to_string(),
      "aac" => "audio/aac".to_string(),
      "flac" => "audio/flac".to_string(),
      _ => "audio/mpeg".to_string(),
    }
  };

  Ok(
    HttpResponse::Ok()
      .content_type(final_content_type)
      .streaming(byte_stream),
  )
}
