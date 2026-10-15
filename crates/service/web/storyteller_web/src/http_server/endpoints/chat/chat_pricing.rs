use serde::Serialize;

#[derive(Clone, Copy, Debug)]
pub struct ModelPricing {
  pub input_per_million: f64,
  pub output_per_million: f64,
}

#[derive(Serialize, Clone, Debug)]
pub struct ModelCatalogItem {
  pub id: &'static str,
  pub object: &'static str,
  pub created: u64,
  pub owned_by: &'static str,
}

pub const SUPPORTED_CHAT_MODELS: &[(&str, &str, ModelPricing)] = &[
  (
    "deepseek/deepseek-chat",
    "deepseek",
    ModelPricing {
      input_per_million: 20.0,
      output_per_million: 40.0,
    },
  ),
  (
    "deepseek/deepseek-r1",
    "deepseek",
    ModelPricing {
      input_per_million: 35.0,
      output_per_million: 70.0,
    },
  ),
  (
    "openai/gpt-4o",
    "openai",
    ModelPricing {
      input_per_million: 150.0,
      output_per_million: 300.0,
    },
  ),
  (
    "openai/gpt-4o-mini",
    "openai",
    ModelPricing {
      input_per_million: 20.0,
      output_per_million: 40.0,
    },
  ),
  (
    "openai/o3-mini",
    "openai",
    ModelPricing {
      input_per_million: 75.0,
      output_per_million: 150.0,
    },
  ),
  (
    "openai/o1",
    "openai",
    ModelPricing {
      input_per_million: 350.0,
      output_per_million: 700.0,
    },
  ),
  (
    "anthropic/claude-3.5-sonnet",
    "anthropic",
    ModelPricing {
      input_per_million: 180.0,
      output_per_million: 450.0,
    },
  ),
  (
    "anthropic/claude-3.5-haiku",
    "anthropic",
    ModelPricing {
      input_per_million: 40.0,
      output_per_million: 100.0,
    },
  ),
  (
    "meta-llama/llama-3.3-70b-instruct",
    "meta",
    ModelPricing {
      input_per_million: 25.0,
      output_per_million: 50.0,
    },
  ),
  (
    "google/gemini-2.0-flash-001",
    "google",
    ModelPricing {
      input_per_million: 20.0,
      output_per_million: 40.0,
    },
  ),
  (
    "thudm/glm-4-9b-chat",
    "zhipu",
    ModelPricing {
      input_per_million: 15.0,
      output_per_million: 30.0,
    },
  ),
  (
    "zhipu/glm-4",
    "zhipu",
    ModelPricing {
      input_per_million: 50.0,
      output_per_million: 100.0,
    },
  ),
];

const DEFAULT_PRICING: ModelPricing = ModelPricing {
  input_per_million: 25.0,
  output_per_million: 50.0,
};

/// Get the pricing rules for a model ID.
pub fn get_model_pricing(model_id: &str) -> ModelPricing {
  let trimmed = model_id.trim();
  for (id, _, pricing) in SUPPORTED_CHAT_MODELS {
    if trimmed.eq_ignore_ascii_case(id) {
      return *pricing;
    }
  }
  DEFAULT_PRICING
}

/// Calculate credit deduction based on actual prompt and completion tokens.
/// 1 Credit = 1 ETB.
pub fn calculate_token_cost_credits(
  model_id: &str,
  prompt_tokens: u64,
  completion_tokens: u64,
) -> u64 {
  let total_tokens = prompt_tokens + completion_tokens;
  if total_tokens == 0 {
    return 0;
  }

  let pricing = get_model_pricing(model_id);
  let prompt_cost = (prompt_tokens as f64 * pricing.input_per_million) / 1_000_000.0;
  let completion_cost = (completion_tokens as f64 * pricing.output_per_million) / 1_000_000.0;
  let total_cost = prompt_cost + completion_cost;

  // Minimum charge is 1 credit if tokens were consumed
  (total_cost.ceil() as u64).max(1)
}

/// Return list of models in standard OpenAI `/v1/models` format.
pub fn get_available_models_catalog() -> Vec<ModelCatalogItem> {
  SUPPORTED_CHAT_MODELS
    .iter()
    .map(|(id, owner, _)| ModelCatalogItem {
      id,
      object: "model",
      created: 1700000000,
      owned_by: owner,
    })
    .collect()
}
