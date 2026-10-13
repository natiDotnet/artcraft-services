use crate::configs::subscriptions::etb_artcraft_subscription_info::EtbArtcraftSubscriptionInfo;
use enums::common::artcraft_subscription_slug::ArtcraftSubscriptionSlug;

// NB: Unlike `stripe_artcraft_subscription_info_list.rs`, there is no
// SANDBOX/PRODUCTION split here -- ETB prices and entitlements are the same in
// both environments (Chapa has its own sandbox keys handled at the API layer).

/// TODO(final-etb-pricing): All ETB prices below are PLACEHOLDERS pending the
/// final Ethiopian-market pricing decision. They are anchored at roughly
/// 1 USD ~ 155 ETB with round-number marketing prices, and yearly priced at
/// 10x the monthly price (i.e. ~2 months free). Entitlements
/// (`monthly_credits_amount`) intentionally mirror the Stripe plans exactly.
pub const ETB_ARTCRAFT_SUBSCRIPTION_INFO_LIST : [EtbArtcraftSubscriptionInfo; 3] = [
  EtbArtcraftSubscriptionInfo {
    slug: ArtcraftSubscriptionSlug::ArtcraftBasic,
    // TODO(final-etb-pricing): placeholder (was $10/mo on Stripe).
    monthly_price_etb: 1_500,
    // TODO(final-etb-pricing): placeholder (~2 months free).
    yearly_price_etb: 15_000,
    monthly_credits_amount: 1000, // parity with the $10/mo Stripe plan
  },
  EtbArtcraftSubscriptionInfo {
    slug: ArtcraftSubscriptionSlug::ArtcraftPro,
    // TODO(final-etb-pricing): placeholder (was $35/mo on Stripe).
    monthly_price_etb: 5_000,
    // TODO(final-etb-pricing): placeholder (~2 months free).
    yearly_price_etb: 50_000,
    monthly_credits_amount: 3750, // parity with the $35/mo Stripe plan
  },
  EtbArtcraftSubscriptionInfo {
    slug: ArtcraftSubscriptionSlug::ArtcraftMax,
    // TODO(final-etb-pricing): placeholder (was $60/mo on Stripe).
    monthly_price_etb: 8_500,
    // TODO(final-etb-pricing): placeholder (~2 months free).
    yearly_price_etb: 85_000,
    monthly_credits_amount: 6600, // parity with the $60/mo Stripe plan
  },
];

/// Look up the ETB (Chapa) subscription info for a plan slug.
pub fn get_etb_artcraft_subscription_info_by_slug(slug: ArtcraftSubscriptionSlug) -> &'static EtbArtcraftSubscriptionInfo {
  for info in ETB_ARTCRAFT_SUBSCRIPTION_INFO_LIST.iter() {
    if info.slug == slug {
      return info;
    }
  }
  unreachable!("No EtbArtcraftSubscriptionInfo for slug {:?}", slug)
}
