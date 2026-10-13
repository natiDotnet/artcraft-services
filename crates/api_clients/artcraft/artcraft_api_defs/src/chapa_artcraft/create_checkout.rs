use enums::common::artcraft_subscription_slug::ArtcraftSubscriptionSlug;
use serde_derive::{Deserialize, Serialize};
use utoipa::ToSchema;

pub const CREATE_CHECKOUT_URL_PATH: &str = "/v1/chapa_artcraft/checkout";

/// Create a Chapa checkout for either an ETB credits pack or an ETB
/// subscription period. Exactly one of `credits_pack_id` / `plan` must be
/// supplied.
#[derive(Serialize, Deserialize, ToSchema)]
pub struct ChapaArtcraftCreateCheckoutRequest {
  /// ETB credits pack id, e.g. "etb_500". Mutually exclusive with `plan`.
  pub credits_pack_id: Option<String>,

  /// The (non-Chapa) internal identifier for the subscription plan.
  /// Mutually exclusive with `credits_pack_id`.
  pub plan: Option<ArtcraftSubscriptionSlug>,

  /// Billing period for the plan. Required when `plan` is supplied.
  pub period: Option<ChapaPlanBillingPeriod>,
}

#[derive(Serialize, Deserialize, ToSchema, Debug, Copy, Clone, PartialEq, Eq)]
pub enum ChapaPlanBillingPeriod {
  #[serde(rename = "monthly")]
  Monthly,

  #[serde(rename = "yearly")]
  Yearly,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct ChapaArtcraftCreateCheckoutResponse {
  pub success: bool,
  /// The Chapa-hosted payment page to redirect the user's browser to.
  pub chapa_checkout_url: String,
  /// The merchant transaction reference generated for this payment. Echoed
  /// back to us on redirect (`?tx_ref=...`) and used for verification.
  pub tx_ref: String,
}
