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
  (
    "z-ai/glm-5.3-flash",
    "zhipu",
    ModelPricing {
      input_per_million: 8.46,
      output_per_million: 211.5,
    },
  ),
  (
    "deepseek/deepseek-v4-flash-0731",
    "deepseek",
    ModelPricing {
      input_per_million: 3.38,
      output_per_million: 135.36,
    },
  ),
  (
    "minimax/minimax-m2.7",
    "minimax",
    ModelPricing {
      input_per_million: 49.35,
      output_per_million: 197.4,
    },
  ),
  (
    "nvidia/nemotron-3.5-super-vl:free",
    "nvidia",
    ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
    },
  ),
  (
    "inception/mercury-decide:free",
    "inception",
    ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
    },
  ),
  (
    "respan/span-01-lite:free",
    "respan",
    ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
    },
  ),
  (
    "liquid/lfm-2.5-embedding-350m:free",
    "liquid",
    ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
    },
  ),
  (
    "dots-studio/dots-3-note-preview:free",
    "dots-studio",
    ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
    },
  ),
  (
    "liquid/lfm-2.5-2.6b:free",
    "liquid",
    ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
    },
  ),
  (
    "nvidia/nemotron-3.5-lightning:free",
    "nvidia",
    ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
    },
  ),
  (
    "thinkingmachines/inkling-small:free",
    "thinkingmachines",
    ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
    },
  ),
  (
    "poolside/laguna-s-2.1:free",
    "poolside",
    ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
    },
  ),
  (
    "thinkingmachines/inkling:free",
    "thinkingmachines",
    ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
    },
  ),
  (
    "cohere/north-mini-code:free",
    "cohere",
    ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
    },
  ),
  (
    "nvidia/nemotron-3.5-content-safety:free",
    "nvidia",
    ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
    },
  ),
  (
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "nvidia",
    ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
    },
  ),
  (
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "nvidia",
    ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
    },
  ),
  (
    "google/gemma-4-26b-a4b-it:free",
    "google",
    ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
    },
  ),
  (
    "google/gemma-4-31b-it:free",
    "google",
    ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
    },
  ),
  (
    "nvidia/nemotron-3-super-120b-a12b:free",
    "nvidia",
    ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
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
  if trimmed.ends_with(":free") {
    return ModelPricing {
      input_per_million: 0.0,
      output_per_million: 0.0,
    };
  }
  for (id, _, pricing) in SUPPORTED_CHAT_MODELS {
    if trimmed.eq_ignore_ascii_case(id) {
      return *pricing;
    }
  }
  DEFAULT_PRICING
}

use rust_decimal::Decimal;

/// Calculate credit deduction based on actual prompt and completion tokens.
/// 1 Credit = 1 ETB, rounded to 2 decimal places (0.01 credits = 1 ETB cent).
pub fn calculate_token_cost_credits(
  model_id: &str,
  prompt_tokens: u64,
  completion_tokens: u64,
) -> Decimal {
  let total_tokens = prompt_tokens + completion_tokens;
  if total_tokens == 0 {
    return Decimal::ZERO;
  }

  let pricing = get_model_pricing(model_id);
  // Free models charge 0 credits
  if pricing.input_per_million == 0.0 && pricing.output_per_million == 0.0 {
    return Decimal::ZERO;
  }

  let prompt_cost = (prompt_tokens as f64 * pricing.input_per_million) / 1_000_000.0;
  let completion_cost = (completion_tokens as f64 * pricing.output_per_million) / 1_000_000.0;
  let total_cost = prompt_cost + completion_cost;

  let calculated = Decimal::from_f64_retain(total_cost)
    .unwrap_or(Decimal::ZERO)
    .round_dp(2);

  // Minimum charge is 0.01 credits (1 ETB cent) if tokens were consumed
  let min_charge = Decimal::new(1, 2); // 0.01
  calculated.max(min_charge)
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
