-- Howard County Sidewalk Planning System
-- DB init script
-- Usage: psql -d howard_sidewalk_db -f scripts/setup-database.sql

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

SELECT PostGIS_Full_Version();

-- ======================================
-- 1. Roads (from OSM)
-- ======================================
CREATE TABLE IF NOT EXISTS roads_howard (
  id SERIAL PRIMARY KEY,
  osm_id BIGINT UNIQUE,
  name TEXT,
  highway TEXT,
  surface TEXT,
  lanes INTEGER,
  maxspeed TEXT,
  oneway BOOLEAN DEFAULT false,
  geom geometry(LINESTRING, 4326),
  properties JSONB,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roads_geom ON roads_howard USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_roads_name ON roads_howard(name);
CREATE INDEX IF NOT EXISTS idx_roads_highway ON roads_howard(highway);

-- ======================================
-- 2. Sidewalks (generated + existing)
-- ======================================
CREATE TABLE IF NOT EXISTS sidewalks_howard (
  id SERIAL PRIMARY KEY,
  name TEXT,
  side TEXT,
  width_m FLOAT DEFAULT 1.5,
  surface TEXT,
  source TEXT DEFAULT 'generated',
  road_id INTEGER REFERENCES roads_howard(id),
  scenario TEXT DEFAULT 'base',
  status TEXT DEFAULT 'proposed',
  properties JSONB,
  geom geometry(LINESTRING, 4326),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sidewalks_geom ON sidewalks_howard USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_sidewalks_scenario ON sidewalks_howard(scenario);
CREATE INDEX IF NOT EXISTS idx_sidewalks_status ON sidewalks_howard(status);
CREATE INDEX IF NOT EXISTS idx_sidewalks_road_id ON sidewalks_howard(road_id);

-- ======================================
-- 3. Intersections (optional)
-- ======================================
CREATE TABLE IF NOT EXISTS intersections_howard (
  id SERIAL PRIMARY KEY,
  osm_id BIGINT,
  name TEXT,
  traffic_signals BOOLEAN DEFAULT false,
  crossing BOOLEAN DEFAULT false,
  geom geometry(POINT, 4326),
  properties JSONB,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intersections_geom ON intersections_howard USING GIST(geom);

-- ======================================
-- 4. County boundary (Howard County)
-- ======================================
CREATE TABLE IF NOT EXISTS county_boundary (
  id SERIAL PRIMARY KEY,
  name TEXT DEFAULT 'Howard County',
  state TEXT DEFAULT 'Maryland',
  geom geometry(POLYGON, 4326),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boundary_geom ON county_boundary USING GIST(geom);

-- ======================================
-- 5. Scenarios
-- ======================================
CREATE TABLE IF NOT EXISTS scenarios (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

INSERT INTO scenarios (name, description) VALUES 
  ('base', 'Base scenario'),
  ('plan_a', 'Plan A'),
  ('plan_b', 'Plan B')
ON CONFLICT (name) DO NOTHING;

-- ======================================
-- 6. Command history
-- ======================================
CREATE TABLE IF NOT EXISTS command_history (
  id SERIAL PRIMARY KEY,
  command_text TEXT NOT NULL,
  parsed_json JSONB,
  sidewalk_id INTEGER REFERENCES sidewalks_howard(id),
  scenario TEXT,
  user_id TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_command_history_created ON command_history(created_at);
CREATE INDEX IF NOT EXISTS idx_command_history_scenario ON command_history(scenario);

-- ======================================
-- 7. Helper functions
-- ======================================

CREATE OR REPLACE FUNCTION get_road_bearing(geom geometry)
RETURNS FLOAT AS $$
DECLARE
  start_point geometry;
  end_point geometry;
  dx FLOAT;
  dy FLOAT;
  bearing FLOAT;
BEGIN
  start_point := ST_StartPoint(geom);
  end_point := ST_EndPoint(geom);
  
  dx := ST_X(end_point) - ST_X(start_point);
  dy := ST_Y(end_point) - ST_Y(start_point);
  
  bearing := degrees(atan2(dy, dx));
  
  IF bearing < 0 THEN
    bearing := bearing + 360;
  END IF;
  
  RETURN bearing;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION calculate_offset_sign(bearing FLOAT, side TEXT)
RETURNS INTEGER AS $$
BEGIN
  CASE
    WHEN side IN ('left', 'west', 'south') THEN RETURN -1;
    WHEN side IN ('right', 'east', 'north') THEN RETURN 1;
    ELSE RETURN 1;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ======================================
-- 8. Verify
-- ======================================
SELECT 'Database setup complete!' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE '%howard%'
ORDER BY table_name;

