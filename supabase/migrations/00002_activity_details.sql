-- Migration: Add JSONB columns for activity details (photos, laps, zones, splits)

-- Photos fetched from GET /activities/{id}/photos
ALTER TABLE activities ADD COLUMN IF NOT EXISTS photos JSONB;

-- Laps included in detailed activity response
ALTER TABLE activities ADD COLUMN IF NOT EXISTS laps JSONB;

-- Heart rate and power zones distribution
ALTER TABLE activities ADD COLUMN IF NOT EXISTS zones JSONB;

-- Kilometer splits (metric)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS splits_metric JSONB;

-- Mile splits (standard)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS splits_standard JSONB;
