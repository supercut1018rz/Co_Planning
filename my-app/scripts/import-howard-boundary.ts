/**
 * Import Howard County boundary into PostGIS
 *
 * Usage: npx tsx scripts/import-howard-boundary.ts
 */

import { query } from '../lib/db';

async function importHowardBoundary() {
  console.log('🌍 Fetching Howard County boundary...');

  try {
    const response = await fetch(
      'https://nominatim.openstreetmap.org/search?county=Howard&state=Maryland&country=USA&format=json&polygon_geojson=1&limit=1',
      {
        headers: {
          'User-Agent': 'Howard-Sidewalk-Planning-System/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.length === 0 || !data[0].geojson) {
      throw new Error('Howard County boundary not found');
    }

    const geojson = data[0].geojson;
    console.log(`✅ Boundary loaded, type: ${geojson.type}`);

    await query('DELETE FROM county_boundary WHERE name = $1', ['Howard County']);
    console.log('🗑️  Cleared existing boundary');

    const insertQuery = `
      INSERT INTO county_boundary (name, state, geom)
      VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326))
      RETURNING id, name, ST_Area(geom::geography)/1000000 as area_km2
    `;

    const result = await query(insertQuery, [
      'Howard County',
      'Maryland',
      JSON.stringify(geojson)
    ]);

    if (result.rows && result.rows.length > 0) {
      const boundary = result.rows[0];
      console.log(`✅ Howard County boundary imported`);
      console.log(`   ID: ${boundary.id}`);
      console.log(`   Area: ${parseFloat(boundary.area_km2).toFixed(2)} km²`);
    }

  } catch (error: any) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

importHowardBoundary().then(() => {
  console.log('✅ Boundary import done.');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
