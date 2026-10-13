use serde_derive::Serialize;

/// A one-time credits pack priced in Ethiopian Birr (ETB) under the
/// "1 ETB = 1 Credit" pricing model.
///
/// NB: ETB packs are settled over Ethiopian payment rails (Telebirr, CBE
/// Birr, et al) rather than Stripe, so — unlike
/// `StripeArtcraftCreditsPackInfo` — there are no Stripe product/price ids
/// here.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct EtbCreditsPackInfo {
  /// Stable identifier surfaced to clients, e.g. "etb_500"
  pub id: &'static str,

  /// Pack price in ETB
  pub etb_price: u64,

  /// Total credits granted per purchase, *including* bonus credits
  /// (e.g. 560 for the 500 ETB pack: 500 base + 60 bonus)
  pub credits_awarded: u64,

  /// The free-credit portion of `credits_awarded`; zero when the pack
  /// carries no bonus
  pub bonus_credits: u64,

  /// Optional marketing tag rendered on the pack card, e.g. "Popular"
  pub badge: Option<&'static str>,
}
