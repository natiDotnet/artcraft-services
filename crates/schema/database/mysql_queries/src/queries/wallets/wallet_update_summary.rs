use enums::common::payments_namespace::PaymentsNamespace;
use rust_decimal::Decimal;
use tokens::tokens::users::UserToken;
use tokens::tokens::wallet_ledger_entries::WalletLedgerEntryToken;
use tokens::tokens::wallets::WalletToken;

pub struct WalletUpdateSummary {
  pub wallet_token: WalletToken,

  pub wallet_ledger_entry_token: WalletLedgerEntryToken,

  pub namespace: PaymentsNamespace,

  pub owner_user_token: UserToken,

  pub banked_credits_now: Decimal,
  pub monthly_credits_now: Decimal,

  pub banked_credits_before: Decimal,
  pub monthly_credits_before: Decimal,
}
