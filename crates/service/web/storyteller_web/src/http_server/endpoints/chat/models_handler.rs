use actix_web::web::Json;
use actix_web::HttpResponse;
use serde::Serialize;

use super::chat_pricing::{get_available_models_catalog, ModelCatalogItem};

#[derive(Serialize)]
pub struct ListModelsResponse {
  pub object: &'static str,
  pub data: Vec<ModelCatalogItem>,
}

/// GET /v1/models - OpenAI-compatible model catalog endpoint.
pub async fn list_models_handler() -> HttpResponse {
  let models = get_available_models_catalog();
  HttpResponse::Ok().json(ListModelsResponse {
    object: "list",
    data: models,
  })
}
