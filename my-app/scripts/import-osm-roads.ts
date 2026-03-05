/**
 * Import Howard County road network from OpenStreetMap into PostGIS
 * Usage: npx tsx scripts/import-osm-roads.ts
 * Note: Fetches from Overpass API; may take a few minutes.
 */

import { query, queryOne } from '../lib/db';

async function importRoads() {
  console.log('🛣️  Importing Howard County roads...');

  try {
    const boundaryResult = await queryOne(
      'SELECT ST_AsGeoJSON(geom) as geom FROM county_boundary WHERE name = $1',
      ['Howard County']
    );

    if (!boundaryResult) {
      console.error('❌ Howard County boundary not found. Run import-howard-boundary.ts first.');
      process.exit(1);
    }

    const boundaryGeom = JSON.parse(boundaryResult.geom);
    console.log('✅ Howard County boundary loaded');

    let polyCoords: string;
    if (boundaryGeom.type === 'Polygon') {
      polyCoords = boundaryGeom.coordinates[0]
        .filter((_: any, index: number) => index % 5 === 0)
        .map((coord: number[]) => `${coord[1]} ${coord[0]}`)
        .join(' ');
    } else if (boundaryGeom.type === 'MultiPolygon') {
      polyCoords = boundaryGeom.coordinates[0][0]
        .filter((_: any, index: number) => index % 5 === 0)
        .map((coord: number[]) => `${coord[1]} ${coord[0]}`)
        .join(' ');
    } else {
      throw new Error('Unsupported boundary geometry type');
    }

    console.log('🔍 Querying Overpass API for roads...');
    console.log('⏳ May take 2-5 minutes...');

    const overpassQuery = `
      [out:json][timeout:180];
      (
        way["highway"]["name"](poly:"${polyCoords}");
      );
      out geom;
    `;

    const overpassResponse = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQuery,
      headers: {
        'Content-Type': 'text/plain'
      }
    });

    if (!overpassResponse.ok) {
      throw new Error(`Overpass API error: ${overpassResponse.status}`);
    }

    const osmData = await overpassResponse.json();
    console.log(`✅ Got ${osmData.elements.length} roads from OSM`);

    console.log('🗑️  Clearing existing road data...');
    await query('DELETE FROM command_history');
    await query('DELETE FROM sidewalks_howard');
    await query('DELETE FROM roads_howard');

    let imported = 0;
    let skipped = 0;

    for (const element of osmData.elements) {
      if (element.type !== 'way' || !element.geometry) {
        skipped++;
        continue;
      }

      const tags = element.tags || {};
      const coordinates = element.geometry.map((node: any) => [node.lon, node.lat]);

      if (coordinates.length < 2) {
        skipped++;
        continue;
      }

      const lineString = {
        type: 'LineString',
        coordinates
      };

      try {
        await query(
          `INSERT INTO roads_howard (osm_id, name, highway, surface, lanes, maxspeed, oneway, properties, geom)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_GeomFromGeoJSON($9), 4326))
           ON CONFLICT (osm_id) DO UPDATE SET
             name = EXCLUDED.name,
             highway = EXCLUDED.highway,
             properties = EXCLUDED.properties`,
          [
            element.id,
            tags.name || null,
            tags.highway || 'unknown',
            tags.surface || null,
            tags.lanes ? parseInt(tags.lanes) : null,
            tags.maxspeed || null,
            tags.oneway === 'yes',
            JSON.stringify(tags),
            JSON.stringify(lineString)
          ]
        );
        imported++;

        if (imported % 100 === 0) {
          console.log(`   Imported ${imported} roads...`);
        }
      } catch (error) {
        console.error(`   ⚠️  Failed to import road ${element.id}:`, error);
        skipped++;
      }
    }

    console.log(`\n✅ Road import done.`);
    console.log(`   Imported: ${imported}`);
    console.log(`   Skipped: ${skipped}`);

    const stats = await queryOne(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT highway) as highway_types,
        SUM(ST_Length(geom::geography))/1000 as total_km
      FROM roads_howard
    `);

    console.log(`\n📊 Stats:`);
    console.log(`   Total roads: ${stats.total}`);
    console.log(`   Highway types: ${stats.highway_types}`);
    console.log(`   Total length: ${parseFloat(stats.total_km).toFixed(2)} km`);

  } catch (error: any) {
    console.error('❌ Import failed:', error.message);
    if (error.message.includes('Overpass')) {
      console.log('\n💡 If Overpass times out, try again later.');
    }
    process.exit(1);
  }
}

importRoads().then(() => {
  console.log('\n✅ All road data imported.');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});

