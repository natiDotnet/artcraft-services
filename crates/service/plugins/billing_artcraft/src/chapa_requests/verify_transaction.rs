use serde::Deserialize;

/// https://developer.chapa.co/api-Reference/
/// GET /v1/transaction/verify/{tx_ref}
#[derive(Debug, Deserialize)]
pub struct VerifyResponse {
  pub data: Option<VerifyData>,
  pub message: String,
  pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyData {
  #[serde(rename = "txRef")]
  pub tx_ref: String,
  pub status: String, // "success" | "failed" | "pending" | "cancelled" | "reversed"
  #[serde(rename = "paidAmount")]
  pub paid_amount: Option<String>,
  pub currency: Option<String>,
  pub customer: Option<CustomerData>,
  /// Chapa's internal reference for the payment (distinct from tx_ref).
  #[serde(rename = "id")]
  pub chapa_transaction_id: Option<String>,
  #[serde(rename = "flwRef")]
  pub flw_ref: Option<String>,
  /// ISO-8601 timestamp of when Chapa received the payment.
  #[serde(rename = "createdAt")]
  pub created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CustomerData {
  pub email: Option<String>,
  pub first_name: Option<String>,
  pub last_name: Option<String>,
  pub phone_number: Option<String>,
}

/// A verified status returned by Chapa. We treat only `"success"` as final
/// fulfillment. All other statuses are either still-pending, failed, or
/// should never occur for a valid transaction we initiated.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChapaVerifiedStatus {
  Success,
  Pending,
  Failed,
  Cancelled,
  Reversed,
  Unknown,
}

impl From<&str> for ChapaVerifiedStatus {
  fn from(s: &str) -> Self {
    match s.to_lowercase().as_str() {
      "success" => Self::Success,
      "pending" => Self::Pending,
      "failed" => Self::Failed,
      "cancelled" => Self::Cancelled,
      "reversed" => Self::Reversed,
      _ => Self::Unknown,
    }
  }
}