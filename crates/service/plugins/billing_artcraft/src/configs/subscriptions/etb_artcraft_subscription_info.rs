use enums::common::artcraft_subscription_slug::ArtcraftSubscriptionSlug;
use reusable_types::stripe::stripe_recurring_interval::StripeRecurringInterval;
use serde_derive::{Deserialize, Serialize};
use std::fmt;

/// Billing cadence for an ETB (Chapa) prepaid subscription period.
///
/// Chapa cannot auto-recur (no saved payment methods for Telebirr/CBE), so ETB
/// subscriptions are PREPAID PERIODS: each successful payment activates the
/// plan for one period. "Renewal" just means paying again, which extends the
/// same `user_subscriptions` row. This is stored in `user_subscriptions` via
/// the same `maybe_stripe_recurring_interval` VARCHAR the Stripe rail uses.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Ord, PartialOrd, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EtbSubscriptionBillingPeriod {
  Monthly,
  Yearly,
}

impl fmt::Display for EtbSubscriptionBillingPeriod {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "{}", self.to_str())
  }
}

impl EtbSubscriptionBillingPeriod {
  pub fn to_str(&self) -> &'static str {
    match self {
      Self::Monthly => "monthly",
      Self::Yearly => "yearly",
    }
  }

  pub fn from_str(value: &str) -> Result<Self, String> {
    match value {
      "monthly" => Ok(Self::Monthly),
      "yearly" => Ok(Self::Yearly),
      _ => Err(format!("invalid etb_subscription_billing_period: {:?}", value)),
    }
  }

  /// Number of months of plan entitlement one successful payment buys.
  pub fn months_per_period(&self) -> u32 {
    match self {
      Self::Monthly => 1,
      Self::Yearly => 12,
    }
  }

  /// The price (in whole ETB) for one prepaid period.
  pub fn price_etb(&self, info: &EtbArtcraftSubscriptionInfo) -> u64 {
    match self {
      Self::Monthly => info.monthly_price_etb,
      Self::Yearly => info.yearly_price_etb,
    }
  }

  /// Credits granted per successful payment (monthly plan: 1x; yearly: 12x
  /// up-front, since the whole year is paid up front).
  pub fn credits_per_payment(&self, info: &EtbArtcraftSubscriptionInfo) -> u64 {
    (info.monthly_credits_amount as u64) * (self.months_per_period() as u64)
  }

  /// Mirror into the reusable type used for DB storage / summaries.
  pub fn to_recurring_interval(&self) -> StripeRecurringInterval {
    match self {
      Self::Monthly => StripeRecurringInterval::Month,
      Self::Yearly => StripeRecurringInterval::Year,
    }
  }
}

/// ETB (Chapa) pricing + entitlements for one Artcraft subscription plan.
///
/// The entitlements (`monthly_credits_amount`) mirror the Stripe plan of the
/// same slug exactly -- the plans are the same product, just settled over the
/// Ethiopian rail at a different price point.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EtbArtcraftSubscriptionInfo {
  pub slug: ArtcraftSubscriptionSlug,

  /// Price in whole ETB (Birr) for one prepaid month.
  /// TODO(final-etb-pricing): placeholder price -- replace with the real
  /// Chapa/Ethiopian-market price once confirmed.
  pub monthly_price_etb: u64,

  /// Price (in whole ETB) for one prepaid year.
  /// TODO(final-etb-pricing): placeholder price -- replace with the final
  /// Chapa/Ethiopian-market price.
  pub yearly_price_etb: u64,

  /// How many monthly credits this plan grants (identical to the Stripe plan).
  pub monthly_credits_amount: u64,
}

impl EtbArtcraftSubscriptionInfo {
  /// The Chapa checkout amount (in whole ETB) for a prepaid period.
  pub fn checkout_amount_etb(&self, period: EtbSubscriptionBillingPeriod) -> u64 {
    period.price_etb(self)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  mod etb_subscription_billing_period {
    use super::*;
    use crate::configs::subscriptions::etb_artcraft_subscription_info_list::get_etb_artcraft_subscription_info_by_slug;

    #[test]
    fn test_serialization() {
      // NB: serde snake_case -- matches the string the clients send.
      let serialized = serde_json::to_string(&EtbSubscriptionBillingPeriod::Monthly).unwrap();
      assert_eq!(serialized, "\"monthly\"");
      let serialized = serde_json::to_string(&EtbSubscriptionBillingPeriod::Yearly).unwrap();
      assert_eq!(serialized, "\"yearly\"");

      let deserialized : EtbSubscriptionBillingPeriod = serde_json::from_str("\"monthly\"").unwrap();
      assert_eq!(deserialized, EtbSubscriptionBillingPeriod::Monthly);
      let deserialized : EtbSubscriptionBillingPeriod = serde_json::from_str("\"yearly\"").unwrap();
      assert_eq!(deserialized, EtbSubscriptionBillingPeriod::Yearly);
    }

    #[test]
    fn test_to_str() {
      assert_eq!(EtbSubscriptionBillingPeriod::Monthly.to_str(), "monthly");
      assert_eq!(EtbSubscriptionBillingPeriod::Yearly.to_str(), "yearly");
    }

    #[test]
    fn test_from_str() {
      assert_eq!(EtbSubscriptionBillingPeriod::from_str("monthly").unwrap(), EtbSubscriptionBillingPeriod::Monthly);
      assert_eq!(EtbSubscriptionBillingPeriod::from_str("yearly").unwrap(), EtbSubscriptionBillingPeriod::Yearly);
      assert!(EtbSubscriptionBillingPeriod::from_str("weekly").is_err());
    }

    #[test]
    fn test_credits_and_prices() {
      let basic = get_etb_artcraft_subscription_info_by_slug(ArtcraftSubscriptionSlug::ArtcraftBasic);
      let pro = get_etb_artcraft_subscription_info_by_slug(ArtcraftSubscriptionSlug::ArtcraftPro);
      let max = get_etb_artcraft_subscription_info_by_slug(ArtcraftSubscriptionSlug::ArtcraftMax);

      // Entitlements mirror the Stripe plans exactly.
      assert_eq!(basic.monthly_credits_amount, 1000);
      assert_eq!(pro.monthly_credits_amount, 3750);
      assert_eq!(max.monthly_credits_amount, 6600);

      // Yearly is 12x the monthly credits, up-front.
      assert_eq!(EtbSubscriptionBillingPeriod::Monthly.credits_per_payment(&basic), 1000);
      assert_eq!(EtbSubscriptionBillingPeriod::Yearly.credits_per_payment(&basic), 12000);
      assert_eq!(EtbSubscriptionBillingPeriod::Yearly.credits_per_payment(&max), 6600 * 12);

      // Placeholder prices (TODO(final-etb-pricing)).
      assert_eq!(EtbSubscriptionBillingPeriod::Monthly.price_etb(&basic), basic.monthly_price_etb);
      assert_eq!(EtbSubscriptionBillingPeriod::Yearly.price_etb(&pro), pro.yearly_price_etb);
      assert_eq!(max.checkout_amount_etb(EtbSubscriptionBillingPeriod::Yearly), max.yearly_price_etb);
    }

    #[test]
    fn test_to_recurring_interval() {
      assert_eq!(EtbSubscriptionBillingPeriod::Monthly.to_recurring_interval(), StripeRecurringInterval::Month);
      assert_eq!(EtbSubscriptionBillingPeriod::Yearly.to_recurring_interval(), StripeRecurringInterval::Year);
    }

    #[test]
    fn test_display() {
      assert_eq!(format!("{}", EtbSubscriptionBillingPeriod::Monthly), "monthly");
      assert_eq!(format!("{}", EtbSubscriptionBillingPeriod::Yearly), "yearly");
    }
  }
}

