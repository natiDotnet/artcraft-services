use billing_artcraft_component::utils::artcraft_chapa_config::ArtcraftChapaConfig;
use billing_artcraft_component::utils::artcraft_chapa_config::ArtcraftChapaConfigWithClient;
use errors::AnyhowResult;

pub fn setup_chapa_artcraft() -> AnyhowResult<ArtcraftChapaConfigWithClient> {
  Ok(ArtcraftChapaConfig {
    secret_key: easyenv::get_env_string_required("CHAPA_ARTCRAFT_SECRET_KEY")?,
    api_base_url: easyenv::get_env_string_optional("CHAPA_ARTCRAFT_API_BASE_URL")
        .unwrap_or_else(|| "https://api.chapa.co/v1".to_string()),
    checkout_return_url: easyenv::get_env_string_required("CHAPA_ARTCRAFT_CHECKOUT_RETURN_URL")?,
    maybe_checkout_callback_url: easyenv::get_env_string_optional("CHAPA_ARTCRAFT_CALLBACK_URL"),
  }.to_config_with_client())
}