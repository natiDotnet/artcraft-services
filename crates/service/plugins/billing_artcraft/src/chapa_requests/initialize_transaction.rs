use serde::{Deserialize, Serialize};

/// https://developer.chapa.co/docs/accept-payments/
/// POST /v1/transaction/initialize
#[derive(Debug, Serialize)]
pub struct InitializeRequest {
  pub amount: String,                  // "15000.00" -- always two decimal places in ETB
  pub currency: String,                // always "ETB"
  pub tx_ref: String,                  // our generated tx_ref
  pub return_url: String,              // browser-return URL Chapa redirects to
  #[serde(skip_serializing_if = "Option::is_none")]
  pub callback_url: Option<String>,    // optional server webhook
  pub email: String,                   // payer email
  pub first_name: String,              // payer first name
  pub last_name: String,               // payer last name
  #[serde(skip_serializing_if = "Option::is_none")]
  pub phone_number: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub title: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub description: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub meta: Option<serde_json::Value>, // free-form key-value pairs
}

#[derive(Debug, Deserialize)]
pub struct InitializeResponse {
  pub data: Option<InitializeData>,
  #[serde(default)]
  pub message: Option<serde_json::Value>,
  #[serde(default)]
  pub status: Option<String>, // "success" | "failed" | ...
}

#[derive(Debug, Deserialize)]
pub struct InitializeData {
  #[serde(alias = "checkout_url")]
  pub checkout_url: String,            // URL to redirect the user's browser to
  #[serde(default, alias = "reference")]
  pub reference: Option<String>,
}