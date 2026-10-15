use rust_decimal::Decimal;
use serde_derive::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct GetSessionCreditsResponse {
  pub success: bool,

  /// Any free credits the user might have
  /// We might support daily free credits.
  #[schema(value_type = f64)]
  pub free_credits: Decimal,

  /// Any monthly refilling credits the user might have
  #[schema(value_type = f64)]
  pub monthly_credits: Decimal,

  /// Any banked credits the user might have.
  #[schema(value_type = f64)]
  pub banked_credits: Decimal,

  /// All the credit amounts added together.
  #[schema(value_type = f64)]
  pub sum_total_credits: Decimal,
}
