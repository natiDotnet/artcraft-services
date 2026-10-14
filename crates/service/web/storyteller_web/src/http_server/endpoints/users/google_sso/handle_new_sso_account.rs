use crate::http_server::common_responses::common_web_error::CommonWebError;
use crate::http_server::endpoints::users::google_sso::handle_new_sso_account_for_existing_user::{handle_new_sso_account_for_existing_user, LinkArgs};
use crate::http_server::endpoints::users::google_sso::handle_new_sso_account_for_new_user::{handle_new_sso_account_for_new_user, CreateArgs};
use crate::util::canonicalize_email_for_users_table::canonicalize_email_for_users_table;
use actix_web::HttpRequest;
use google_sign_in::claims::claims::Claims;
use log::warn;
use mysql_queries::queries::users::user::get::lookup_user_for_login_by_email_with_transactor::lookup_user_for_login_by_email_with_transactor;
use mysql_queries::utils::transactor::Transactor;
use sqlx::pool::PoolConnection;
use sqlx::MySql;
use tokens::tokens::users::UserToken;

use mysql_queries::queries::users::user::update::update_username::{update_username, UpdateUsernameArgs, UpdateUsernameError};
use crate::util::normalize_ethiopian_phone::normalize_ethiopian_phone;
use http_server_common::request::get_request_ip::get_request_ip;

pub struct NewSsoArgs<'a> {
  pub http_request: &'a HttpRequest,
  pub claims: Claims,
  pub claims_subject: &'a str,
  pub claims_email_address: &'a str,
  pub mysql_connection: &'a mut PoolConnection<MySql>,
  pub maybe_referral_url: Option<String>,
  pub maybe_landing_url: Option<String>,
  pub maybe_referral_partner: Option<String>,
  pub maybe_referral_user_token: Option<UserToken>,
  pub maybe_phone_number: Option<String>,
}

pub struct NewSsoAccountInfo {
  pub user_token: UserToken,
  pub user_display_name: String,
  pub username_is_not_customized: bool,
  pub is_new_account: bool,
}

pub async fn handle_new_sso_account(
  args: NewSsoArgs<'_>
)
  -> Result<NewSsoAccountInfo, CommonWebError>
{
  // NB: We use this routine to "normalize" email addresses in the user table.
  // It won't necessarily match the email address in the Google claims.
  // A better normalization function in the future may handle dots and plus
  // signs in Gmail addresses, for instance.
  let user_email_address = canonicalize_email_for_users_table(&args.claims_email_address);

  let maybe_user_account =
      lookup_user_for_login_by_email_with_transactor(&user_email_address, Transactor::for_connection(args.mysql_connection))
          .await
          .map_err(|err| {
            warn!("error looking up user by email: {:?}", err);
            CommonWebError::from_anyhow_error(err)
          })?;

  match maybe_user_account {
    Some(mut user_account) => {
      let has_phone = normalize_ethiopian_phone(&user_account.username).is_some();
      if !has_phone {
        if let Some(ref phone) = args.maybe_phone_number {
          let normalized = normalize_ethiopian_phone(phone)
            .ok_or_else(|| CommonWebError::BadInputWithSimpleMessage("Please enter a valid Ethiopian phone number (e.g. 09... or 07...)".to_string()))?;
          let ip_address = get_request_ip(&args.http_request);
          let update_res = update_username(UpdateUsernameArgs {
            token: &user_account.token,
            username: &normalized,
            display_name: &normalized,
            username_is_not_customized: false,
            ip_address: &ip_address,
            transactor: Transactor::for_connection(args.mysql_connection),
          }).await;
          match update_res {
            Ok(_) => {
              user_account.username = normalized.clone();
              user_account.display_name = normalized;
            },
            Err(UpdateUsernameError::UsernameIsTaken) => {
              return Err(CommonWebError::BadInputWithSimpleMessage("An account with this phone number already exists".to_string()));
            },
            Err(err) => {
              warn!("error updating username to phone: {:?}", err);
              return Err(CommonWebError::from_anyhow_error(anyhow::anyhow!("database error updating phone")));
            }
          }
        } else {
          return Err(CommonWebError::BadInputWithSimpleMessage("phone_number_required".to_string()));
        }
      }

      handle_new_sso_account_for_existing_user(LinkArgs {
        http_request: args.http_request,
        claims: args.claims,
        claims_subject: args.claims_subject,
        claims_email_address: &args.claims_email_address,
        user_account,
        mysql_connection: args.mysql_connection,
      }).await
    },
    None => {
      handle_new_sso_account_for_new_user(CreateArgs {
        http_request: args.http_request,
        claims: args.claims,
        claims_subject: args.claims_subject,
        claims_email_address: &args.claims_email_address,
        user_email_address: &user_email_address,
        mysql_connection: args.mysql_connection,
        maybe_referral_url: args.maybe_referral_url,
        maybe_landing_url: args.maybe_landing_url,
        maybe_referral_partner: args.maybe_referral_partner,
        maybe_referral_user_token: args.maybe_referral_user_token,
        maybe_phone_number: args.maybe_phone_number,
      }).await
    },
  }
}
