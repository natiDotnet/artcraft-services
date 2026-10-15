use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, Debug, Serialize, Deserialize, ToSchema)]
pub struct DeveloperApiKeyInfo {
  pub token: String,
  pub truncated_api_key: String,
  pub name: String,
  pub maybe_description: Option<String>,
  pub total_spend: f64,
  pub owner_user_token: String,
  pub ip_address_creation: String,
  pub ip_address_update: String,
  pub created_at: String,
  pub updated_at: String,
  pub maybe_deleted_at: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, ToSchema)]
pub struct CreatedDeveloperApiKey {
  pub api_key_token: String,
  pub api_key: String,
}

#[derive(Clone, Debug, Deserialize, ToSchema)]
pub struct CreateDeveloperApiKeyRequest {
  pub name: String,
  #[serde(default)]
  pub maybe_description: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateDeveloperApiKeyResponse {
  pub success: bool,
  pub data: Option<CreatedDeveloperApiKey>,
  #[serde(default)]
  pub message: Option<String>,
}

#[derive(Clone, Debug, Deserialize, ToSchema)]
pub struct ListDeveloperApiKeysQueryParams {
  pub limit: Option<u32>,
  pub offset: Option<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize, ToSchema)]
pub struct ListDeveloperApiKeysData {
  pub api_keys: Vec<DeveloperApiKeyInfo>,
  pub user_total_litellm_spend: f64,
  pub remaining_credits: u64,
  pub max_budget: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize, ToSchema)]
pub struct ListDeveloperApiKeysResponse {
  pub success: bool,
  pub data: Option<ListDeveloperApiKeysData>,
  #[serde(default)]
  pub message: Option<String>,
}

#[derive(Clone, Debug, Deserialize, ToSchema)]
pub struct DeleteDeveloperApiKeyRequest {
  pub token: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, ToSchema)]
pub struct DeleteDeveloperApiKeyResponse {
  pub success: bool,
  #[serde(default)]
  pub message: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, ToSchema)]
pub struct SyncDeveloperSpendResponse {
  pub success: bool,
  pub user_total_litellm_spend: f64,
  pub deducted_credits: u64,
  pub remaining_credits: u64,
  pub max_budget: f64,
  #[serde(default)]
  pub message: Option<String>,
}
