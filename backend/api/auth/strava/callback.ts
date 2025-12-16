import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface StravaTokenResponse {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: {
    id: number;
    firstname: string;
    lastname: string;
    profile: string;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`Authorization failed: ${error}`);
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing authorization code');
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return res.status(400).send(`Token exchange failed: ${errorText}`);
    }

    const data: StravaTokenResponse = await tokenResponse.json();

    // Store or update user in database
    const { error: dbError } = await supabase.from('users').upsert({
      strava_athlete_id: data.athlete.id,
      first_name: data.athlete.firstname,
      last_name: data.athlete.lastname,
      profile_picture_url: data.athlete.profile,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: new Date(data.expires_at * 1000).toISOString(),
    }, {
      onConflict: 'strava_athlete_id',
    });

    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).send(`Database error: ${dbError.message}`);
    }

    // Success page
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Strava Connected!</title>
          <style>
            body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
            .card { background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            h1 { color: #FC4C02; margin-bottom: 16px; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Connected!</h1>
            <p>Welcome, ${data.athlete.firstname}!</p>
            <p>Your Strava account is now linked.</p>
            <p>Athlete ID: ${data.athlete.id}</p>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('OAuth error:', err);
    return res.status(500).send('Internal server error');
  }
}
