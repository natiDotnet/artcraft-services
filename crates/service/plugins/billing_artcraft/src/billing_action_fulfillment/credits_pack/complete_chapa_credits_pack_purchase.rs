/// Fulfills an ETB credits pack purchase after Chapa verifies the payment.
///
/// For Chapa payments we have a server-to-server verification call (no webhook
/// subscription required), so fulfillment always flows through the verify
/// endpoint. The `tx_ref` carry-alls `owner_user_token` and `pack_id`.
use crate::configs::credits_packs::etb_credits_pack_info::EtbCreditsPackInfo;
use chrono::{DateTime, Utc};
use enums::by_table::user_spend_events::payment_event_type::PaymentEventType;
use enums::by_table::user_spend_events::payment_source::PaymentSource;
use enums::common::payments_namespace::PaymentsNamespace;
use log::info;
use mysql_queries::queries::wallets::add_durable_banked_balance_to_wallet::add_durable_banked_balance_to_wallet;
use mysql_queries::queries::wallets::create_new_artcraft_wallet_for_owner_user::create_new_artcraft_wallet_for_owner_user;
use mysql_queries::queries::wallets::find_primary_wallet_token_for_owner::find_primary_wallet_token_for_owner_using_transaction;
use mysql_queries::queries::user_spend_events::insert_user_spend_event::{insert_user_spend_event, InsertUserSpendEventArgs};
use std::marker::PhantomData;
use tokens::tokens::users::UserToken;

pub async fn complete_chapa_credits_pack_purchase(
  owner_user_token: &UserToken,
  pack: &EtbCreditsPackInfo,
  // The Chapa `tx_ref` used as the idempotency/de-dup key on the spend event.
  tx_ref: &str,
  amount_etb_cents: i64,
  payment_occurred_at: DateTime<Utc>,
  transaction: &mut sqlx::Transaction<'_, sqlx::MySql>,
) -> anyhow::Result<()> {

  let maybe_wallet_token = find_primary_wallet_token_for_owner_using_transaction(
    owner_user_token,
    PaymentsNamespace::Artcraft,
    transaction,
  ).await?;

  let wallet_token = match maybe_wallet_token {
    Some(token) => token,
    None => {
      info!("No wallet found for user: {} ; creating a new one...", owner_user_token.as_str());
      create_new_artcraft_wallet_for_owner_user(owner_user_token, transaction).await?
    }
  };

  let credits_purchased = pack.credits_awarded;

  info!("Adding {} credits to wallet {} via Chapa ETB pack purchase",
        credits_purchased, wallet_token.as_str());

  let wallet_update = add_durable_banked_balance_to_wallet(
    &wallet_token,
    credits_purchased,
    Some(tx_ref),
    None,
    transaction,
  ).await?;

  // Record the spend event in the same transaction. Idempotent on
  // (payment_source, source_object_id), so replayed verifications are no-ops.
  insert_user_spend_event(InsertUserSpendEventArgs {
    payments_namespace: PaymentsNamespace::Artcraft,
    maybe_user_token: Some(owner_user_token),
    event_type: PaymentEventType::CreditPackPurchase,
    // USD rail: no USD amount for ETB payments.
    amount_usd_cents: 0,
    maybe_amount_etb_cents: Some(amount_etb_cents),
    maybe_credits_granted: u32::try_from(credits_purchased).ok(),
    maybe_user_subscription_token: None,
    maybe_wallet_ledger_entry_token: Some(&wallet_update.wallet_ledger_entry_token),
    payment_source: PaymentSource::Chapa,
    maybe_source_object_id: Some(tx_ref),
    maybe_stripe_customer_id: None,
    maybe_stripe_invoice_id: None,
    maybe_stripe_payment_intent_id: None,
    maybe_stripe_charge_id: None,
    maybe_stripe_event_id: None,
    // ETB production: we can treat the Chapa secret key env var as the
    // production-signal source. False (sandbox) for now; flip when Chapa
    // live keys are in use.
    is_production: false,
    payment_occurred_at,
    mysql_executor: &mut **transaction,
    phantom: PhantomData,
  }).await?;

  Ok(())
}