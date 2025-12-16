use serde::{Deserialize, Serialize};
use vercel_runtime::{run, Body, Error, Request, Response, StatusCode};

#[derive(Debug, Deserialize)]
struct WebhookVerification {
    #[serde(rename = "hub.mode")]
    mode: Option<String>,
    #[serde(rename = "hub.challenge")]
    challenge: Option<String>,
    #[serde(rename = "hub.verify_token")]
    verify_token: Option<String>,
}

#[derive(Debug, Serialize)]
struct VerificationResponse {
    #[serde(rename = "hub.challenge")]
    challenge: String,
}

#[derive(Debug, Deserialize)]
struct WebhookEvent {
    object_type: String,
    object_id: i64,
    aspect_type: String,
    owner_id: i64,
    subscription_id: i64,
    event_time: i64,
    updates: Option<serde_json::Value>,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(handler).await
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    match *req.method() {
        http::Method::GET => handle_verification(req).await,
        http::Method::POST => handle_webhook(req).await,
        _ => Ok(Response::builder()
            .status(StatusCode::METHOD_NOT_ALLOWED)
            .body(Body::Empty)?),
    }
}

async fn handle_verification(req: Request) -> Result<Response<Body>, Error> {
    let query = req.uri().query().unwrap_or("");
    let params: WebhookVerification = serde_urlencoded::from_str(query).unwrap_or(WebhookVerification {
        mode: None,
        challenge: None,
        verify_token: None,
    });

    let verify_token = std::env::var("STRAVA_VERIFY_TOKEN").unwrap_or_default();

    match (params.mode.as_deref(), params.verify_token.as_deref(), params.challenge) {
        (Some("subscribe"), Some(token), Some(challenge)) if token == verify_token => {
            let response = VerificationResponse { challenge };
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "application/json")
                .body(Body::Text(serde_json::to_string(&response)?))?)
        }
        _ => Ok(Response::builder()
            .status(StatusCode::FORBIDDEN)
            .body(Body::Text("Verification failed".to_string()))?),
    }
}

async fn handle_webhook(req: Request) -> Result<Response<Body>, Error> {
    let body = match req.body() {
        Body::Text(text) => text.clone(),
        Body::Binary(bytes) => String::from_utf8_lossy(bytes).to_string(),
        _ => return Ok(Response::builder()
            .status(StatusCode::BAD_REQUEST)
            .body(Body::Text("Invalid body".to_string()))?),
    };

    let event: WebhookEvent = match serde_json::from_str(&body) {
        Ok(e) => e,
        Err(_) => return Ok(Response::builder()
            .status(StatusCode::BAD_REQUEST)
            .body(Body::Text("Invalid JSON".to_string()))?),
    };

    // Only process activity events
    if event.object_type == "activity" {
        match event.aspect_type.as_str() {
            "create" | "update" => {
                // TODO: Fetch full activity from Strava API and store in Supabase
                println!(
                    "Processing activity {} for athlete {}",
                    event.object_id, event.owner_id
                );
            }
            "delete" => {
                // TODO: Handle activity deletion
                println!("Activity {} deleted", event.object_id);
            }
            _ => {}
        }
    }

    Ok(Response::builder()
        .status(StatusCode::OK)
        .body(Body::Text("OK".to_string()))?)
}
