import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface StravaWebhookEvent {
  object_type: 'activity' | 'athlete';
  object_id: number;
  aspect_type: 'create' | 'update' | 'delete';
  owner_id: number;
  subscription_id: number;
  event_time: number;
  updates?: Record<string, unknown>;
}

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

async function getStravaAccessToken(athleteId: number): Promise<string | null> {
  // Get stored token from database
  const { data: user, error } = await supabase
    .from('users')
    .select('access_token, refresh_token, token_expires_at')
    .eq('strava_athlete_id', athleteId)
    .single();

  if (error) {
    console.error(`Database error for athlete ${athleteId}:`, error);
    return null;
  }

  if (!user) {
    console.error(`No user found for athlete ${athleteId}`);
    return null;
  }

  // Check if token is expired
  const expiresAt = new Date(user.token_expires_at);
  if (expiresAt <= new Date()) {
    // Refresh the token
    const refreshed = await refreshStravaToken(athleteId, user.refresh_token);
    return refreshed;
  }

  return user.access_token;
}

async function refreshStravaToken(athleteId: number, refreshToken: string): Promise<string | null> {
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    console.error('Failed to refresh token:', await response.text());
    return null;
  }

  const data = await response.json();

  // Update tokens in database
  await supabase
    .from('users')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: new Date(data.expires_at * 1000).toISOString(),
    })
    .eq('strava_athlete_id', athleteId);

  return data.access_token;
}

async function fetchStravaActivity(activityId: number, accessToken: string): Promise<StravaActivity | null> {
  const response = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    console.error('Failed to fetch activity:', await response.text());
    return null;
  }

  return response.json();
}

async function storeActivity(activity: StravaActivity, athleteId: number): Promise<void> {
  const { error } = await supabase.from('activities').upsert({
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
    console.error('Failed to store activity:', error);
    throw error;
  }
}

async function deleteActivity(activityId: number): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', activityId);

  if (error) {
    console.error('Failed to delete activity:', error);
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET - Webhook verification
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const challenge = req.query['hub.challenge'];
    const verifyToken = req.query['hub.verify_token'];

    if (mode === 'subscribe' && verifyToken === process.env.STRAVA_VERIFY_TOKEN) {
      console.log('Webhook verified');
      return res.status(200).json({ 'hub.challenge': challenge });
    }

    return res.status(403).send('Verification failed');
  }

  // POST - Webhook event
  if (req.method === 'POST') {
    const event = req.body as StravaWebhookEvent;
    console.log('Received webhook event:', event);

    // Only process activity events
    if (event.object_type !== 'activity') {
      return res.status(200).send('OK');
    }

    try {
      if (event.aspect_type === 'create' || event.aspect_type === 'update') {
        const accessToken = await getStravaAccessToken(event.owner_id);
        if (!accessToken) {
          console.error('No access token for athlete:', event.owner_id);
          return res.status(200).send('OK'); // Still return 200 to Strava
        }

        const activity = await fetchStravaActivity(event.object_id, accessToken);
        if (activity) {
          await storeActivity(activity, event.owner_id);
          console.log(`Stored activity ${event.object_id}`);
        }
      } else if (event.aspect_type === 'delete') {
        await deleteActivity(event.object_id);
        console.log(`Deleted activity ${event.object_id}`);
      }

      return res.status(200).send('OK');
    } catch (error) {
      console.error('Error processing webhook:', error);
      return res.status(200).send('OK'); // Still return 200 to avoid retries
    }
  }

  return res.status(405).send('Method not allowed');
}
