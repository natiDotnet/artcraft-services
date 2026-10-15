use chrono::{DateTime, Utc};
use enums::by_table::wallet_ledger_entries::wallet_ledger_entry_type::WalletLedgerEntryType;
use serde_derive::{Deserialize, Serialize};
use tokens::tokens::wallet_ledger_entries::WalletLedgerEntryToken;
use utoipa::ToSchema;

pub const MODERATOR_GET_WALLET_LEDGER_ENTRY_PATH: &str = "/v1/moderation/wallet_ledger_entry/{wallet_ledger_entry_token}";

#[derive(Deserialize, ToSchema)]
pub struct ModeratorGetWalletLedgerEntryPathInfo {
  pub wallet_ledger_entry_token: WalletLedgerEntryToken,
}

#[derive(Serialize, ToSchema)]
pub struct ModeratorGetWalletLedgerEntryResponse {
  pub success: bool,
  pub maybe_entry: Option<ModeratorGetWalletLedgerEntryDetails>,
}

use rust_decimal::Decimal;

#[derive(Serialize, ToSchema)]
pub struct ModeratorGetWalletLedgerEntryDetails {
  pub token: WalletLedgerEntryToken,
  pub entry_type: WalletLedgerEntryType,
  pub maybe_entity_ref: Option<String>,
  #[schema(value_type = f64)]
  pub credits_delta: Decimal,
  #[schema(value_type = f64)]
  pub banked_credits_before: Decimal,
  #[schema(value_type = f64)]
  pub banked_credits_after: Decimal,
  #[schema(value_type = f64)]
  pub monthly_credits_before: Decimal,
  #[schema(value_type = f64)]
  pub monthly_credits_after: Decimal,
  pub is_refunded: bool,
  pub maybe_linked_refund_ledger_token: Option<WalletLedgerEntryToken>,
  pub created_at: DateTime<Utc>,
}
