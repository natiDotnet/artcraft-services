use crate::chapa_requests::client::ChapaClient;

/// Configuration for the Chapa (Ethiopian ETB rail: Telebirr, CBE Birr, et al)
/// integration, loaded from ENV vars at service startup.
#[derive(Clone)]
pub struct ArtcraftChapaConfig {
  /// Chapa secret key (starts with "CHASECK-..." for production,
  /// "CHASECK-TEST-..." / "SANDBOX-CHASECK-..." style keys for sandbox).
  pub secret_key: String,

  /// The Chapa API base URL. Defaults to `https://api.chapa.co/v1` when not
  /// supplied via ENV (there is no separate sandbox host -- sandbox vs
  /// production is decided by which secret key Chapa issued).
  pub api_base_url: String,

  /// Where to send the user's browser AFTER payment completes (or is
  /// abandoned). Chapa redirects the payer here with `?tx_ref=...&status=...`.
  pub checkout_return_url: String,

  /// Optional server-to-server notification URL Chapa calls when a payment
  /// settles. If unset, fulfillment relies purely on browser-redirect + the
  /// `verify` endpoint (which is safe -- verification is server-to-server).
  pub maybe_checkout_callback_url: Option<String>,
}

#[derive(Clone)]
pub struct ArtcraftChapaConfigWithClient {
  pub secret_key: String,
  pub api_base_url: String,
  pub checkout_return_url: String,
  pub maybe_checkout_callback_url: Option<String>,
  pub client: ChapaClient,
}

impl ArtcraftChapaConfig {
  pub fn to_config_with_client(&self) -> ArtcraftChapaConfigWithClient {
    ArtcraftChapaConfigWithClient {
      secret_key: self.secret_key.clone(),
      api_base_url: self.api_base_url.trim_end_matches('/').to_string(),
      checkout_return_url: self.checkout_return_url.clone(),
      maybe_checkout_callback_url: self.maybe_checkout_callback_url.clone(),
      client: ChapaClient::new(&self.secret_key),
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_to_config_with_client_strips_trailing_slash() {
    let config = ArtcraftChapaConfig {
      secret_key: "CHASECK-test".to_string(),
      api_base_url: "https://api.chapa.co/v1/".to_string(),
      checkout_return_url: "https://artcraft.example/etb/return".to_string(),
      maybe_checkout_callback_url: Some("https://api.artcraft.example/v1/chapa_artcraft/callback".to_string()),
    };

    let with_client = config.to_config_with_client();
    assert_eq!(with_client.api_base_url, "https://api.chapa.co/v1");
    assert_eq!(with_client.secret_key, "CHASECK-test");
    assert_eq!(with_client.checkout_return_url, "https://artcraft.example/etb/return");
    assert_eq!(with_client.maybe_checkout_callback_url.as_deref(), Some("https://api.artcraft.example/v1/chapa_artcraft/callback"));
  }

  #[test]
  fn test_to_config_with_client_without_callback() {
    let config = ArtcraftChapaConfig {
      secret_key: "CHASECK-test".to_string(),
      api_base_url: "https://api.chapa.co/v1".to_string(),
      checkout_return_url: "https://artcraft.example/etb/return".to_string(),
      maybe_checkout_callback_url: None,
    };

    let with_client = config.to_config_with_client();
    assert!(with_client.maybe_checkout_callback_url.is_none());
  }
}