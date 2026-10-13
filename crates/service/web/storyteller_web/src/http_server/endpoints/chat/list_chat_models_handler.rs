use actix_web::web::Json;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ChatModelInfo {
  pub id: String,
  pub name: String,
  pub provider: String,
  pub cost_credits: u64,
  pub price_per_1m_tokens_etb: f64,
  pub input_price_per_1m_etb: f64,
  pub output_price_per_1m_etb: f64,
  pub badge: Option<String>,
  pub description: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ListChatModelsResponse {
  pub default_model: String,
  pub models: Vec<ChatModelInfo>,
}

pub async fn list_chat_models_handler() -> Json<ListChatModelsResponse> {
  Json(ListChatModelsResponse {
    default_model: "deepseek/deepseek-chat".to_string(),
    models: vec![
      ChatModelInfo {
        id: "deepseek/deepseek-chat".to_string(),
        name: "DeepSeek V3".to_string(),
        provider: "DeepSeek".to_string(),
        cost_credits: 1,
        price_per_1m_tokens_etb: 25.0,
        input_price_per_1m_etb: 18.0,
        output_price_per_1m_etb: 35.0,
        badge: Some("Popular".to_string()),
        description: "Fast, state-of-the-art reasoning and creative assistant (25 ETB / 1M tokens)".to_string(),
      },
      ChatModelInfo {
        id: "deepseek/deepseek-r1".to_string(),
        name: "DeepSeek R1".to_string(),
        provider: "DeepSeek".to_string(),
        cost_credits: 1,
        price_per_1m_tokens_etb: 170.0,
        input_price_per_1m_etb: 70.0,
        output_price_per_1m_etb: 275.0,
        badge: Some("Reasoning".to_string()),
        description: "Advanced chain-of-thought reasoning and complex math (170 ETB / 1M tokens)".to_string(),
      },
      ChatModelInfo {
        id: "anthropic/claude-3.5-sonnet".to_string(),
        name: "Claude 3.5 Sonnet".to_string(),
        provider: "Anthropic".to_string(),
        cost_credits: 1,
        price_per_1m_tokens_etb: 1100.0,
        input_price_per_1m_etb: 375.0,
        output_price_per_1m_etb: 1875.0,
        badge: Some("Best Quality".to_string()),
        description: "Benchmark-leading intelligence for creative composition (1,100 ETB / 1M tokens)".to_string(),
      },
      ChatModelInfo {
        id: "openai/gpt-4o".to_string(),
        name: "GPT-4o".to_string(),
        provider: "OpenAI".to_string(),
        cost_credits: 1,
        price_per_1m_tokens_etb: 780.0,
        input_price_per_1m_etb: 310.0,
        output_price_per_1m_etb: 1250.0,
        badge: Some("Omni".to_string()),
        description: "Versatile flagship model for text, reasoning, and analysis (780 ETB / 1M tokens)".to_string(),
      },
      ChatModelInfo {
        id: "meta-llama/llama-3.3-70b-instruct".to_string(),
        name: "Llama 3.3 70B".to_string(),
        provider: "Meta".to_string(),
        cost_credits: 1,
        price_per_1m_tokens_etb: 48.0,
        input_price_per_1m_etb: 45.0,
        output_price_per_1m_etb: 50.0,
        badge: Some("Open Weights".to_string()),
        description: "High-performance open-source conversational intelligence (48 ETB / 1M tokens)".to_string(),
      },
    ],
  })
}
