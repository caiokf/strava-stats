-- Migration: Add JSONB columns for activity details (photos, laps, zones, splits)

-- Photos included in detailed activity response
ALTER TABLE activities ADD COLUMN IF NOT EXISTS photos JSONB;

-- Laps included in detailed activity response
ALTER TABLE activities ADD COLUMN IF NOT EXISTS laps JSONB;

-- Heart rate and power zones distribution (requires separate API call)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS zones JSONB;

-- Kilometer splits (metric)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS splits_metric JSONB;

-- Mile splits (standard)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS splits_standard JSONB;

-- Activity Streams table
-- Stores time-series data from GET /activities/{id}/streams
-- Each stream type is stored as a separate record
CREATE TABLE IF NOT EXISTS activity_streams (
    activity_id BIGINT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    stream_type VARCHAR(20) NOT NULL,  -- time, latlng, heartrate, watts, cadence, altitude, distance, velocity_smooth, grade_smooth, temp, moving
    series_type VARCHAR(20),  -- e.g., 'distance' or 'time'
    original_size INTEGER,
    resolution VARCHAR(10),  -- 'low', 'medium', 'high'
    data JSONB NOT NULL,  -- The actual stream data array
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (activity_id, stream_type)
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_activity_streams_activity_id ON activity_streams(activity_id);

-- Row Level Security
ALTER TABLE activity_streams ENABLE ROW LEVEL SECURITY;

-- Policy (service role has full access)
CREATE POLICY "Service role can manage activity_streams"
    ON activity_streams FOR ALL
    USING (true)
    WITH CHECK (true);
