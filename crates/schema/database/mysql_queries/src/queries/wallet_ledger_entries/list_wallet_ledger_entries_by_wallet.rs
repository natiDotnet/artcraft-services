use anyhow::anyhow;
use log::warn;
use sqlx::MySqlPool;

use chrono::{DateTime, Utc};
use enums::by_table::wallet_ledger_entries::wallet_ledger_entry_type::WalletLedgerEntryType;
use errors::AnyhowResult;
use tokens::tokens::wallet_ledger_entries::WalletLedgerEntryToken;
use tokens::tokens::wallets::WalletToken;

use rust_decimal::Decimal;

// TODO(bt): This will need to be paginated. Sort direction would be nice, too.

pub struct WalletLedgerEntryForModerationResult {
  pub token: WalletLedgerEntryToken,
  pub wallet_token: WalletToken,
  pub entry_type: WalletLedgerEntryType,
  pub maybe_entity_ref: Option<String>,
  pub credits_delta: Decimal,
  pub banked_credits_before: Decimal,
  pub banked_credits_after: Decimal,
  pub monthly_credits_before: Decimal,
  pub monthly_credits_after: Decimal,
  pub created_at: DateTime<Utc>,
  pub is_refunded: bool,
  pub maybe_linked_refund_ledger_token: Option<WalletLedgerEntryToken>,
}

pub async fn list_wallet_ledger_entries_by_wallet(
  wallet_token: &WalletToken,
  mysql_pool: &MySqlPool,
) -> AnyhowResult<Vec<WalletLedgerEntryForModerationResult>> {
  let results = sqlx::query_as!(
    WalletLedgerEntryForModerationResult,
    r#"
SELECT
    token as `token: tokens::tokens::wallet_ledger_entries::WalletLedgerEntryToken`,
    wallet_token as `wallet_token: tokens::tokens::wallets::WalletToken`,
    entry_type as `entry_type: enums::by_table::wallet_ledger_entries::wallet_ledger_entry_type::WalletLedgerEntryType`,
    maybe_entity_ref,
    credits_delta as `credits_delta: Decimal`,
    banked_credits_before as `banked_credits_before: Decimal`,
    banked_credits_after as `banked_credits_after: Decimal`,
    monthly_credits_before as `monthly_credits_before: Decimal`,
    monthly_credits_after as `monthly_credits_after: Decimal`,
    created_at as `created_at: DateTime<Utc>`,
    is_refunded as `is_refunded: bool`,
    maybe_linked_refund_ledger_token as `maybe_linked_refund_ledger_token: tokens::tokens::wallet_ledger_entries::WalletLedgerEntryToken`
FROM wallet_ledger_entries
WHERE wallet_token = ?
ORDER BY id DESC
    "#,
    wallet_token,
  )
    .fetch_all(mysql_pool)
    .await;

  match results {
    Ok(records) => Ok(records),
    Err(err) => {
      warn!("list_wallet_ledger_entries_by_wallet query error: {:?}", err);
      Err(anyhow!("query error"))
    }
  }
}
