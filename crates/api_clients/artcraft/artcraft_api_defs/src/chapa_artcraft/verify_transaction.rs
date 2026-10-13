use serde_derive::{Deserialize, Serialize};
use utoipa::ToSchema;

pub const VERIFY_TRANSACTION_URL_PATH: &str = "/v1/chapa_artcraft/verify_transaction";

/// Ask the backend to verify a Chapa payment (server-to-server) and fulfill
/// it if the money actually settled. The frontend calls this after Chapa
/// redirects the user back to the site. Safe to call repeatedly -- fulfillment
/// is idempotent on the `tx_ref`.
#[derive(Serialize, Deserialize, ToSchema)]
pub struct ChapaArtcraftVerifyTransactionRequest {
  /// The Chapa transaction reference (our `artcraft-sub-...` /
  /// `artcraft-pack-...` string). Usually read off the redirect query
  /// string.
  pub tx_ref: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct ChapaArtcraftVerifyTransactionResponse {
  /// True when Chapa reports the payment settled AND fulfillment
  /// succeeded (or had already been fulfilled by an earlier call).
  pub success: bool,

  /// One of: "success", "pending", "failed", "cancelled", "reversed",
  /// "unknown" (the raw Chapa status, lowercased).
  pub chapa_status: String,

  /// Optional human-readable detail (e.g. why fulfillment did not happen).
  pub message: Option<String>,
}
