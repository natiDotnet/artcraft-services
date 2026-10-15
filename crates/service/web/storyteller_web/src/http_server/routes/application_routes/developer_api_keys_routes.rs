use actix_http::body::MessageBody;
use actix_service::ServiceFactory;
use actix_web::dev::{ServiceRequest, ServiceResponse};
use actix_web::{web, App, Error, HttpResponse};

use crate::http_server::endpoints::developer_api_keys::{
  create_developer_api_key_handler,
  delete_developer_api_key_handler,
  list_developer_api_keys_handler,
  sync_developer_spend_handler,
};

pub fn add_developer_api_keys_routes<T, B>(app: App<T>) -> App<T>
where
  B: MessageBody,
  T: ServiceFactory<
    ServiceRequest,
    Config = (),
    Response = ServiceResponse<B>,
    Error = Error,
    InitError = (),
  >,
{
  app.service(
    web::scope("/v1/developer_api_keys")
      .service(
        web::resource("/create")
          .route(web::post().to(create_developer_api_key_handler))
          .route(web::head().to(|| HttpResponse::Ok())),
      )
      .service(
        web::resource("/list")
          .route(web::get().to(list_developer_api_keys_handler))
          .route(web::head().to(|| HttpResponse::Ok())),
      )
      .service(
        web::resource("/delete")
          .route(web::post().to(delete_developer_api_key_handler))
          .route(web::head().to(|| HttpResponse::Ok())),
      )
      .service(
        web::resource("/sync_spend")
          .route(web::post().to(sync_developer_spend_handler))
          .route(web::get().to(sync_developer_spend_handler))
          .route(web::head().to(|| HttpResponse::Ok())),
      ),
  )
}
