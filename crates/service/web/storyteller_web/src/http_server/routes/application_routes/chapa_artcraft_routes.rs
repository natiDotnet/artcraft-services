use actix_http::body::MessageBody;
use actix_service::ServiceFactory;
use actix_web::dev::{ServiceRequest, ServiceResponse};
use actix_web::{web, App, Error, HttpResponse};
use billing_artcraft_component::endpoints::checkout::chapa_artcraft_create_checkout_handler::chapa_artcraft_create_checkout_handler;
use billing_artcraft_component::endpoints::verify::chapa_artcraft_verify_transaction_handler::chapa_artcraft_verify_transaction_handler;

pub fn add_chapa_artcraft_routes<T, B> (app: App<T>) -> App<T>
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
  app.service(web::scope("/v1/chapa_artcraft")
      .service(web::resource("/checkout")
          .route(web::post().to(chapa_artcraft_create_checkout_handler))
          .route(web::head().to(|| HttpResponse::Ok()))
      )
      .service(web::resource("/verify_transaction")
          .route(web::post().to(chapa_artcraft_verify_transaction_handler))
          .route(web::head().to(|| HttpResponse::Ok()))
      )
  )
}