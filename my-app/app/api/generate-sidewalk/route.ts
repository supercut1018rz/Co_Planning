import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, queryMany } from '@/lib/db';
import { generateSidewalkGeometry, extractRoadSegment } from '@/lib/geometry-utils';
import { ParsedCommand } from '@/lib/sidewalk-types';
import * as turf from '@turf/turf';

/**
 * API Route: Generate sidewalk geometry
 * POST /api/generate-sidewalk
 * 
 * Input: ParsedCommand (obtained from parse-command)
 * Output: Generated sidewalk GeoJSON + database ID
 */
export async function POST(request: NextRequest) {
  let body: any = {};
  let parsed: ParsedCommand | undefined;
  let scenario = 'base';
  
  try {
    body = await request.json();
    parsed = body.parsed || body;
    scenario = body.scenario || 'base';

    if (!parsed) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const hasCoordStart = parsed?.from?.type === 'coordinate' && parsed?.from?.lat && parsed?.from?.lon;
    const hasCoordEnd = parsed?.to?.type === 'coordinate' && parsed?.to?.lat && parsed?.to?.lon;
    const hasCoordinatePair = hasCoordStart && hasCoordEnd;

    // If user provided lat/lng coordinates, use "precise coordinate" flow, no street_name needed
    if (hasCoordinatePair && parsed.from && parsed.to) {
      const start_lat = Number(parsed.from.lat);
      const start_lng = Number(parsed.from.lon);
      const end_lat = Number(parsed.to.lat);
      const end_lng = Number(parsed.to.lon);
      const side = parsed.side || 'right';
      const offset_meters = parsed.width_m || 5;
      const width_m = parsed.width_m || 1.5;

      // Step A1: Calculate search radius
      const startPoint = turf.point([start_lng, start_lat]);
      const endPoint = turf.point([end_lng, end_lat]);
      const distance = turf.distance(startPoint, endPoint, { units: 'kilometers' });
      const searchRadius = Math.max(distance * 1.5, 0.5); // km

      // Step A2: Query candidate roads (same logic as /generate-sidewalk-precise)
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
          $5
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
        searchRadius * 1000
      ]);

      if (candidateRoads.rows.length === 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: `No road found within ${(searchRadius * 1000).toFixed(0)}m of the provided coordinates.`,
            hint: 'Ensure coordinates are inside Howard County and road data is imported.'
          },
          { status: 404 }
        );
      }

      // Step A3: Snap to nearest road and extract segment
      const selectedRoad = candidateRoads.rows[0];
      const roadGeometry = JSON.parse(selectedRoad.geom_json);
      const roadLine = turf.lineString(roadGeometry.coordinates);
      const snappedStart = turf.nearestPointOnLine(roadLine, startPoint);
      const snappedEnd = turf.nearestPointOnLine(roadLine, endPoint);
      const startLocation = snappedStart.properties.location || 0;
      const endLocation = snappedEnd.properties.location || 1;
      const [minLoc, maxLoc] = startLocation < endLocation ? [startLocation, endLocation] : [endLocation, startLocation];
      const roadLength = turf.length(roadLine, { units: 'kilometers' });
      const targetSegment = turf.lineSliceAlong(
        roadLine,
        minLoc * roadLength,
        maxLoc * roadLength,
        { units: 'kilometers' }
      );

      // Step A4: Generate offset line and save to database
      const sidewalkGeometry = generateSidewalkGeometry(
        targetSegment,
        offset_meters,
        side
      );

      const sidewalkName = `Sidewalk (coords)${selectedRoad.name ? ` - ${selectedRoad.name}` : ''} (${side})`;

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
          created_at,
          ST_Length(geom::geography) as length_m
      `;

      const result = await queryOne(insertQuery, [
        sidewalkName,
        side,
        width_m,
        'nlu_coordinate',
        selectedRoad.id,
        scenario,
        'proposed',
        JSON.stringify({
          feature_type: parsed.feature_type || 'sidewalk',
          command: body.command,
          source_type: 'nlu_coordinate',
          start_coordinate: { lat: start_lat, lng: start_lng },
          end_coordinate: { lat: end_lat, lng: end_lng },
          offset_m: offset_meters,
          road_info: {
            name: selectedRoad.name,
            highway: selectedRoad.highway
          }
        }),
        JSON.stringify(sidewalkGeometry.geometry)
      ]);

      try {
        await query(
          `INSERT INTO command_history (command_text, parsed_json, sidewalk_id, scenario, success)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            body.command || '',
            JSON.stringify(parsed),
            result.id,
            scenario,
            true
          ]
        );
      } catch (err) {
        console.error('Failed to save command history (coords):', err);
      }

      return NextResponse.json({
        success: true,
        sidewalk: {
          id: result.id,
          name: sidewalkName,
          scenario,
          created_at: result.created_at,
          properties: {
            road_name: selectedRoad.name,
            side,
            offset_m: offset_meters,
            source: 'nlu_coordinate'
          }
        },
        geojson: {
          type: 'Feature',
          properties: {
            id: result.id,
            name: sidewalkName,
            scenario,
            side,
            source: 'nlu_coordinate',
            length_m: parseFloat(result.length_m).toFixed(2)
          },
          geometry: JSON.parse(result.geom_json)
        }
      });
    }

    // Otherwise, use road name parsing flow
    if (!parsed.street_name) {
      return NextResponse.json(
        { success: false, error: 'Street name is required (or provide start/end coordinates)' },
        { status: 400 }
      );
    }

    // Step 1: Find target road in PostGIS
    const roadsQuery = `
      SELECT 
        id, 
        osm_id, 
        name, 
        highway,
        ST_AsGeoJSON(geom) as geom_json,
        ST_Length(geom::geography) as length_m
      FROM roads_howard
      WHERE name ILIKE $1
      ORDER BY length_m DESC
      LIMIT 5
    `;
    
    const roads = await queryMany(roadsQuery, [`%${parsed.street_name}%`]);
    
    if (roads.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Road "${parsed.street_name}" not found in Howard County database. Please ensure road data is imported.`,
          hint: 'Run the data import script: npm run db:import'
        },
        { status: 404 }
      );
    }

    // Select the first matching road (can add smarter selection logic in the future)
    const selectedRoad = roads[0];
    const roadGeometry = JSON.parse(selectedRoad.geom_json);
    const roadLine = turf.lineString(roadGeometry.coordinates);

    // Step 2: If from/to are specified, extract sub-segment
    let targetSegment = roadLine;
    
    if (parsed.from || parsed.to) {
      try {
        let startPoint: any = 0; // Default start point
        let endPoint: any = 1;   // Default end point
        
        // Handle from
        if (parsed.from) {
          if (parsed.from.type === 'coordinate' && parsed.from.lat && parsed.from.lon) {
            startPoint = turf.point([parsed.from.lon, parsed.from.lat]);
          } else if (parsed.from.type === 'intersection' && parsed.from.street) {
            // Find intersection street
            const intersectionQuery = `
              SELECT ST_AsGeoJSON(
                ST_Intersection(
                  (SELECT geom FROM roads_howard WHERE id = $1),
                  (SELECT geom FROM roads_howard WHERE name ILIKE $2 LIMIT 1)
                )
              ) as intersection
            `;
            const intersection = await queryOne(intersectionQuery, [
              selectedRoad.id,
              `%${parsed.from.street}%`
            ]);
            
            if (intersection && intersection.intersection) {
              const intersectionGeom = JSON.parse(intersection.intersection);
              if (intersectionGeom.type === 'Point') {
                startPoint = turf.point(intersectionGeom.coordinates);
              }
            }
          }
        }
        
        // Handle to
        if (parsed.to) {
          if (parsed.to.type === 'coordinate' && parsed.to.lat && parsed.to.lon) {
            endPoint = turf.point([parsed.to.lon, parsed.to.lat]);
          } else if (parsed.to.type === 'intersection' && parsed.to.street) {
            const intersectionQuery = `
              SELECT ST_AsGeoJSON(
                ST_Intersection(
                  (SELECT geom FROM roads_howard WHERE id = $1),
                  (SELECT geom FROM roads_howard WHERE name ILIKE $2 LIMIT 1)
                )
              ) as intersection
            `;
            const intersection = await queryOne(intersectionQuery, [
              selectedRoad.id,
              `%${parsed.to.street}%`
            ]);
            
            if (intersection && intersection.intersection) {
              const intersectionGeom = JSON.parse(intersection.intersection);
              if (intersectionGeom.type === 'Point') {
                endPoint = turf.point(intersectionGeom.coordinates);
              }
            }
          }
        }
        
        // Extract segment
        if (startPoint !== 0 || endPoint !== 1) {
          targetSegment = extractRoadSegment(roadLine, startPoint, endPoint);
        }
      } catch (error) {
        console.error('Error extracting road segment:', error);
        // If extraction fails, use the entire road
      }
    }

    // Step 3: Generate sidewalk line (lineOffset)
    const offsetMeters = parsed.width_m || 5; // Default offset 5 meters
    const sidewalkGeometry = generateSidewalkGeometry(
      targetSegment,
      offsetMeters,
      parsed.side
    );

    // Step 4: Save sidewalk to database
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
        created_at
    `;

    const sidewalkName = `Sidewalk along ${parsed.street_name}${parsed.side ? ` (${parsed.side} side)` : ''}`;
    
    const result = await queryOne(insertQuery, [
      sidewalkName,
      parsed.side || null,
      parsed.width_m || 1.5,
      'generated',
      selectedRoad.id,
      scenario,
      'proposed',
      JSON.stringify({
        feature_type: parsed.feature_type,
        command: body.command,
        offset_m: offsetMeters,
        county: parsed.county
      }),
      JSON.stringify(sidewalkGeometry.geometry)
    ]);

    // Record command history
    try {
      await query(
        `INSERT INTO command_history (command_text, parsed_json, sidewalk_id, scenario, success)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          body.command || '',
          JSON.stringify(parsed),
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
        properties: {
          road_name: parsed.street_name,
          side: parsed.side,
          offset_m: offsetMeters
        }
      },
      geojson: {
        type: 'Feature',
        properties: {
          id: result.id,
          name: sidewalkName,
          scenario,
          side: parsed.side
        },
        geometry: JSON.parse(result.geom_json)
      }
    });

  } catch (error: any) {
    console.error('Error generating sidewalk:', error);
    
    // Record failed command
    try {
      await query(
        `INSERT INTO command_history (command_text, parsed_json, scenario, success, error_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          body.command || '',
          JSON.stringify(parsed || {}),
          scenario,
          false,
          error.message
        ]
      );
    } catch (err) {
      console.error('Failed to save error log:', err);
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate sidewalk'
      },
      { status: 500 }
    );
  }
}

