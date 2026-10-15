use chrono::{DateTime, Utc};
use enums::by_table::wallet_ledger_entries::wallet_ledger_entry_type::WalletLedgerEntryType;
use serde_derive::{Deserialize, Serialize};
use tokens::tokens::wallet_ledger_entries::WalletLedgerEntryToken;
use tokens::tokens::wallets::WalletToken;
use utoipa::ToSchema;

pub const LIST_WALLET_LEDGER_ENTRIES_BY_WALLET_PATH: &str = "/v1/moderation/wallet_ledger_entries/wallet/{wallet_token}/list";

#[derive(Deserialize, ToSchema)]
pub struct ListWalletLedgerEntriesByWalletPathInfo {
  pub wallet_token: WalletToken,
}

#[derive(Serialize, ToSchema)]
pub struct ListWalletLedgerEntriesByWalletResponse {
  pub success: bool,
  pub entries: Vec<ListWalletLedgerEntriesByWalletEntry>,
}

use rust_decimal::Decimal;

#[derive(Serialize, ToSchema)]
pub struct ListWalletLedgerEntriesByWalletEntry {
  pub token: WalletLedgerEntryToken,
  pub wallet_token: WalletToken,
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
  pub created_at: DateTime<Utc>,
  pub is_refunded: bool,
  pub maybe_linked_refund_ledger_token: Option<WalletLedgerEntryToken>,
}
