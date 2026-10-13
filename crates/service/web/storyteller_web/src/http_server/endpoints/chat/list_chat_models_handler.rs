use actix_web::web::Json;
use actix_web::HttpResponse;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ChatModelInfo {
  pub id: String,
  pub name: String,
  pub provider: String,
  pub cost_credits: u64,
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
        badge: Some("Popular".to_string()),
        description: "High speed, state-of-the-art coding and creative assistant".to_string(),
      },
      ChatModelInfo {
        id: "deepseek/deepseek-r1".to_string(),
        name: "DeepSeek R1".to_string(),
        provider: "DeepSeek".to_string(),
        cost_credits: 1,
        badge: Some("Reasoning".to_string()),
        description: "Advanced chain-of-thought reasoning and complex planning".to_string(),
      },
      ChatModelInfo {
        id: "anthropic/claude-3.5-sonnet".to_string(),
        name: "Claude 3.5 Sonnet".to_string(),
        provider: "Anthropic".to_string(),
        cost_credits: 1,
        badge: Some("Best Quality".to_string()),
        description: "Benchmark-leading intelligence for creative composition".to_string(),
      },
      ChatModelInfo {
        id: "openai/gpt-4o".to_string(),
        name: "GPT-4o".to_string(),
        provider: "OpenAI".to_string(),
        cost_credits: 1,
        badge: Some("Omni".to_string()),
        description: "Versatile flagship model for text and visual reasoning".to_string(),
      },
      ChatModelInfo {
        id: "meta-llama/llama-3.3-70b-instruct".to_string(),
        name: "Llama 3.3 70B".to_string(),
        provider: "Meta".to_string(),
        cost_credits: 1,
        badge: Some("Open Weights".to_string()),
        description: "Fast, accurate, open-weights conversational intelligence".to_string(),
      },
    ],
  })
}
