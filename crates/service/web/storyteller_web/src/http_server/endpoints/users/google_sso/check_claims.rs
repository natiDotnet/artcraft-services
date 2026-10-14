use crate::http_server::common_responses::common_web_error::CommonWebError;
use crate::http_server::endpoints::users::google_sso::google_sso_handler::GoogleCreateAccountRequest;
use crate::state::certs::google_sign_in_cert::GoogleSignInCert;
use google_sign_in::claims::claims::Claims;
use google_sign_in::decode_and_verify_token_claims::decode_and_verify_token_claims;
use google_sign_in::VerificationOptions;
use log::warn;
use std::collections::HashSet;

pub async fn check_claims(
  request: &GoogleCreateAccountRequest,
  google_sign_in_cert: &GoogleSignInCert,
) -> Result<Claims, CommonWebError> {
  let keys = google_sign_in_cert.fetch_key_map(false)
      .await
      .map_err(|e| {
        warn!("error downloading google certs: {:?}", e);
        CommonWebError::from_anyhow_error(e)
      })?;

  let verification_options = Some(build_options());

  let claims = match decode_and_verify_token_claims(&keys, &request.google_credential, verification_options) {
    Ok(claims) => claims,
    Err(err) => {
      warn!("error decoding google token claims (will retry certs): {:?}", err);

      let keys = google_sign_in_cert.fetch_key_map(true) // NB: REFRESH
          .await
          .map_err(|e| {
            warn!("error refreshing google certs: {:?}", e);
            CommonWebError::from_anyhow_error(e)
          })?;

      let verification_options = Some(build_options());

      let claims = decode_and_verify_token_claims(&keys, &request.google_credential, verification_options)
          .map_err(|e| {
            warn!("error decoding google token claims: {:?} (configured allowed_audiences: {:?})", e, build_options().allowed_audiences);
            // The detailed error is logged above; the user-facing message is intentionally
            // generic so we don't leak JWT internals.
            CommonWebError::BadInputWithSimpleMessage("invalid google credential".to_string())
          })?;

      claims
    },
  };

  Ok(claims)
}

// Make this configurable via env vars and fallback config files.
fn get_allowed_audiences() -> HashSet<String> {
  let mut audiences = HashSet::new();

  // Legacy default client ID
  audiences.insert("788843034237-uqcg8tbgofrcf1to37e1bqphd924jaf6.apps.googleusercontent.com".to_string());

  // Check environment variables
  for env_key in &["GOOGLE_CLIENT_ID", "VITE_GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_IDS"] {
    if let Some(val) = easyenv::get_env_string_optional(env_key) {
      for client_id in val.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()) {
        audiences.insert(client_id.to_string());
      }
    }
  }

  // Also check common .env files on disk in case server was started without reloading env
  let candidate_paths = [
    ".env",
    "../.env",
    "../../.env",
    "build/selfhost/.env",
    "frontend/apps/artcraft-webapp/.env.local",
    "frontend/apps/artcraft-webapp/.env",
  ];

  for path in candidate_paths {
    if let Ok(content) = std::fs::read_to_string(path) {
      for line in content.lines() {
        let line = line.trim();
        if line.starts_with('#') || !line.contains('=') {
          continue;
        }
        if let Some((k, v)) = line.split_once('=') {
          let k = k.trim();
          let v = v.trim().trim_matches('"').trim_matches('\'').trim();
          if (k == "GOOGLE_CLIENT_ID" || k == "VITE_GOOGLE_CLIENT_ID" || k == "GOOGLE_CLIENT_IDS") && !v.is_empty() {
            for client_id in v.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()) {
              audiences.insert(client_id.to_string());
            }
          }
        }
      }
    }
  }

  audiences
}

fn build_options() -> VerificationOptions {
  let allowed_audiences = if easyenv::get_env_bool_or_default("GOOGLE_AUTH_DISABLE_AUDIENCE_CHECK", false) {
    None
  } else {
    Some(get_allowed_audiences())
  };

  VerificationOptions {
    allowed_issuers: Some(HashSet::from([
      "https://accounts.google.com".to_string(),
      "accounts.google.com".to_string(),
    ])),
    allowed_audiences,
    ..Default::default()
  }
}

