use bytes::Bytes;
use futures::Stream;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};

use crate::error::OpenRouterError;
use crate::models::{ChatCompletionRequest, ChatCompletionResponse};

pub const DEFAULT_OPENROUTER_BASE_URL: &str = "https://openrouter.ai/api/v1";

#[derive(Clone, Debug)]
pub struct OpenRouterClient {
  client: reqwest::Client,
  api_key: String,
  base_url: String,
  site_url: Option<String>,
  app_name: Option<String>,
}

impl OpenRouterClient {
  pub fn new(api_key: impl Into<String>) -> Self {
    Self {
      client: reqwest::Client::new(),
      api_key: api_key.into(),
      base_url: DEFAULT_OPENROUTER_BASE_URL.to_string(),
      site_url: None,
      app_name: None,
    }
  }

  pub fn with_client(mut self, client: reqwest::Client) -> Self {
    self.client = client;
    self
  }

  pub fn with_base_url(mut self, base_url: impl Into<String>) -> Self {
    self.base_url = base_url.into();
    self
  }

  pub fn with_site_info(
    mut self,
    site_url: impl Into<String>,
    app_name: impl Into<String>,
  ) -> Self {
    self.site_url = Some(site_url.into());
    self.app_name = Some(app_name.into());
    self
  }

  fn build_headers(&self) -> Result<HeaderMap, OpenRouterError> {
    if self.api_key.trim().is_empty() || self.api_key == "unset" {
      return Err(OpenRouterError::MissingApiKey);
    }

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let auth_val = format!("Bearer {}", self.api_key);
    let mut auth_header = HeaderValue::from_str(&auth_val).map_err(|_| {
      OpenRouterError::Api {
        status_code: 400,
        message: "Invalid characters in OPENROUTER_API_KEY".to_string(),
      }
    })?;
    auth_header.set_sensitive(true);
    headers.insert(AUTHORIZATION, auth_header);

    if let Some(ref site_url) = self.site_url {
      if let Ok(val) = HeaderValue::from_str(site_url) {
        headers.insert("HTTP-Referer", val);
      }
    }

    if let Some(ref app_name) = self.app_name {
      if let Ok(val) = HeaderValue::from_str(app_name) {
        headers.insert("X-Title", val);
      }
    }

    Ok(headers)
  }

  /// Sends a synchronous (non-streaming) completion request.
  pub async fn send_chat(
    &self,
    mut request: ChatCompletionRequest,
  ) -> Result<ChatCompletionResponse, OpenRouterError> {
    request.stream = false;
    let headers = self.build_headers()?;
    let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));

    let response = self
      .client
      .post(&url)
      .headers(headers)
      .json(&request)
      .send()
      .await?;

    let status = response.status();
    if !status.is_success() {
      let error_text = response.text().await.unwrap_or_default();
      return Err(OpenRouterError::Api {
        status_code: status.as_u16(),
        message: error_text,
      });
    }

    let completion: ChatCompletionResponse = response.json().await?;
    Ok(completion)
  }

  /// Sends a streaming completion request and returns an asynchronous raw byte stream.
  pub async fn stream_chat(
    &self,
    mut request: ChatCompletionRequest,
  ) -> Result<impl Stream<Item = reqwest::Result<Bytes>>, OpenRouterError> {
    request.stream = true;
    let headers = self.build_headers()?;
    let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));

    let response = self
      .client
      .post(&url)
      .headers(headers)
      .json(&request)
      .send()
      .await?;

    let status = response.status();
    if !status.is_success() {
      let error_text = response.text().await.unwrap_or_default();
      return Err(OpenRouterError::Api {
        status_code: status.as_u16(),
        message: error_text,
      });
    }

    Ok(response.bytes_stream())
  }

  /// Sends a text-to-speech / audio speech request and returns an asynchronous raw audio byte stream and content type.
  pub async fn stream_speech(
    &self,
    request: &serde_json::Value,
  ) -> Result<(impl Stream<Item = reqwest::Result<Bytes>>, String), OpenRouterError> {
    let headers = self.build_headers()?;
    let url = format!("{}/audio/speech", self.base_url.trim_end_matches('/'));

    let response = self
      .client
      .post(&url)
      .headers(headers)
      .json(request)
      .send()
      .await?;

    let status = response.status();
    if !status.is_success() {
      let error_text = response.text().await.unwrap_or_default();
      return Err(OpenRouterError::Api {
        status_code: status.as_u16(),
        message: error_text,
      });
    }

    let content_type = response
      .headers()
      .get(reqwest::header::CONTENT_TYPE)
      .and_then(|v| v.to_str().ok())
      .unwrap_or("audio/mpeg")
      .to_string();

    Ok((response.bytes_stream(), content_type))
  }
}
