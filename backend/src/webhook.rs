use axum::{
    extract::Query,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct WebhookVerification {
    #[serde(rename = "hub.mode")]
    pub mode: String,
    #[serde(rename = "hub.challenge")]
    pub challenge: String,
    #[serde(rename = "hub.verify_token")]
    pub verify_token: String,
}

#[derive(Debug, Serialize)]
pub struct VerificationResponse {
    #[serde(rename = "hub.challenge")]
    pub challenge: String,
}

#[derive(Debug, Deserialize)]
pub struct WebhookEvent {
    pub object_type: String,
    pub object_id: i64,
    pub aspect_type: String,
    pub owner_id: i64,
    pub subscription_id: i64,
    pub event_time: i64,
    pub updates: Option<serde_json::Value>,
}

/// GET /api/webhook - Strava webhook verification
pub async fn verify(
    Query(params): Query<WebhookVerification>,
) -> Result<Json<VerificationResponse>, StatusCode> {
    let verify_token = std::env::var("STRAVA_VERIFY_TOKEN").unwrap_or_default();

    if params.mode == "subscribe" && params.verify_token == verify_token {
        tracing::info!("Webhook verified successfully");
        Ok(Json(VerificationResponse {
            challenge: params.challenge,
        }))
    } else {
        tracing::warn!("Webhook verification failed");
        Err(StatusCode::FORBIDDEN)
    }
}

/// POST /api/webhook - Receive Strava webhook events
pub async fn handle(
    Json(event): Json<WebhookEvent>,
) -> StatusCode {
    tracing::info!("Received webhook event: {:?}", event);

    // Only process activity events
    if event.object_type != "activity" {
        return StatusCode::OK;
    }

    match event.aspect_type.as_str() {
        "create" | "update" => {
            // TODO: Fetch full activity from Strava API
            // TODO: Store activity in Supabase
            tracing::info!(
                "Processing activity {} for athlete {}",
                event.object_id,
                event.owner_id
            );
        }
        "delete" => {
            // TODO: Handle activity deletion
            tracing::info!("Activity {} deleted", event.object_id);
        }
        _ => {}
    }

    StatusCode::OK
}
