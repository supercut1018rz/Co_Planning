import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { generateSidewalkGeometry } from '@/lib/geometry-utils';
import * as turf from '@turf/turf';

/**
 * API Route: Generate sidewalk from precise coordinates
 * POST /api/generate-sidewalk-precise
 * 
 * Input: Precise latitude and longitude coordinates for start and end points
 * Output: Road-aligned sidewalk GeoJSON
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      start_lat,
      start_lng,
      end_lat,
      end_lng,
      side = 'right',
      offset_meters = 5,
      width_m = 1.5,
      scenario = 'base'
    } = body;

    // Validate input
    if (!start_lat || !start_lng || !end_lat || !end_lng) {
      return NextResponse.json(
        { success: false, error: 'Missing required coordinate parameters' },
        { status: 400 }
      );
    }

    console.log('🎯 Generate sidewalk from precise coordinates:', {
      start: [start_lat, start_lng],
      end: [end_lat, end_lng],
      offset_meters,
      side
    });

    // Step 1: Create point objects for start and end points
    const startPoint = turf.point([start_lng, start_lat]);
    const endPoint = turf.point([end_lng, end_lat]);
    
    // Calculate distance between two points (for filtering candidate roads)
    const distance = turf.distance(startPoint, endPoint, { units: 'kilometers' });
    const searchRadius = Math.max(distance * 1.5, 0.5); // Search radius (kilometers)

    console.log(`📏 Distance between points: ${(distance * 1000).toFixed(2)}m, Search radius: ${(searchRadius * 1000).toFixed(2)}m`);

    // Step 2: Find the road closest to the start point in PostGIS
    // Use ST_DWithin and geography type for accurate distance in meters
    const nearbyRoadsQuery = `
      WITH start_point AS (
        SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS geog
      ),
      end_point AS (
        SELECT ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography AS geog
      )
      SELECT 
        r.id,
        r.osm_id,
        r.name,
        r.highway,
        ST_AsGeoJSON(r.geom) as geom_json,
        ST_Distance(r.geom::geography, (SELECT geog FROM start_point)) as start_distance,
        ST_Distance(r.geom::geography, (SELECT geog FROM end_point)) as end_distance,
        ST_Length(r.geom::geography) as length_m
      FROM roads_howard r
      WHERE ST_DWithin(
        r.geom::geography,
        (SELECT geog FROM start_point),
        $5  -- Search radius (meters)
      )
      ORDER BY 
        (ST_Distance(r.geom::geography, (SELECT geog FROM start_point)) +
         ST_Distance(r.geom::geography, (SELECT geog FROM end_point))) ASC
      LIMIT 5
    `;

    const candidateRoads = await query(nearbyRoadsQuery, [
      start_lng,
      start_lat,
      end_lng,
      end_lat,
      searchRadius * 1000  // Convert to meters
    ]);

    if (candidateRoads.rows.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `No road found within search radius ${(searchRadius * 1000).toFixed(0)}m. Please ensure coordinates are within Howard County and road data is imported.`,
          hint: 'Try increasing the search range or check if coordinates are correct'
        },
        { status: 404 }
      );
    }

    // Select the optimal road (minimum total distance to start and end points)
    const selectedRoad = candidateRoads.rows[0];
    
    console.log(`✅ Found ${candidateRoads.rows.length} candidate roads`);
    console.log(`🛣️  Selected road: ${selectedRoad.name || 'Unnamed'} (${selectedRoad.highway})`);
    console.log(`   Distance to start: ${parseFloat(selectedRoad.start_distance).toFixed(2)}m`);
    console.log(`   Distance to end: ${parseFloat(selectedRoad.end_distance).toFixed(2)}m`);

    // Step 3: Snap coordinate points to the road
    const roadGeometry = JSON.parse(selectedRoad.geom_json);
    const roadLine = turf.lineString(roadGeometry.coordinates);
    
    // Use Turf.js to find the nearest point on the road
    const snappedStart = turf.nearestPointOnLine(roadLine, startPoint);
    const snappedEnd = turf.nearestPointOnLine(roadLine, endPoint);
    
    // Get position on the line (0-1)
    const startLocation = snappedStart.properties.location || 0;
    const endLocation = snappedEnd.properties.location || 1;
    
    console.log(`📍 Snap results:`);
    console.log(`   Start point position on line: ${(startLocation * 100).toFixed(2)}%`);
    console.log(`   End point position on line: ${(endLocation * 100).toFixed(2)}%`);

    // Step 4: Extract road segment
    // Ensure start point is before end point
    const [minLoc, maxLoc] = startLocation < endLocation 
      ? [startLocation, endLocation]
      : [endLocation, startLocation];
    
    // Use lineSliceAlong to extract segment (based on distance)
    const roadLength = turf.length(roadLine, { units: 'kilometers' });
    const startDistance = minLoc * roadLength;
    const endDistance = maxLoc * roadLength;
    
    const targetSegment = turf.lineSliceAlong(
      roadLine,
      startDistance,
      endDistance,
      { units: 'kilometers' }
    );
    
    const segmentLength = turf.length(targetSegment, { units: 'meters' });
    console.log(`✂️  Extracted segment length: ${segmentLength.toFixed(2)}m`);

    // Step 5: Generate sidewalk (offset line)
    const sidewalkGeometry = generateSidewalkGeometry(
      targetSegment,
      offset_meters,
      side
    );

    // Step 6: Save sidewalk to database
    const sidewalkName = `Precise sidewalk${selectedRoad.name ? ` - ${selectedRoad.name}` : ''} (${side})`;
    
    const insertQuery = `
      INSERT INTO sidewalks_howard (
        name,
        side,
        width_m,
        source,
        road_id,
        scenario,
        status,
        properties,
        geom
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_GeomFromGeoJSON($9), 4326))
      RETURNING 
        id,
        name,
        ST_AsGeoJSON(geom) as geom_json,
        ST_Length(geom::geography) as length_m,
        created_at
    `;

    const result = await queryOne(insertQuery, [
      sidewalkName,
      side,
      width_m,
      'precise_coordinate',  // Mark as precise coordinate generation
      selectedRoad.id,
      scenario,
      'proposed',
      JSON.stringify({
        feature_type: 'sidewalk',
        source_type: 'precise_coordinate',
        start_coordinate: { lat: start_lat, lng: start_lng },
        end_coordinate: { lat: end_lat, lng: end_lng },
        offset_m: offset_meters,
        snap_distances: {
          start: parseFloat(selectedRoad.start_distance),
          end: parseFloat(selectedRoad.end_distance)
        },
        road_info: {
          name: selectedRoad.name,
          highway: selectedRoad.highway
        }
      }),
      JSON.stringify(sidewalkGeometry.geometry)
    ]);

    console.log('✅ Sidewalk saved to database, ID:', result.id);

    // Record to command history
    try {
      await query(
        `INSERT INTO command_history (command_text, parsed_json, sidewalk_id, scenario, success)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          `Precise coordinate: (${start_lat}, ${start_lng}) → (${end_lat}, ${end_lng})`,
          JSON.stringify({ start_lat, start_lng, end_lat, end_lng, side, offset_meters }),
          result.id,
          scenario,
          true
        ]
      );
    } catch (err) {
      console.error('Failed to save command history:', err);
    }

    return NextResponse.json({
      success: true,
      sidewalk: {
        id: result.id,
        name: sidewalkName,
        scenario,
        created_at: result.created_at,
        length_m: parseFloat(result.length_m)
      },
      geojson: {
        type: 'Feature',
        properties: {
          id: result.id,
          name: sidewalkName,
          scenario,
          side,
          length_m: parseFloat(result.length_m).toFixed(2),
          source: 'precise_coordinate'
        },
        geometry: JSON.parse(result.geom_json)
      },
      road_info: {
        name: selectedRoad.name,
        highway: selectedRoad.highway,
        start_snap_distance: parseFloat(selectedRoad.start_distance),
        end_snap_distance: parseFloat(selectedRoad.end_distance)
      },
      length_m: parseFloat(result.length_m)
    });

  } catch (error: any) {
    console.error('❌ Error generating precise sidewalk:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate sidewalk from precise coordinates',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

