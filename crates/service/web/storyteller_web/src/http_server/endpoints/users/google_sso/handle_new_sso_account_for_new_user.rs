use crate::http_server::common_responses::common_web_error::CommonWebError;
use crate::http_server::endpoints::users::google_sso::handle_new_sso_account::NewSsoAccountInfo;
use crate::http_server::user_lookup::user_session::session_utils::lookup::user_session_feature_flags::UserSessionFeatureFlags;
use actix_artcraft::requests::get_request_signup_source_enum::get_request_signup_source_enum;
use actix_web::HttpRequest;
use enums::by_table::users::user_feature_flag::UserFeatureFlag;
use google_sign_in::claims::claims::Claims;
use http_server_common::request::get_request_ip::get_request_ip;
use log::{error, info, warn};
use mysql_queries::queries::google_sign_in_accounts::insert_google_sign_in_account::{insert_google_sign_in_account, InsertGoogleSignInArgs};
use mysql_queries::queries::users::user::create::create_account_error::CreateAccountError;
use mysql_queries::queries::users::user::create::create_account_from_google_sso::{create_account_from_google_sso, CreateAccountFromGoogleSsoArgs};
use sqlx::pool::PoolConnection;
use sqlx::{Acquire, MySql};
use users::email::email_to_gravatar_hash::email_to_gravatar_hash;
use tokens::tokens::users::UserToken;
use users::username::generate_random_username::generate_random_username;

pub struct CreateArgs<'a> {
  pub http_request: &'a HttpRequest,
  pub claims: Claims,
  pub claims_subject: &'a str,
  pub claims_email_address: &'a str,
  pub user_email_address: &'a str,
  pub mysql_connection: &'a mut PoolConnection<MySql>,
  pub maybe_referral_partner: Option<String>,
  pub maybe_referral_url: Option<String>,
  pub maybe_landing_url: Option<String>,
  pub maybe_referral_user_token: Option<UserToken>,
  pub maybe_phone_number: Option<String>,
}
pub async fn handle_new_sso_account_for_new_user(
  args: CreateArgs<'_>
)
  -> Result<NewSsoAccountInfo, CommonWebError>
{
  let (username, display_name) = match &args.maybe_phone_number {
    Some(phone) => {
      let normalized = crate::util::normalize_ethiopian_phone::normalize_ethiopian_phone(phone)
        .ok_or_else(|| CommonWebError::BadInputWithSimpleMessage("Please enter a valid Ethiopian phone number (e.g. 09... or 07...)".to_string()))?;
      (normalized.clone(), normalized)
    },
    None => {
      return Err(CommonWebError::BadInputWithSimpleMessage("phone_number_required".to_string()));
    }
  };

  let mut transaction = args.mysql_connection.begin()
      .await
      .map_err(|e| {
        warn!("Could not begin transaction: {:?}", e);
        CommonWebError::from_error(e)
      })?;

  // Enroll users in studio temporarily.
  let user_feature_flags = studio_feature_flags();

  let ip_address = get_request_ip(&args.http_request);
  let user_email_gravatar_hash = email_to_gravatar_hash(&args.user_email_address);

  let mut maybe_source = get_request_signup_source_enum(&args.http_request);

  let result = create_account_from_google_sso(
    CreateAccountFromGoogleSsoArgs {
      username: &username,
      display_name: &display_name,
      email_address: &args.user_email_address,
      email_gravatar_hash: &user_email_gravatar_hash,
      email_confirmed_by_google: args.claims.email_verified(),
      maybe_feature_flags: user_feature_flags.as_deref(),
      ip_address: &ip_address,
      maybe_source,
      maybe_referral_partner: args.maybe_referral_partner.clone(),
      maybe_referral_url: args.maybe_referral_url.clone(),
      maybe_landing_url: args.maybe_landing_url.clone(),
      maybe_referral_user_token: args.maybe_referral_user_token.as_ref(),
    },
    &mut *transaction,
  ).await;

  let user_token = match result {
    Ok(token) => token,
    Err(CreateAccountError::UsernameIsTaken) => {
      return Err(CommonWebError::BadInputWithSimpleMessage(
        "An account with this phone number already exists".to_string(),
      ));
    },
    Err(err) => {
      warn!("error creating account from google sso: {:?}", err);
      return Err(CommonWebError::from_anyhow_error(
        anyhow::anyhow!("error creating account from google sso: {:?}", err),
      ));
    },
  };

  let user_display_name = display_name;

  let _token = insert_google_sign_in_account(InsertGoogleSignInArgs {
    subject: args.claims_subject,
    maybe_user_token: Some(&user_token),
    email_address: &args.claims_email_address, // NB: The one from the Google claims, not our canonicalized one.
    is_email_verified: args.claims.email_verified(),
    maybe_locale: args.claims.locale(),
    maybe_name: args.claims.name(),
    maybe_given_name: args.claims.given_name(),
    maybe_family_name: args.claims.family_name(),
    creator_ip_address: &ip_address,
    transaction: &mut transaction,
  }).await.map_err(|err| {
    warn!("error inserting google sign in account: {:?}", err);
    CommonWebError::from_anyhow_error(err)
  })?;

  transaction.commit()
      .await
      .map_err(|e| {
        warn!("Could not commit transaction: {:?}", e);
        CommonWebError::from_error(e)
      })?;

  Ok(NewSsoAccountInfo {
    user_token,
    user_display_name,
    username_is_not_customized: true, // New account with random username
    is_new_account: true,
  })
}

fn studio_feature_flags() -> Option<String> {
  let mut user_feature_flags = UserSessionFeatureFlags::empty();

  user_feature_flags.add_flags([
    UserFeatureFlag::Studio,
    UserFeatureFlag::VideoStyleTransfer,
  ]);

  let user_feature_flags = user_feature_flags
      .maybe_serialize_string();

  user_feature_flags
}
