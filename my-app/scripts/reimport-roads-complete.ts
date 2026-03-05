/**
 * Re-import full Howard County road data including ref tags (e.g. MD 175, US 29).
 */

import { query, queryOne } from '../lib/db';

async function reimportRoadsComplete() {
  console.log('🛣️  Re-importing full road data (with ref tags)...');

  try {
    const boundaryResult = await queryOne(
      'SELECT ST_AsGeoJSON(geom) as geom FROM county_boundary WHERE name = $1',
      ['Howard County']
    );

    if (!boundaryResult) {
      console.error('❌ Howard County boundary not found');
      process.exit(1);
    }

    const boundaryGeom = JSON.parse(boundaryResult.geom);
    console.log('✅ Boundary loaded');

    let polyCoords: string;
    if (boundaryGeom.type === 'Polygon') {
      polyCoords = boundaryGeom.coordinates[0]
        .filter((_: any, index: number) => index % 5 === 0)
        .map((coord: number[]) => `${coord[1]} ${coord[0]}`)
        .join(' ');
    } else {
      polyCoords = boundaryGeom.coordinates[0][0]
        .filter((_: any, index: number) => index % 5 === 0)
        .map((coord: number[]) => `${coord[1]} ${coord[0]}`)
        .join(' ');
    }

    console.log('🔍 Querying OSM (all major roads)...');
    console.log('⏳ About 3-5 minutes...');

    const overpassQuery = `
      [out:json][timeout:300];
      (
        way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified"](poly:"${polyCoords}");
      );
      out geom;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQuery,
      headers: {
        'Content-Type': 'text/plain'
      }
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const osmData = await response.json();
    console.log(`✅ Got ${osmData.elements.length} roads`);

    console.log('🗑️  Clearing existing roads...');
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

      let roadName = tags.name;
      if (!roadName && tags.ref) {
        roadName = tags.ref.replace('MD ', 'Maryland ').replace('US ', 'US Route ');
      }

      if (!roadName) {
        skipped++;
        continue;
      }

      const lineString = {
        type: 'LineString',
        coordinates
      };

      try {
        const properties = {
          ...tags,
          original_ref: tags.ref,
          original_name: tags.name
        };

        await query(
          `INSERT INTO roads_howard (osm_id, name, highway, surface, lanes, maxspeed, oneway, properties, geom)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_GeomFromGeoJSON($9), 4326))
           ON CONFLICT (osm_id) DO UPDATE SET
             name = EXCLUDED.name,
             highway = EXCLUDED.highway,
             properties = EXCLUDED.properties`,
          [
            element.id,
            roadName,
            tags.highway || 'unknown',
            tags.surface || null,
            tags.lanes ? parseInt(tags.lanes) : null,
            tags.maxspeed || null,
            tags.oneway === 'yes',
            JSON.stringify(properties),
            JSON.stringify(lineString)
          ]
        );
        imported++;

        if (imported % 100 === 0) {
          console.log(`   Imported ${imported}...`);
        }
      } catch (error) {
        console.error(`   ⚠️  Skipped road ${element.id}:`, error);
        skipped++;
      }
    }

    console.log(`\n✅ Import done.`);
    console.log(`   Imported: ${imported}`);
    console.log(`   Skipped: ${skipped}`);

    const stats = await queryOne(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT highway) as types,
        SUM(ST_Length(geom::geography))/1000 as total_km
      FROM roads_howard
    `);

    console.log(`\n📊 Stats:`);
    console.log(`   Total: ${stats.total}`);
    console.log(`   Types: ${stats.types}`);
    console.log(`   Length: ${parseFloat(stats.total_km).toFixed(2)} km`);

    const route175 = await query(
      `SELECT name FROM roads_howard WHERE name ILIKE '%175%' LIMIT 5`
    );

    if (route175.rows.length > 0) {
      console.log(`\n✅ Found Route 175:`);
      route175.rows.forEach(r => console.log(`   - ${r.name}`));
    } else {
      console.log(`\n⚠️  Route 175 not found`);
      console.log(`   Possible: not tagged in OSM, different name, or outside Howard County.`);
    }

  } catch (error: any) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
}

reimportRoadsComplete().then(() => {
  console.log('\n🎉 Done.');
  process.exit(0);
});

