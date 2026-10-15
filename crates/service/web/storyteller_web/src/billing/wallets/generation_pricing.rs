/// Centralized pricing configuration for non-chat generative models (image, video, audio, 3D mesh, splat).
///
/// Under the current exchange rate, 1 Credit = 1 ETB (previously 1 Credit = 2 ETB when $10 USD = 1,000 credits = 2,000 ETB).
/// Generative models have base pricing defined in USD cents (e.g. 4 cents for Flux, 50 cents for Kling).
/// To maintain consistent ETB pricing, non-chat USD-cent costs map to credits with a 2x multiplier (1 cent = 2 credits = 2 ETB).
pub const DEFAULT_NON_CHAT_CREDIT_MULTIPLIER: u64 = 2;

/// Get the active credit multiplier for non-chat generative models.
/// Can be overridden via the `NON_CHAT_CREDIT_MULTIPLIER` environment variable.
pub fn get_non_chat_credit_multiplier() -> u64 {
  easyenv::get_env_num::<u64>("NON_CHAT_CREDIT_MULTIPLIER", DEFAULT_NON_CHAT_CREDIT_MULTIPLIER)
    .unwrap_or(DEFAULT_NON_CHAT_CREDIT_MULTIPLIER)
}

/// Scale a base non-chat credit/cent amount by the active multiplier.
pub fn scale_non_chat_credits(base_cost: u64) -> u64 {
  base_cost.saturating_mul(get_non_chat_credit_multiplier())
}

/// Scale an optional base non-chat credit/cent amount by the active multiplier.
pub fn scale_non_chat_credits_opt(base_cost: Option<u64>) -> Option<u64> {
  base_cost.map(scale_non_chat_credits)
}
