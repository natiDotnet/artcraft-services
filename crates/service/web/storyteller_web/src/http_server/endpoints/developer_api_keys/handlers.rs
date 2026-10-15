use std::sync::Arc;
use actix_web::web::{Json, Query};
use actix_web::{web, HttpRequest};
use enums::common::payments_namespace::PaymentsNamespace;
use http_server_common::request::get_request_ip::get_request_ip;
use log::error;
use mysql_queries::queries::wallets::find_primary_wallet_for_owner::find_primary_wallet_for_owner_using_connection;
use rand::Rng;

use crate::http_server::common_responses::common_web_error::CommonWebError;
use crate::http_server::user_lookup::user_session::require_user_session::require_user_session;
use crate::state::server_state::ServerState;

use super::db::{
  delete_developer_key, insert_developer_key, list_developer_keys,
};
use super::types::{
  CreateDeveloperApiKeyRequest, CreateDeveloperApiKeyResponse, CreatedDeveloperApiKey,
  DeleteDeveloperApiKeyRequest, DeleteDeveloperApiKeyResponse, ListDeveloperApiKeysData,
  ListDeveloperApiKeysQueryParams, ListDeveloperApiKeysResponse, SyncDeveloperSpendResponse,
};

const DEV_KEY_PREFIX: &str = "artcraft_dev_";
const CROCKFORD_LOWERCASE_CHARSET: &[u8] = b"0123456789abcdefghjkmnpqrstvwxyz";
const ENTROPY_CHAR_COUNT: usize = 40;

fn generate_dev_secret() -> String {
  let mut rng = rand::rng();
  let mut key = String::with_capacity(DEV_KEY_PREFIX.len() + ENTROPY_CHAR_COUNT);
  key.push_str(DEV_KEY_PREFIX);
  for _ in 0..ENTROPY_CHAR_COUNT {
    let index = rng.random_range(0..CROCKFORD_LOWERCASE_CHARSET.len());
    key.push(CROCKFORD_LOWERCASE_CHARSET[index] as char);
  }
  key
}

fn generate_dev_token() -> String {
  let mut rng = rand::rng();
  let mut token = String::with_capacity(7 + 25);
  token.push_str("devkey_");
  for _ in 0..25 {
    let index = rng.random_range(0..CROCKFORD_LOWERCASE_CHARSET.len());
    token.push(CROCKFORD_LOWERCASE_CHARSET[index] as char);
  }
  token
}

pub async fn create_developer_api_key_handler(
  http_request: HttpRequest,
  request: Json<CreateDeveloperApiKeyRequest>,
  server_state: web::Data<Arc<ServerState>>,
) -> Result<Json<CreateDeveloperApiKeyResponse>, CommonWebError> {
  let mut conn = server_state.mysql_pool.acquire().await.map_err(|err| {
    error!("MySQL acquire failed: {:?}", err);
    CommonWebError::from_error(err)
  })?;

  let user_session = require_user_session(&http_request, &server_state.session_checker, &mut *conn).await?;

  let name = request.name.trim();
  if name.is_empty() {
    return Err(CommonWebError::BadInputWithSimpleMessage("Key name cannot be empty".to_string()));
  }

  let secret_key = generate_dev_secret();
  let token = generate_dev_token();
  let ip = get_request_ip(&http_request);

  insert_developer_key(
    &mut *conn,
    &token,
    &secret_key,
    name,
    request.maybe_description.as_deref(),
    user_session.user_token.as_str(),
    &ip,
  )
  .await
  .map_err(|err| {
    error!("Failed to insert developer key: {:?}", err);
    CommonWebError::from_error(err)
  })?;

  Ok(Json(CreateDeveloperApiKeyResponse {
    success: true,
    data: Some(CreatedDeveloperApiKey {
      api_key_token: token,
      api_key: secret_key,
    }),
    message: None,
  }))
}

pub async fn list_developer_api_keys_handler(
  http_request: HttpRequest,
  query: Query<ListDeveloperApiKeysQueryParams>,
  server_state: web::Data<Arc<ServerState>>,
) -> Result<Json<ListDeveloperApiKeysResponse>, CommonWebError> {
  let mut conn = server_state.mysql_pool.acquire().await.map_err(|err| {
    error!("MySQL acquire failed: {:?}", err);
    CommonWebError::from_error(err)
  })?;

  let user_session = require_user_session(&http_request, &server_state.session_checker, &mut *conn).await?;

  let primary_wallet = find_primary_wallet_for_owner_using_connection(
    &user_session.user_token,
    PaymentsNamespace::Artcraft,
    &mut conn,
  )
  .await
  .ok()
  .flatten();

  let remaining_credits = primary_wallet
    .map(|w| w.banked_credits + w.monthly_credits)
    .unwrap_or(0);

  let limit = query.limit.unwrap_or(50).min(200);
  let offset = query.offset.unwrap_or(0);

  let keys = list_developer_keys(
    &mut *conn,
    user_session.user_token.as_str(),
    limit,
    offset,
  )
  .await
  .map_err(|err| {
    error!("Failed to list developer keys: {:?}", err);
    CommonWebError::from_error(err)
  })?;

  let total_spend: f64 = keys.iter().map(|k| k.total_spend).sum();

  Ok(Json(ListDeveloperApiKeysResponse {
    success: true,
    data: Some(ListDeveloperApiKeysData {
      api_keys: keys,
      user_total_litellm_spend: total_spend,
      remaining_credits,
      max_budget: remaining_credits as f64 + total_spend,
    }),
    message: None,
  }))
}

pub async fn sync_developer_spend_handler(
  http_request: HttpRequest,
  server_state: web::Data<Arc<ServerState>>,
) -> Result<Json<SyncDeveloperSpendResponse>, CommonWebError> {
  let mut conn = server_state.mysql_pool.acquire().await.map_err(|err| {
    error!("MySQL acquire failed: {:?}", err);
    CommonWebError::from_error(err)
  })?;

  let user_session = require_user_session(&http_request, &server_state.session_checker, &mut *conn).await?;

  let primary_wallet = find_primary_wallet_for_owner_using_connection(
    &user_session.user_token,
    PaymentsNamespace::Artcraft,
    &mut conn,
  )
  .await
  .ok()
  .flatten();

  let remaining_credits = primary_wallet
    .map(|w| w.banked_credits + w.monthly_credits)
    .unwrap_or(0);

  let keys = list_developer_keys(
    &mut *conn,
    user_session.user_token.as_str(),
    100,
    0,
  )
  .await
  .unwrap_or_default();

  let total_spend: f64 = keys.iter().map(|k| k.total_spend).sum();

  Ok(Json(SyncDeveloperSpendResponse {
    success: true,
    user_total_litellm_spend: total_spend,
    deducted_credits: 0,
    remaining_credits,
    max_budget: remaining_credits as f64 + total_spend,
    message: Some(format!(
      "Wallet balance: {} credits | Total API Spend: {:.2} ETB",
      remaining_credits, total_spend
    )),
  }))
}

pub async fn delete_developer_api_key_handler(
  http_request: HttpRequest,
  request: Json<DeleteDeveloperApiKeyRequest>,
  server_state: web::Data<Arc<ServerState>>,
) -> Result<Json<DeleteDeveloperApiKeyResponse>, CommonWebError> {
  let mut conn = server_state.mysql_pool.acquire().await.map_err(|err| {
    error!("MySQL acquire failed: {:?}", err);
    CommonWebError::from_error(err)
  })?;

  let user_session = require_user_session(&http_request, &server_state.session_checker, &mut *conn).await?;

  let deleted = delete_developer_key(
    &mut *conn,
    request.token.trim(),
    user_session.user_token.as_str(),
  )
  .await
  .map_err(|err| {
    error!("Failed to delete developer key: {:?}", err);
    CommonWebError::from_error(err)
  })?;

  if !deleted {
    return Err(CommonWebError::BadInputWithSimpleMessage("Key not found or already deleted".to_string()));
  }

  Ok(Json(DeleteDeveloperApiKeyResponse {
    success: true,
    message: None,
  }))
}
