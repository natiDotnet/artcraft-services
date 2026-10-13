use reqwest::Client;

/// Minimal HTTP client for the Chapa payment gateway API
/// (https://developer.chapa.co/api-reference/).
///
/// Chapa authenticates every request with a `Bearer` secret key header.
#[derive(Clone)]
pub struct ChapaClient {
  http: Client,
  secret_key: String,
}

impl ChapaClient {
  pub fn new(secret_key: &str) -> Self {
    Self {
      http: Client::new(),
      secret_key: secret_key.to_string(),
    }
  }

  /// GET/POST to the Chapa API with auth headers pre-applied.
  pub async fn get(&self, url: &str) -> reqwest::Response {
    self.http
        .get(url)
        .bearer_auth(&self.secret_key)
        .send()
        .await
        .expect("Chapa API GET request failed")
  }

  pub async fn post_json<T: serde::Serialize + ?Sized>(&self, url: &str, body: &T) -> reqwest::Response {
    self.http
        .post(url)
        .bearer_auth(&self.secret_key)
        .json(body)
        .send()
        .await
        .expect("Chapa API POST request failed")
  }
}
