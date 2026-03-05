import { NextRequest, NextResponse } from 'next/server';
import { query, queryMany, queryOne } from '@/lib/db';

/**
 * API Route: Manage sidewalk data
 * GET /api/sidewalks - Get all sidewalks
 * GET /api/sidewalks?scenario=plan_a - Get sidewalks for a specific scenario
 * DELETE /api/sidewalks/:id - Delete sidewalk
 * PUT /api/sidewalks/:id - Update sidewalk
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const scenario = searchParams.get('scenario') || 'base';
    const status = searchParams.get('status'); // existing, proposed, approved
    const includeOsm = searchParams.get('include_osm') === 'true'; // Whether to include OSM imported base data

    // Default: exclude OSM imported data (base data), only show user-generated/edited data
    let whereClause = 'WHERE scenario = $1';
    const params: any[] = [scenario];

    if (!includeOsm) {
      whereClause += ' AND (source IS NULL OR source != $' + (params.length + 1) + ')';
      params.push('osm');
    }

    if (status) {
      whereClause += ' AND status = $' + (params.length + 1);
      params.push(status);
    }

    const sidewalksQuery = `
      SELECT 
        s.id,
        s.name,
        s.side,
        s.width_m,
        s.surface,
        s.source,
        s.road_id,
        s.scenario,
        s.status,
        s.properties,
        s.created_at,
        r.name as road_name,
        ST_AsGeoJSON(s.geom) as geom_json,
        ST_Length(s.geom::geography) as length_m
      FROM sidewalks_howard s
      LEFT JOIN roads_howard r ON s.road_id = r.id
      ${whereClause}
      ORDER BY s.created_at DESC
    `;

    const sidewalks = await queryMany(sidewalksQuery, params);

    // Convert to GeoJSON FeatureCollection
    const features = sidewalks.map((sw: any) => ({
      type: 'Feature',
      id: sw.id,
      properties: {
        id: sw.id,
        name: sw.name,
        side: sw.side,
        width_m: sw.width_m,
        surface: sw.surface,
        source: sw.source,
        road_id: sw.road_id,
        road_name: sw.road_name,
        scenario: sw.scenario,
        status: sw.status,
        length_m: parseFloat(sw.length_m).toFixed(2),
        created_at: sw.created_at,
        ...sw.properties
      },
      geometry: JSON.parse(sw.geom_json)
    }));

    return NextResponse.json({
      success: true,
      type: 'FeatureCollection',
      features,
      count: features.length,
      scenario
    });

  } catch (error: any) {
    console.error('Error fetching sidewalks:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch sidewalks'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete sidewalk
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    console.log('🗑️  DELETE request - ID:', id);

    if (!id) {
      console.error('❌ Missing ID parameter');
      return NextResponse.json(
        { success: false, error: 'Sidewalk ID is required' },
        { status: 400 }
      );
    }

    // First check if record exists
    const existing = await queryOne(
      'SELECT id, name FROM sidewalks_howard WHERE id = $1',
      [id]
    );

    if (!existing) {
      console.error(`❌ Sidewalk ID ${id} does not exist`);
      return NextResponse.json(
        { success: false, error: `Sidewalk ID ${id} does not exist` },
        { status: 404 }
      );
    }

    console.log(`📝 Preparing to delete: ${existing.name} (ID: ${id})`);

    // First delete associated command history records (to resolve foreign key constraints)
    const historyDeleteResult = await query(
      'DELETE FROM command_history WHERE sidewalk_id = $1',
      [id]
    );
    console.log(`🗑️  Deleted ${historyDeleteResult.rowCount} related history records`);

    // Then delete the sidewalk itself
    const result = await query('DELETE FROM sidewalks_howard WHERE id = $1', [id]);

    console.log(`✅ Delete successful - affected rows: ${result.rowCount}`);

    return NextResponse.json({
      success: true,
      message: `Sidewalk ${id} deleted successfully`,
      deleted: {
        id: existing.id,
        name: existing.name
      }
    });

  } catch (error: any) {
    console.error('❌ Error occurred while deleting sidewalk:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete sidewalk',
        errorCode: error.code,
        errorDetail: error.detail
      },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update sidewalk
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, side, width_m, status, properties, geometry } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Sidewalk ID is required' },
        { status: 400 }
      );
    }

    let updateQuery = 'UPDATE sidewalks_howard SET updated_at = now()';
    const params: any[] = [];
    let paramIndex = 1;

    if (name) {
      updateQuery += `, name = $${paramIndex++}`;
      params.push(name);
    }
    if (side) {
      updateQuery += `, side = $${paramIndex++}`;
      params.push(side);
    }
    if (width_m) {
      updateQuery += `, width_m = $${paramIndex++}`;
      params.push(width_m);
    }
    if (status) {
      updateQuery += `, status = $${paramIndex++}`;
      params.push(status);
    }
    if (properties) {
      updateQuery += `, properties = $${paramIndex++}`;
      params.push(JSON.stringify(properties));
    }
    if (geometry) {
      updateQuery += `, geom = ST_SetSRID(ST_GeomFromGeoJSON($${paramIndex++}), 4326)`;
      params.push(JSON.stringify(geometry));
    }

    updateQuery += ` WHERE id = $${paramIndex}`;
    params.push(id);

    await query(updateQuery, params);

    return NextResponse.json({
      success: true,
      message: `Sidewalk ${id} updated successfully`
    });

  } catch (error: any) {
    console.error('Error updating sidewalk:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update sidewalk'
      },
      { status: 500 }
    );
  }
}

