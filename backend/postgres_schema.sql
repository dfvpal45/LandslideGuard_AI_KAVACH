-- PostgreSQL + PostGIS production schema for LandslideGuard AI.
-- The runnable demo continues to use SQLite unless DATABASE_URL is introduced.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('ADMIN', 'DISASTER_AUTHORITY', 'ANALYST', 'VIEWER');
CREATE TYPE risk_level AS ENUM ('Low', 'Moderate', 'High', 'Very High', 'Critical');

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'VIEWER',
  password_hash TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS geographical_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  state_name TEXT,
  boundary GEOMETRY(MultiPolygon, 4326),
  centroid GEOMETRY(Point, 4326),
  data_class TEXT NOT NULL DEFAULT 'demo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geographical_regions_boundary_gix ON geographical_regions USING GIST(boundary);

CREATE TABLE IF NOT EXISTS historical_landslides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES geographical_regions(id),
  event_time TIMESTAMPTZ NOT NULL,
  location GEOMETRY(Point, 4326) NOT NULL,
  severity TEXT,
  source TEXT,
  source_license TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS historical_landslides_location_gix ON historical_landslides USING GIST(location);

CREATE TABLE IF NOT EXISTS environmental_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES geographical_regions(id),
  observed_at TIMESTAMPTZ NOT NULL,
  location GEOMETRY(Point, 4326),
  rainfall_1h_mm NUMERIC,
  rainfall_6h_mm NUMERIC,
  rainfall_24h_mm NUMERIC,
  rainfall_72h_mm NUMERIC,
  temperature_c NUMERIC,
  humidity_pct NUMERIC,
  soil_moisture_pct NUMERIC,
  elevation_m NUMERIC,
  slope_deg NUMERIC,
  aspect_deg NUMERIC,
  curvature NUMERIC,
  vegetation_index NUMERIC,
  land_cover TEXT,
  source TEXT NOT NULL,
  data_class TEXT NOT NULL DEFAULT 'real'
);
CREATE INDEX IF NOT EXISTS environmental_observations_location_gix ON environmental_observations USING GIST(location);
CREATE INDEX IF NOT EXISTS environmental_observations_time_idx ON environmental_observations(observed_at);

CREATE TABLE IF NOT EXISTS infrastructure_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES geographical_regions(id),
  asset_type TEXT NOT NULL,
  name TEXT NOT NULL,
  location GEOMETRY(Point, 4326) NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  source TEXT,
  data_class TEXT NOT NULL DEFAULT 'demo'
);
CREATE INDEX IF NOT EXISTS infrastructure_assets_location_gix ON infrastructure_assets USING GIST(location);

CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES geographical_regions(id),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  location GEOMETRY(Point, 4326),
  probability NUMERIC NOT NULL CHECK (probability >= 0 AND probability <= 1),
  risk_level risk_level NOT NULL,
  confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  model_version TEXT NOT NULL,
  factors JSONB NOT NULL DEFAULT '[]',
  input_snapshot JSONB NOT NULL DEFAULT '{}',
  data_class TEXT NOT NULL DEFAULT 'model-generated'
);
CREATE INDEX IF NOT EXISTS predictions_location_gix ON predictions USING GIST(location);
CREATE INDEX IF NOT EXISTS predictions_observed_at_idx ON predictions(observed_at);

CREATE TABLE IF NOT EXISTS risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  region_id UUID REFERENCES geographical_regions(id),
  score NUMERIC NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID REFERENCES predictions(id),
  region_id UUID REFERENCES geographical_regions(id),
  severity risk_level NOT NULL,
  title TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS affected_infrastructure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID REFERENCES predictions(id),
  asset_id UUID REFERENCES infrastructure_assets(id),
  distance_m NUMERIC,
  impact_level risk_level NOT NULL,
  estimated_population INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS population_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID REFERENCES predictions(id),
  region_id UUID REFERENCES geographical_regions(id),
  estimated_population INTEGER NOT NULL,
  method TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS simulation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES geographical_regions(id),
  baseline_prediction_id UUID REFERENCES predictions(id),
  scenario_prediction_id UUID REFERENCES predictions(id),
  scenario_inputs JSONB NOT NULL,
  probability_change NUMERIC NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  actor_label TEXT NOT NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);

-- Example spatial query: assets within a 2.5 km risk buffer.
-- SELECT a.* FROM infrastructure_assets a JOIN predictions p ON p.id = $1
-- WHERE ST_DWithin(a.location::geography, p.location::geography, 2500);
