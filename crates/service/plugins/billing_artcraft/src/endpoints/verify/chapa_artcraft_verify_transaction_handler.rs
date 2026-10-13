/// POST /v1/chapa_artcraft/verify_transaction
///
/// Verifies a Chapa payment server-to-server and fulfills it. The frontend
/// calls this after Chapa redirects the user back to the site with
/// `?tx_ref=...&status=...`. Safe to call repeatedly: fulfillment is
/// transactional and idempotent on the spend-event dedup key
/// (payment_source='chapa', source_object_id=tx_ref).
///
/// Security notes:
///  - The `tx_ref` encodes the paying user; we only fulfill for the
///    *authenticated* user matching it.
///  - We re-verify the settled amount against our config so a tampered or
///    stale `tx_ref` cannot grant free credits.
use crate::chapa_requests::verify_transaction::{ChapaVerifiedStatus, VerifyResponse};
use crate::configs::credits_packs::etb_credits_pack_info_list::get_etb_credits_pack_by_id;
use crate::configs::subscriptions::etb_artcraft_subscription_info_list::get_etb_artcraft_subscription_info_by_slug;
use crate::utils::artcraft_chapa_config::ArtcraftChapaConfigWithClient;
use crate::utils::chapa_tx_ref::{ChapaTxRefPayload, decode_tx_ref};
use crate::utils::common_web_error::CommonWebError;
use actix_web::HttpRequest;
use actix_web::web::{Data, Json};
use chrono::Utc;
use artcraft_api_defs::chapa_artcraft::verify_transaction::{
  ChapaArtcraftVerifyTransactionRequest, ChapaArtcraftVerifyTransactionResponse,
};
use component_traits::traits::internal_user_lookup::InternalUserLookup;
use log::{error, info};
use sqlx::MySqlPool;
use tokens::tokens::users::UserToken;

pub async fn chapa_artcraft_verify_transaction_handler(
  http_request: HttpRequest,
  request: Json<ChapaArtcraftVerifyTransactionRequest>,
  config: Data<ArtcraftChapaConfigWithClient>,
  internal_user_lookup: Data<dyn InternalUserLookup>,
  mysql_pool: Data<MySqlPool>,
) -> Result<Json<ChapaArtcraftVerifyTransactionResponse>, CommonWebError> {
  let user_metadata = internal_user_lookup
      .lookup_user_from_http_request(&http_request)
      .await
      .map_err(|err| {
        error!("Could not resolve user session: {:?}", err);
        CommonWebError::NotAuthorized
      })?
      .ok_or(CommonWebError::NotAuthorized)?;

  let authenticated_user = user_metadata.user_token_typed;

  // ── Decode OUR reference ─────────────────────────────────────────────────

  let payload = match decode_tx_ref(&request.tx_ref) {
    Some(payload) => payload,
    None => {
      info!("Chapa verify: unknown/garbage tx_ref {:?}", request.tx_ref);
      return Ok(Json(ChapaArtcraftVerifyTransactionResponse {
        success: false,
        chapa_status: "failed".to_string(),
        message: Some("unknown tx_ref".to_string()),
      }));
    }
  };

  // SECURITY: only the user encoded in the tx_ref can verify it.
  if payload.user_token() != authenticated_user.as_str() {
    error!("Chapa verify: tx_ref user {} does not match session user {}",
           payload.user_token(), authenticated_user.as_str());
    return Err(CommonWebError::NotAuthorized);
  }

  // ── Verify with Chapa (server-to-server) ────────────────────────────────

  let base = config.api_base_url.trim_end_matches('/');
  let url = if base.ends_with("/v1") {
    format!("{}/transaction/verify/{}", base, request.tx_ref)
  } else {
    format!("{}/v1/transaction/verify/{}", base, request.tx_ref)
  };
  let response = config.client.get(&url).await;
  let status_code = response.status();
  let text = response.text().await.map_err(|e| {
    error!("Chapa verify failed to read response body: {:?}", e);
    CommonWebError::ServerError
  })?;

  let body: VerifyResponse = serde_json::from_str(&text).map_err(|e| {
    error!("Chapa verify failed to parse response (status {}): {:?}. Raw body: {}", status_code, e, text);
    CommonWebError::ServerError
  })?;

  // Chapa's verify response has TWO status fields:
  //  - envelope `status`: did the API call itself succeed
  //  - `data.status`: the actual transaction state (success/pending/failed/...)
  // A pending transaction, for instance, still returns envelope status
  // "success" with `data.status == "pending"`. Check both.

  let status_str = body.status.as_deref().unwrap_or("failed");
  if status_str != "success" {
    info!("Chapa verify: API-level failure for tx_ref {} (status {})",
          request.tx_ref, status_str);
    return Ok(Json(ChapaArtcraftVerifyTransactionResponse {
      success: false,
      chapa_status: status_str.to_lowercase(),
      message: body.message.map(|m| m.to_string()),
    }));
  }

  let verify_data = match body.data {
    Some(data) => data,
    None => {
      error!("Chapa verify success but no data payload for tx_ref {}", request.tx_ref);
      return Err(CommonWebError::ServerError);
    }
  };

  let verified_status = ChapaVerifiedStatus::from(verify_data.status.as_str());

  if verified_status != ChapaVerifiedStatus::Success {
    info!("Chapa verify: tx_ref {} not settled (status {})", request.tx_ref, verify_data.status);
    return Ok(Json(ChapaArtcraftVerifyTransactionResponse {
      success: false,
      chapa_status: verify_data.status.to_lowercase(),
      message: body.message.map(|m| m.to_string()),
    }));
  }

  // Defense in depth: the settled currency must be ETB. A mismatch means
  // Chapa was pointed at a different product than the one we configured.
  if let Some(currency) = verify_data.currency.as_deref() {
    if !currency.eq_ignore_ascii_case("ETB") {
      error!("Chapa verify: unexpected currency {} for tx_ref {}", currency, request.tx_ref);
      return Ok(Json(ChapaArtcraftVerifyTransactionResponse {
        success: false,
        chapa_status: "failed".to_string(),
        message: Some("unexpected currency".to_string()),
      }));
    }
  }

  // ── Amount check: what Chapa collected must match our price ─────────────

  let expected_etb_cents = expected_etb_cents_for(&payload);
  if let Some(paid_amount) = verify_data.paid_amount.as_deref() {
    match parse_paid_amount_to_etb_cents(paid_amount) {
      Some(paid_etb_cents) if paid_amount_maybe_mismatch(expected_etb_cents, paid_etb_cents) => {
        error!("Chapa verify: paid amount mismatch for tx_ref {}: expected {} cents, paid {} cents",
               request.tx_ref, expected_etb_cents, paid_etb_cents);
        return Ok(Json(ChapaArtcraftVerifyTransactionResponse {
          success: false,
          chapa_status: "failed".to_string(),
          message: Some("paid amount does not match the product price".to_string()),
        }));
      }
      None => {
        error!("Chapa verify: could not parse paid_amount {:?} for tx_ref {}",
               verify_data.paid_amount, request.tx_ref);
        return Err(CommonWebError::ServerError);
      }
      _ => {}
    }
  }

  // ── Fulfill, transactionally ─────────────────────────────────────────────

  let mut mysql_transaction = mysql_pool
      .begin()
      .await
      .map_err(|e| {
        error!("Could not open mysql transaction: {:?}", e);
        CommonWebError::ServerError
      })?;

  let fulfillment_result = match &payload {
    ChapaTxRefPayload::Subscription { user_token, slug, period } => {
      // The tx_ref was built server-side at checkout time from the
      // authenticated session, so the user token is trusted.
      let user_token = UserToken::new_from_str(user_token);
      let info = get_etb_artcraft_subscription_info_by_slug(*slug);
      let amount_etb_cents = period.price_etb(&info) as i64 * 100;
      info!("Fulfilling Chapa subscription payment: user={} slug={} period={} tx_ref={}",
            user_token, slug, period.to_str(), request.tx_ref);
      crate::billing_action_fulfillment::subscriptions::mark_chapa_subscription_period_paid::mark_chapa_subscription_period_paid(
        &user_token,
        &info,
        *period,
        &request.tx_ref,
        amount_etb_cents,
        Utc::now(),
        &mut mysql_transaction,
      ).await
    }
    ChapaTxRefPayload::CreditsPack { user_token, pack_id } => {
      let user_token = UserToken::new_from_str(user_token);
      let pack = match get_etb_credits_pack_by_id(pack_id) {
        Some(pack) => pack,
        None => {
          error!("Chapa verify: unknown credits pack in tx_ref {}", request.tx_ref);
          return Err(CommonWebError::ServerError);
        }
      };
      let amount_etb_cents = pack.etb_price as i64 * 100;
      info!("Fulfilling Chapa credits pack purchase: user={} pack={} tx_ref={}",
            user_token, pack_id, request.tx_ref);
      crate::billing_action_fulfillment::credits_pack::complete_chapa_credits_pack_purchase::complete_chapa_credits_pack_purchase(
        &user_token,
        &pack,
        &request.tx_ref,
        amount_etb_cents,
        Utc::now(),
        &mut mysql_transaction,
      ).await
    }
  };

  if let Err(err) = fulfillment_result {
    error!("Chapa fulfillment failed for tx_ref {}: {:?}", request.tx_ref, err);
    // Rollback happens on drop; be explicit anyway.
    let _ = mysql_transaction.rollback().await;
    return Err(CommonWebError::ServerError);
  }

  mysql_transaction.commit().await
      .map_err(|e| {
        error!("Could not commit Chapa fulfillment transaction: {:?}", e);
        CommonWebError::ServerError
      })?;

  info!("Chapa fulfillment complete for tx_ref {}", request.tx_ref);

  Ok(Json(ChapaArtcraftVerifyTransactionResponse {
    success: true,
    chapa_status: "success".to_string(),
    message: None,
  }))
}

/// Expected amount (ETB cents) for a decoded tx_ref, from our config tables.
fn expected_etb_cents_for(payload: &ChapaTxRefPayload) -> i64 {
  match payload {
    ChapaTxRefPayload::Subscription { slug, period, .. } => {
      let info = get_etb_artcraft_subscription_info_by_slug(*slug);
      period.price_etb(&info) as i64 * 100
    }
    ChapaTxRefPayload::CreditsPack { pack_id, .. } => {
      let pack = get_etb_credits_pack_by_id(pack_id)
          .expect("pack id was validated at checkout time");
      pack.etb_price as i64 * 100
    }
  }
}

/// Chapa reports `paid_amount` as a decimal string like "1500.00" (ETB).
/// Convert to integer cents for a lossless comparison.
fn parse_paid_amount_to_etb_cents(paid_amount: &str) -> Option<i64> {
  let value: f64 = paid_amount.parse().ok()?;
  if !value.is_finite() || value < 0.0 {
    return None;
  }
  Some((value * 100.0).round() as i64)
}

/// Allow a 1-cent rounding difference between what Chapa reports and our
/// configured price (float formatting on Chapa's side).
fn paid_amount_maybe_mismatch(expected_etb_cents: i64, paid_etb_cents: i64) -> bool {
  (expected_etb_cents - paid_etb_cents).abs() > 1
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_parse_paid_amount_to_etb_cents() {
    assert_eq!(parse_paid_amount_to_etb_cents("1500.00"), Some(150_000));
    assert_eq!(parse_paid_amount_to_etb_cents("1500"), Some(150_000));
    assert_eq!(parse_paid_amount_to_etb_cents("0.99"), Some(99));
    assert_eq!(parse_paid_amount_to_etb_cents("-1.00"), None);
    assert_eq!(parse_paid_amount_to_etb_cents("abc"), None);
  }

  #[test]
  fn test_paid_amount_maybe_mismatch() {
    assert!(!paid_amount_maybe_mismatch(150_000, 150_000));
    assert!(!paid_amount_maybe_mismatch(150_000, 149_999)); // 1 cent tolerance
    assert!(paid_amount_maybe_mismatch(150_000, 149_998));
    assert!(paid_amount_maybe_mismatch(150_000, 150_001));
  }
}