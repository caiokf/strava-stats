/**
 * Backfill script to load all Strava activities for a user
 *
 * Usage:
 *   npx ts-node scripts/backfill-activities.ts
 *
 * Requires environment variables:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_KEY
 *   - STRAVA_CLIENT_ID
 *   - STRAVA_CLIENT_SECRET
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  start_date: string;
  start_date_local: string;
  timezone: string;
  start_latlng: number[] | null;
  end_latlng: number[] | null;
  achievement_count: number;
  kudos_count: number;
  comment_count: number;
  athlete_count: number;
  photo_count: number;
  map: {
    polyline: string | null;
    summary_polyline: string | null;
  };
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  private: boolean;
  flagged: boolean;
  gear_id: string | null;
  average_speed: number;
  max_speed: number;
  average_cadence?: number;
  average_watts?: number;
  weighted_average_watts?: number;
  kilojoules?: number;
  device_watts?: boolean;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  suffer_score?: number;
  description?: string;
  workout_type?: number;
}

async function refreshToken(athleteId: number, refreshToken: string): Promise<string | null> {
  console.log("Refreshing access token...");

  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    console.error("Failed to refresh token:", await response.text());
    return null;
  }

  const data = await response.json() as { access_token: string; refresh_token: string; expires_at: number };

  // Update tokens in database
  await supabase
    .from("users")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: new Date(data.expires_at * 1000).toISOString(),
    })
    .eq("strava_athlete_id", athleteId);

  console.log("Token refreshed successfully");
  return data.access_token;
}

async function getAccessToken(athleteId: number): Promise<string | null> {
  const { data: user, error } = await supabase
    .from("users")
    .select("access_token, refresh_token, token_expires_at")
    .eq("strava_athlete_id", athleteId)
    .single();

  if (error || !user) {
    console.error("Failed to get user:", error);
    return null;
  }

  // Check if token is expired
  const expiresAt = new Date(user.token_expires_at);
  if (expiresAt <= new Date()) {
    return refreshToken(athleteId, user.refresh_token);
  }

  return user.access_token;
}

async function fetchActivitiesPage(accessToken: string, page: number, perPage: number = 100): Promise<StravaActivity[]> {
  const response = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    console.error("Failed to fetch activities:", await response.text());
    return [];
  }

  return response.json() as Promise<StravaActivity[]>;
}

async function fetchActivityDetails(activityId: number, accessToken: string): Promise<StravaActivity | null> {
  const response = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    console.error(`Failed to fetch activity ${activityId}:`, await response.text());
    return null;
  }

  return response.json() as Promise<StravaActivity>;
}

async function storeActivity(activity: StravaActivity, athleteId: number): Promise<void> {
  const { error } = await supabase.from("activities").upsert({
    id: activity.id,
    strava_athlete_id: athleteId,
    name: activity.name,
    type: activity.type,
    sport_type: activity.sport_type,
    distance: activity.distance,
    moving_time: activity.moving_time,
    elapsed_time: activity.elapsed_time,
    total_elevation_gain: activity.total_elevation_gain,
    start_date: activity.start_date,
    start_date_local: activity.start_date_local,
    timezone: activity.timezone,
    start_latlng: activity.start_latlng,
    end_latlng: activity.end_latlng,
    achievement_count: activity.achievement_count,
    kudos_count: activity.kudos_count,
    comment_count: activity.comment_count,
    athlete_count: activity.athlete_count,
    photo_count: activity.photo_count,
    map_polyline: activity.map?.polyline,
    map_summary_polyline: activity.map?.summary_polyline,
    trainer: activity.trainer,
    commute: activity.commute,
    manual: activity.manual,
    private: activity.private,
    flagged: activity.flagged,
    gear_id: activity.gear_id,
    average_speed: activity.average_speed,
    max_speed: activity.max_speed,
    average_cadence: activity.average_cadence,
    average_watts: activity.average_watts,
    weighted_average_watts: activity.weighted_average_watts,
    kilojoules: activity.kilojoules,
    device_watts: activity.device_watts,
    has_heartrate: activity.has_heartrate,
    average_heartrate: activity.average_heartrate,
    max_heartrate: activity.max_heartrate,
    calories: activity.calories,
    suffer_score: activity.suffer_score,
    description: activity.description,
    workout_type: activity.workout_type,
    raw_data: activity,
  });

  if (error) {
    console.error(`Failed to store activity ${activity.id}:`, error);
    throw error;
  }
}

async function backfillActivities(athleteId: number) {
  console.log(`\nStarting backfill for athlete ${athleteId}...\n`);

  const accessToken = await getAccessToken(athleteId);
  if (!accessToken) {
    console.error("Could not get access token");
    return;
  }

  let page = 1;
  let totalStored = 0;
  const perPage = 100;

  while (true) {
    console.log(`Fetching page ${page}...`);
    const activities = await fetchActivitiesPage(accessToken, page, perPage);

    if (activities.length === 0) {
      console.log("No more activities found");
      break;
    }

    console.log(`Found ${activities.length} activities on page ${page}`);

    for (const summaryActivity of activities) {
      try {
        // Fetch full activity details
        console.log(`  Fetching details for: ${summaryActivity.name} (${summaryActivity.id})`);
        const fullActivity = await fetchActivityDetails(summaryActivity.id, accessToken);

        if (fullActivity) {
          await storeActivity(fullActivity, athleteId);
          totalStored++;
          console.log(`  ✓ Stored: ${fullActivity.name}`);
        }

        // Rate limiting: Strava allows 100 requests per 15 minutes, 1000 per day
        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`  ✗ Failed to process activity ${summaryActivity.id}:`, error);
      }
    }

    if (activities.length < perPage) {
      console.log("Reached end of activities");
      break;
    }

    page++;
  }

  console.log(`\n✓ Backfill complete! Stored ${totalStored} activities.\n`);
}

// Main execution
const ATHLETE_ID = 34048034; // Your Strava athlete ID

backfillActivities(ATHLETE_ID).catch(console.error);
