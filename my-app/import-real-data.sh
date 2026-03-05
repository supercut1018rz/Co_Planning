#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "=========================================="
echo "Import real Howard County OSM data"
echo "=========================================="
echo ""

echo "Step 1/4: Clearing existing data..."
sudo docker compose exec db psql -U appuser -d howard_sidewalk_db -c "
TRUNCATE TABLE command_history CASCADE;
TRUNCATE TABLE sidewalks_howard CASCADE;
TRUNCATE TABLE intersections_howard CASCADE;
TRUNCATE TABLE roads_howard CASCADE;
TRUNCATE TABLE county_boundary CASCADE;
" > /dev/null
echo "✅ Database cleared"

echo ""
echo "Step 2/4: Importing Howard County boundary..."
npx tsx scripts/import-howard-boundary.ts

echo ""
echo "Step 3/4: Importing roads (may take 2-5 min)..."
npx tsx scripts/import-osm-roads.ts

echo ""
echo "Step 4/4: Verifying..."
sudo docker compose exec db psql -U appuser -d howard_sidewalk_db -c "
SELECT COUNT(*) as total_roads FROM roads_howard;
"

echo ""
echo "=========================================="
echo "✅ Import complete"
echo "=========================================="
