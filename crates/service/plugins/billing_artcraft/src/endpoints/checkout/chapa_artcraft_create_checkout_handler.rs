/// POST /v1/chapa_artcraft/checkout
///
/// Creates a Chapa checkout session for an ETB credits pack or subscription
/// period. Returns the Chapa-hosted payment page URL for the frontend to
/// redirect the user's browser to.
///
/// Validation: exactly one of `credits_pack_id` / `plan` must be supplied.
/// `period` is required when `plan` is supplied.
use crate::chapa_requests::initialize_transaction::{InitializeRequest, InitializeResponse};
use crate::configs::credits_packs::etb_credits_pack_info_list::get_etb_credits_pack_by_id;
use crate::configs::subscriptions::etb_artcraft_subscription_info::EtbSubscriptionBillingPeriod;
use crate::configs::subscriptions::etb_artcraft_subscription_info_list::get_etb_artcraft_subscription_info_by_slug;
use crate::utils::artcraft_chapa_config::ArtcraftChapaConfigWithClient;
use crate::utils::common_web_error::CommonWebError;
use crate::utils::chapa_tx_ref::ChapaTxRefPayload;
use actix_web::HttpRequest;
use actix_web::web::{Data, Json};
use artcraft_api_defs::chapa_artcraft::create_checkout::{
  ChapaArtcraftCreateCheckoutRequest, ChapaArtcraftCreateCheckoutResponse, ChapaPlanBillingPeriod,
};
use component_traits::traits::internal_user_lookup::InternalUserLookup;
use log::{error, info};

pub async fn chapa_artcraft_create_checkout_handler(
  http_request: HttpRequest,
  request: Json<ChapaArtcraftCreateCheckoutRequest>,
  config: Data<ArtcraftChapaConfigWithClient>,
  internal_user_lookup: Data<dyn InternalUserLookup>,
) -> Result<Json<ChapaArtcraftCreateCheckoutResponse>, CommonWebError> {
  // ── Auth: resolve the paying user ────────────────────────────────────────

  let user_metadata = internal_user_lookup
      .lookup_user_from_http_request(&http_request)
      .await
      .map_err(|err| {
        error!("Could not resolve user session: {:?}", err);
        CommonWebError::NotAuthorized
      })?
      .ok_or(CommonWebError::NotAuthorized)?;

  let user_token = user_metadata.user_token_typed.as_str().to_string();

  // ── Resolve the product ──────────────────────────────────────────────────

  let has_pack = request.credits_pack_id.is_some();
  let has_plan = request.plan.is_some();

  if has_pack == has_plan {
    return Err(CommonWebError::BadInputWithSimpleMessage(
      "exactly one of credits_pack_id / plan must be supplied".to_string(),
    ));
  }

  let payload = if let Some(ref pack_id) = request.credits_pack_id {
    // Validate the pack exists (discarded; only used for the tx_ref + amount).
    get_etb_credits_pack_by_id(pack_id)
        .ok_or_else(|| CommonWebError::BadInputWithSimpleMessage(format!("unknown credits pack: {}", pack_id)))?;
    ChapaTxRefPayload::CreditsPack {
      user_token,
      pack_id: pack_id.clone(),
    }
  } else {
    let plan = request.plan.unwrap();
    let period = request.period
        .ok_or_else(|| CommonWebError::BadInputWithSimpleMessage("period is required for subscriptions".to_string()))?;
    let period: EtbSubscriptionBillingPeriod = match period {
      ChapaPlanBillingPeriod::Monthly => EtbSubscriptionBillingPeriod::Monthly,
      ChapaPlanBillingPeriod::Yearly => EtbSubscriptionBillingPeriod::Yearly,
    };
    ChapaTxRefPayload::Subscription {
      user_token,
      slug: plan,
      period,
    }
  };

  let tx_ref = payload.to_tx_ref();

  // ── Build Chapa amount ────────────────────────────────────────────────────

  let (amount_etb, description) = match &payload {
    ChapaTxRefPayload::CreditsPack { pack_id, .. } => {
      let pack = get_etb_credits_pack_by_id(pack_id)
          .expect("pack already validated above");
      (pack.etb_price, format!("Artcraft {} credits pack", pack.credits_awarded))
    }
    ChapaTxRefPayload::Subscription { slug, period, .. } => {
      let info = get_etb_artcraft_subscription_info_by_slug(*slug);
      (period.price_etb(&info), format!("Artcraft {:?} {:?} subscription", slug, period))
    }
  };

  // Chapa expects amount as a decimal string with exactly two decimal places.
  let amount_str = format!("{:.2}", amount_etb as f64);

  // ── Call Chapa /v1/charge/initialize ─────────────────────────────────────

  let initialize_request = InitializeRequest {
    amount: amount_str,
    currency: "ETB".to_string(),
    tx_ref: tx_ref.clone(),
    callback_url: config.checkout_return_url.clone(),
    return_url: config.maybe_checkout_callback_url.clone(),
    email: user_metadata.user_email.clone(),
    first_name: None,
    last_name: None,
    phone_number: None,
    title: Some("Artcraft Payment".to_string()),
    description: Some(description),
    meta: None,
  };

  let url = format!("{}/v1/charge/initialize", config.api_base_url);
  let response = config.client.post_json(&url, &initialize_request).await;

  let body: InitializeResponse = response
      .json()
      .await
      .map_err(|e| {
        error!("Chapa initialize failed to parse response: {:?}", e);
        CommonWebError::ServerError
      })?;

  if body.status != "success" {
    error!("Chapa initialize error: {:?}", body.message);
    return Err(CommonWebError::BadInputWithSimpleMessage(format!(
      "Chapa error: {}", body.message
    )));
  }

  let data = body.data.ok_or(CommonWebError::ServerError)?;

  // Sanity check: Chapa echoes our tx_ref back; if it doesn't match, the
  // verification step will not be able to decode it.
  if data.reference != tx_ref {
    error!("Chapa returned a different reference than requested: {} != {}", data.reference, tx_ref);
    return Err(CommonWebError::ServerError);
  }

  info!("Created Chapa checkout: tx_ref={}, checkout_url={}", tx_ref, data.checkout_url);

  Ok(Json(ChapaArtcraftCreateCheckoutResponse {
    success: true,
    chapa_checkout_url: data.checkout_url,
    tx_ref,
  }))
}