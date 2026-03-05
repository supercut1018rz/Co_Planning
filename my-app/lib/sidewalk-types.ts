// Structured command after natural language parsing
export interface ParsedCommand {
  feature_type: 'sidewalk' | 'bike_lane' | 'crosswalk';
  county: string;
  street_name?: string;
  side?: 'left' | 'right' | 'north' | 'south' | 'east' | 'west' | 'both';
  width_m?: number;
  from?: LocationSpec;
  to?: LocationSpec;
  properties?: Record<string, any>;
}

export interface LocationSpec {
  type: 'intersection' | 'coordinate' | 'landmark';
  street?: string;
  lat?: number;
  lon?: number;
  landmark?: string;
}

// Road data
export interface Road {
  id: number;
  osm_id: number;
  name: string;
  highway: string;
  geom: any; // GeoJSON geometry
  properties: Record<string, any>;
}

// Sidewalk data
export interface Sidewalk {
  id?: number;
  name: string;
  side?: string;
  width_m?: number;
  surface?: string;
  source: 'osm' | 'generated' | 'manual';
  road_id?: number;
  scenario: string;
  status: 'existing' | 'proposed' | 'approved';
  properties: Record<string, any>;
  geom: any; // GeoJSON geometry
  created_at?: string;
}

// API response types
export interface SidewalkGenerationResponse {
  success: boolean;
  sidewalk?: Sidewalk;
  geojson?: any;
  error?: string;
  message?: string;
}

export interface CommandParseResponse {
  success: boolean;
  parsed?: ParsedCommand;
  error?: string;
}

// Scenario management
export interface Scenario {
  id: number;
  name: string;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

