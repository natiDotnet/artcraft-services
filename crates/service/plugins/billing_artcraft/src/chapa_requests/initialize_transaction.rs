use serde::{Deserialize, Serialize};

/// https://developer.chapa.co/api-reference/
/// POST /v1/charge/initialize
#[derive(Debug, Serialize)]
pub struct InitializeRequest {
  pub amount: String,           // "15000.00" -- always two decimal places in ETB
  pub currency: String,          // always "ETB"
  pub tx_ref: String,           // our generated tx_ref
  pub callback_url: String,      // browser-return URL Chapa redirects to
  pub return_url: Option<String>, // optional server webhook
  pub email: Option<String>,     // optional payer email
  pub first_name: Option<String>,
  pub last_name: Option<String>,
  pub phone_number: Option<String>,
  pub title: Option<String>,
  pub description: Option<String>,
  pub meta: Option<serde_json::Value>, // free-form key-value pairs
}

#[derive(Debug, Deserialize)]
pub struct InitializeResponse {
  pub data: Option<InitializeData>,
  pub message: String,
  pub status: String, // "success" | "failed" | ...
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializeData {
  pub checkout_url: String,     // URL to redirect the user's browser to
  pub reference: String,        // should equal our tx_ref
}