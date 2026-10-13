use std::error::Error;
use std::fmt;

#[derive(Debug)]
pub enum OpenRouterError {
  Http(reqwest::Error),
  Json(serde_json::Error),
  Api { status_code: u16, message: String },
  MissingApiKey,
  StreamClosed,
}

impl Error for OpenRouterError {}

impl fmt::Display for OpenRouterError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      Self::Http(e) => write!(f, "OpenRouter HTTP error: {}", e),
      Self::Json(e) => write!(f, "OpenRouter JSON error: {}", e),
      Self::Api { status_code, message } => {
        write!(f, "OpenRouter API error (status {}): {}", status_code, message)
      }
      Self::MissingApiKey => write!(f, "OpenRouter API key is missing or unset"),
      Self::StreamClosed => write!(f, "OpenRouter response stream closed prematurely"),
    }
  }
}

impl From<reqwest::Error> for OpenRouterError {
  fn from(e: reqwest::Error) -> Self {
    Self::Http(e)
  }
}

impl From<serde_json::Error> for OpenRouterError {
  fn from(e: serde_json::Error) -> Self {
    Self::Json(e)
  }
}
