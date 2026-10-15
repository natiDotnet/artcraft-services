/// Records a Chapa-settled subscription period payment into `user_subscriptions`,
/// refills the wallet with `monthly_credits × months_in_period` credits, and
/// writes a `user_spend_event` with the ETB amount.
///
/// Chapa cannot auto-recur (Telebirr/CBE have no saved-payment-methods), so
/// "renewal" = user pays again; we extend the same `user_subscriptions` row.
/// The Chapa `tx_ref` is used as the dedup/idempotency anchor so a replayed
/// verification is a no-op.
use crate::configs::subscriptions::etb_artcraft_subscription_info::{EtbArtcraftSubscriptionInfo, EtbSubscriptionBillingPeriod};
use chrono::{DateTime, NaiveDateTime, Utc};
use enums::common::payments_namespace::PaymentsNamespace;
use enums::by_table::user_spend_events::payment_event_type::PaymentEventType;
use enums::by_table::user_spend_events::payment_source::PaymentSource;
use log::info;
use mysql_queries::queries::users::user_subscriptions::get_user_subscription_by_stripe_subscription_id::get_user_subscription_by_stripe_subscription_id_transactional;
use mysql_queries::queries::users::user_subscriptions::upsert_user_subscription_with_invoice_paid_status_by_stripe_id::UpsertUserSubscriptionWithInvoicePaidStatus;
use mysql_queries::queries::wallets::create_new_artcraft_wallet_for_owner_user::create_new_artcraft_wallet_for_owner_user;
use mysql_queries::queries::wallets::find_primary_wallet_token_for_owner::find_primary_wallet_token_for_owner_using_transaction;
use mysql_queries::queries::wallets::refill_monthly_credits_balance_on_wallet::refill_monthly_credits_balance_on_wallet;
use mysql_queries::queries::user_spend_events::insert_user_spend_event::{insert_user_spend_event, InsertUserSpendEventArgs};
use reusable_types::stripe::stripe_subscription_status::StripeSubscriptionStatus;
use std::marker::PhantomData;
use tokens::tokens::users::UserToken;

/// Chapa-equivalent of `mark_subscription_as_paid` for the Stripe rail.
pub async fn mark_chapa_subscription_period_paid(
  owner_user_token: &UserToken,
  subscription: &EtbArtcraftSubscriptionInfo,
  period: EtbSubscriptionBillingPeriod,
  // The `tx_ref` Chapa returned. Used as the synthetic "stripe subscription id"
  // (primary key) and as the idempotency key on the spend event.
  tx_ref: &str,
  // Amount collected in ETB cents (1 ETB = 100 cents).
  amount_etb_cents: i64,
  payment_occurred_at: DateTime<Utc>,
  transaction: &mut sqlx::Transaction<'_, sqlx::MySql>,
) -> anyhow::Result<()> {
  let months = period.months_per_period();
  let period_start: NaiveDateTime = payment_occurred_at.naive_utc();
  let period_end: NaiveDateTime = payment_occurred_at
      .checked_add_signed(chrono::Duration::days(30 * months as i64))
      .unwrap_or(payment_occurred_at)
      .naive_utc();
  let credits_per_payment = subscription.monthly_credits_amount * (months as u64);

  // Chapa does not have a separate subscription object — we synthesize one using
  // the tx_ref. The `chapa_sub_` prefix keeps it in the same namespace Stripe uses,
  // making it easy to identify in DB queries and logs.
  let synthetic_subscription_id = format!("chapa_sub_{}", tx_ref);

  // Same semantics as the Stripe rail: the first settled payment for this
  // subscription row is `subscription_initial`; any subsequent period payment
  // is `subscription_renewal`. Must be checked BEFORE the upsert below.
  let maybe_existing_subscription = get_user_subscription_by_stripe_subscription_id_transactional(
    &synthetic_subscription_id,
    transaction,
  ).await?;

  let event_type = match &maybe_existing_subscription {
    Some(_) => PaymentEventType::SubscriptionRenewal,
    None => PaymentEventType::SubscriptionInitial,
  };

  let upsert = UpsertUserSubscriptionWithInvoicePaidStatus {
    stripe_subscription_id: &synthetic_subscription_id,

    user_token: owner_user_token.as_str(),
    invoice_is_paid: true,

    subscription_namespace: PaymentsNamespace::Artcraft,
    subscription_product_slug: subscription.slug.to_str(),

    maybe_stripe_customer_id: None,
    maybe_stripe_product_id: None,
    maybe_stripe_price_id: None,

    maybe_stripe_recurring_interval: Some(period.to_recurring_interval()),
    maybe_stripe_subscription_status: Some(StripeSubscriptionStatus::Active),
    maybe_stripe_is_production: Some(false),

    maybe_stripe_billing_cycle_anchor: Some(period_start),

    subscription_start_at: period_start,
    current_billing_period_start_at: period_start,
    current_billing_period_end_at: period_end,
    subscription_expires_at: period_end,

    maybe_cancel_at: None,
    maybe_canceled_at: None,
  };

  upsert.upsert_with_transaction(transaction).await?;

  // --- Wallet refill ---
  let maybe_wallet_token = find_primary_wallet_token_for_owner_using_transaction(
    owner_user_token,
    PaymentsNamespace::Artcraft,
    transaction,
  ).await?;

  let wallet_token = match maybe_wallet_token {
    Some(token) => token,
    None => {
      info!("No wallet found for user: {}; creating a new one...", owner_user_token.as_str());
      create_new_artcraft_wallet_for_owner_user(owner_user_token, transaction).await?
    }
  };

  info!("Adding {} credits ({:?} × {} months) to wallet {} via Chapa",
        credits_per_payment, subscription.slug, months, wallet_token.as_str());

  let wallet_update = refill_monthly_credits_balance_on_wallet(
    &wallet_token,
    rust_decimal::Decimal::from(credits_per_payment),
    Some(tx_ref),
    transaction,
  ).await?;

  // --- Spend event ---
  insert_user_spend_event(InsertUserSpendEventArgs {
    payments_namespace: PaymentsNamespace::Artcraft,
    maybe_user_token: Some(owner_user_token),
    event_type,
    // USD rail: no USD amount for ETB payments.
    amount_usd_cents: 0,
    maybe_amount_etb_cents: Some(amount_etb_cents),
    // NULL rather than a clamped/garbage value if it doesn't fit u32.
    maybe_credits_granted: u32::try_from(credits_per_payment).ok(),
    maybe_user_subscription_token: None,
    maybe_wallet_ledger_entry_token: Some(&wallet_update.wallet_ledger_entry_token),
    payment_source: PaymentSource::Chapa,
    maybe_source_object_id: Some(tx_ref),
    maybe_stripe_customer_id: None,
    maybe_stripe_invoice_id: None,
    maybe_stripe_payment_intent_id: None,
    maybe_stripe_charge_id: None,
    maybe_stripe_event_id: None,
    is_production: false,
    payment_occurred_at,
    mysql_executor: &mut **transaction,
    phantom: PhantomData,
  }).await?;

  Ok(())
}