import type { VercelRequest, VercelResponse } from '@vercel/node';

// Redirects to Strava OAuth page
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/auth/strava/callback`;

  const scope = 'read,activity:read_all';

  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;

  return res.redirect(authUrl);
}
