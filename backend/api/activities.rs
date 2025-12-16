use serde::{Deserialize, Serialize};
use vercel_runtime::{run, Body, Error, Request, Response, StatusCode};

#[derive(Debug, Serialize, Deserialize)]
struct Activity {
    id: i64,
    name: String,
    #[serde(rename = "type")]
    activity_type: String,
    distance: f64,
    moving_time: i32,
    elapsed_time: i32,
    total_elevation_gain: f64,
    start_date: String,
    average_speed: Option<f64>,
    max_speed: Option<f64>,
    average_heartrate: Option<f64>,
    max_heartrate: Option<i32>,
    calories: Option<i32>,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(handler).await
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    match *req.method() {
        http::Method::GET => get_activities(req).await,
        _ => Ok(Response::builder()
            .status(StatusCode::METHOD_NOT_ALLOWED)
            .body(Body::Empty)?),
    }
}

async fn get_activities(_req: Request) -> Result<Response<Body>, Error> {
    let supabase_url = std::env::var("SUPABASE_URL").unwrap_or_default();
    let supabase_key = std::env::var("SUPABASE_SERVICE_KEY").unwrap_or_default();

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/rest/v1/activities?order=start_date.desc&limit=50", supabase_url))
        .header("apikey", &supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .send()
        .await;

    match response {
        Ok(res) => {
            let body = res.text().await.unwrap_or_else(|_| "[]".to_string());
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "application/json")
                .body(Body::Text(body))?)
        }
        Err(e) => Ok(Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .body(Body::Text(format!("Error: {}", e)))?),
    }
}
