use actix_http::body::MessageBody;
use actix_service::ServiceFactory;
use actix_web::dev::{ServiceRequest, ServiceResponse};
use actix_web::{web, App, Error, HttpResponse};
use crate::http_server::endpoints::chat::audio_speech_handler::audio_speech_handler;
use crate::http_server::endpoints::chat::chat_completions_handler::chat_completions_handler;
use crate::http_server::endpoints::chat::list_chat_models_handler::list_chat_models_handler;
use crate::http_server::endpoints::chat::models_handler::list_models_handler;

pub fn add_chat_routes<T, B>(app: App<T>) -> App<T>
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
  app
    .service(
      web::scope("/v1/chat")
        .service(
          web::resource("/completions")
            .route(web::post().to(chat_completions_handler))
            .route(web::head().to(|| HttpResponse::Ok())),
        )
        .service(
          web::resource("/models")
            .route(web::get().to(list_chat_models_handler))
            .route(web::head().to(|| HttpResponse::Ok())),
        ),
    )
    .service(
      web::scope("/v1/audio")
        .service(
          web::resource("/speech")
            .route(web::post().to(audio_speech_handler))
            .route(web::head().to(|| HttpResponse::Ok())),
        ),
    )
    .service(
      web::resource("/v1/models")
        .route(web::get().to(list_models_handler))
        .route(web::head().to(|| HttpResponse::Ok())),
    )
}
