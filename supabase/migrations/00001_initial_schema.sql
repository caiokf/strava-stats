-- Initial schema for Strava Stats

-- Users table (linked to Strava athletes)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strava_athlete_id BIGINT UNIQUE NOT NULL,
    email VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    profile_picture_url TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
    id BIGINT PRIMARY KEY,  -- Strava activity ID
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    strava_athlete_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    sport_type VARCHAR(50),
    distance DOUBLE PRECISION DEFAULT 0,
    moving_time INTEGER DEFAULT 0,
    elapsed_time INTEGER DEFAULT 0,
    total_elevation_gain DOUBLE PRECISION DEFAULT 0,
    start_date TIMESTAMPTZ NOT NULL,
    start_date_local TIMESTAMPTZ,
    timezone VARCHAR(100),
    start_latlng JSONB,
    end_latlng JSONB,
    achievement_count INTEGER DEFAULT 0,
    kudos_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    athlete_count INTEGER DEFAULT 1,
    photo_count INTEGER DEFAULT 0,
    map_polyline TEXT,
    map_summary_polyline TEXT,
    trainer BOOLEAN DEFAULT FALSE,
    commute BOOLEAN DEFAULT FALSE,
    manual BOOLEAN DEFAULT FALSE,
    private BOOLEAN DEFAULT FALSE,
    flagged BOOLEAN DEFAULT FALSE,
    gear_id VARCHAR(50),
    average_speed DOUBLE PRECISION,
    max_speed DOUBLE PRECISION,
    average_cadence DOUBLE PRECISION,
    average_watts DOUBLE PRECISION,
    weighted_average_watts INTEGER,
    kilojoules DOUBLE PRECISION,
    device_watts BOOLEAN,
    has_heartrate BOOLEAN DEFAULT FALSE,
    average_heartrate DOUBLE PRECISION,
    max_heartrate INTEGER,
    calories INTEGER,
    suffer_score INTEGER,
    description TEXT,
    workout_type INTEGER,
    raw_data JSONB,  -- Store full Strava response
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FIT files table
CREATE TABLE IF NOT EXISTS fit_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id BIGINT REFERENCES activities(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_size INTEGER,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_strava_athlete_id ON activities(strava_athlete_id);
CREATE INDEX IF NOT EXISTS idx_activities_start_date ON activities(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_fit_files_activity_id ON fit_files(activity_id);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activities_updated_at
    BEFORE UPDATE ON activities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE fit_files ENABLE ROW LEVEL SECURITY;

-- Policies (service role has full access by default)
-- These policies allow the backend service to manage all data
CREATE POLICY "Service role can manage users"
    ON users FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role can manage activities"
    ON activities FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role can manage fit_files"
    ON fit_files FOR ALL
    USING (true)
    WITH CHECK (true);
