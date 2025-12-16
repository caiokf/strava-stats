use axum::{routing::get, Router};
use std::net::SocketAddr;
use tracing_subscriber;

mod webhook;

#[tokio::main]
async fn main() {
    tracing_subscriber::init();

    let app = Router::new()
        .route("/", get(|| async { "Strava Backend API" }))
        .route("/api/webhook", get(webhook::verify).post(webhook::handle));

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    tracing::info!("listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
