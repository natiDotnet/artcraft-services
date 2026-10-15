use chrono::{DateTime, Utc};
use enums::common::payments_namespace::PaymentsNamespace;
use serde_derive::{Deserialize, Serialize};
use tokens::tokens::users::UserToken;
use tokens::tokens::wallets::WalletToken;
use utoipa::ToSchema;

pub const LIST_USER_WALLETS_PATH: &str = "/v1/moderation/wallets/user/{user_token}/list";

#[derive(Deserialize, ToSchema)]
pub struct ListUserWalletsPathInfo {
  pub user_token: UserToken,
}

#[derive(Serialize, ToSchema)]
pub struct ListUserWalletsResponse {
  pub success: bool,
  pub wallets: Vec<ListUserWalletsEntry>,
}

use rust_decimal::Decimal;

#[derive(Serialize, ToSchema)]
pub struct ListUserWalletsEntry {
  pub token: WalletToken,
  pub wallet_namespace: PaymentsNamespace,
  #[schema(value_type = f64)]
  pub banked_credits: Decimal,
  #[schema(value_type = f64)]
  pub monthly_credits: Decimal,
  pub version: i32,
  pub created_at: DateTime<Utc>,
  pub updated_at: DateTime<Utc>,
}
