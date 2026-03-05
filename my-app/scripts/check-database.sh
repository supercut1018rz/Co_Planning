#!/bin/bash

# Howard County Sidewalk Planning System - Database diagnostic script
# Usage: chmod +x scripts/check-database.sh && ./scripts/check-database.sh

echo "🔍 ============================================"
echo "   Howard County Database Diagnostic"
echo "============================================"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

check_item() {
  local name=$1
  local command=$2
  local expected=$3
  
  echo -n "Checking $name ... "
  
  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Pass${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌ Fail${NC}"
    if [ ! -z "$expected" ]; then
      echo -e "${YELLOW}   → $expected${NC}"
    fi
    ((FAILED++))
    return 1
  fi
}

echo "📋 Step 1: Software"
echo "-------------------------------------------"

check_item "PostgreSQL" \
  "psql --version" \
  "Install: sudo apt install postgresql"

check_item "PostGIS" \
  "dpkg -l | grep postgis" \
  "Install: sudo apt install postgresql-14-postgis-3"

check_item "PostgreSQL service" \
  "sudo systemctl is-active postgresql" \
  "Start: sudo systemctl start postgresql"

check_item "Node.js" \
  "node --version" \
  "Install from https://nodejs.org"

check_item "npm" \
  "npm --version" \
  "Comes with Node.js"

check_item "tsx (optional)" \
  "tsx --version" \
  "Install: npm install -g tsx"

echo ""
echo "🗄️  Step 2: Database status"
echo "-------------------------------------------"

check_item "DB connection" \
  "psql -U postgres -l" \
  "Check if PostgreSQL is running"

check_item "howard_sidewalk_db" \
  "psql -U postgres -l | grep howard_sidewalk_db" \
  "Create: createdb -U postgres howard_sidewalk_db"

check_item "PostGIS extension" \
  "psql -U postgres -d howard_sidewalk_db -c 'SELECT PostGIS_version();'" \
  "Enable: psql -U postgres -d howard_sidewalk_db -c 'CREATE EXTENSION postgis;'"

echo ""
echo "📊 Step 3: Tables"
echo "-------------------------------------------"

for table in roads_howard sidewalks_howard county_boundary scenarios command_history; do
  check_item "$table table" \
    "psql -U postgres -d howard_sidewalk_db -c '\dt' | grep $table" \
    "Create: psql -U postgres -d howard_sidewalk_db -f scripts/setup-database.sql"
done

echo ""
echo "💾 Step 4: Data"
echo "-------------------------------------------"

BOUNDARY_COUNT=$(psql -U postgres -d howard_sidewalk_db -t -c "SELECT COUNT(*) FROM county_boundary;" 2>/dev/null | xargs)
if [ "$BOUNDARY_COUNT" -gt "0" ] 2>/dev/null; then
  echo -e "Boundary data ... ${GREEN}✅ $BOUNDARY_COUNT rows${NC}"
  ((PASSED++))
else
  echo -e "Boundary data ... ${RED}❌ 0 rows${NC}"
  echo -e "${YELLOW}   → Import: tsx scripts/import-howard-boundary.ts${NC}"
  ((FAILED++))
fi

ROADS_COUNT=$(psql -U postgres -d howard_sidewalk_db -t -c "SELECT COUNT(*) FROM roads_howard;" 2>/dev/null | xargs)
if [ "$ROADS_COUNT" -gt "10000" ] 2>/dev/null; then
  echo -e "Road data ... ${GREEN}✅ $ROADS_COUNT rows${NC}"
  ((PASSED++))
elif [ "$ROADS_COUNT" -gt "0" ] 2>/dev/null; then
  echo -e "Road data ... ${YELLOW}⚠️  $ROADS_COUNT rows (recommended > 10000)${NC}"
  echo -e "${YELLOW}   → Re-import: tsx scripts/import-osm-roads.ts${NC}"
  ((FAILED++))
else
  echo -e "Road data ... ${RED}❌ 0 rows${NC}"
  echo -e "${YELLOW}   → Import: tsx scripts/import-osm-roads.ts${NC}"
  ((FAILED++))
fi

SIDEWALKS_COUNT=$(psql -U postgres -d howard_sidewalk_db -t -c "SELECT COUNT(*) FROM sidewalks_howard;" 2>/dev/null | xargs)
echo -e "Sidewalk data ... ${GREEN}$SIDEWALKS_COUNT rows${NC} (can be 0)"

echo ""
echo "⚙️  Step 5: Config"
echo "-------------------------------------------"

if [ -f ".env.local" ]; then
  echo -e ".env.local ... ${GREEN}✅ exists${NC}"
  ((PASSED++))
  
  if grep -q "DATABASE_HOST" .env.local 2>/dev/null; then
    echo -e "DB config ... ${GREEN}✅ set${NC}"
    ((PASSED++))
  else
    echo -e "DB config ... ${RED}❌ missing${NC}"
    echo -e "${YELLOW}   → Add DATABASE_HOST, DATABASE_NAME, etc.${NC}"
    ((FAILED++))
  fi
else
  echo -e ".env.local ... ${RED}❌ not found${NC}"
  echo -e "${YELLOW}   → Create from .env.example${NC}"
  ((FAILED++))
fi

echo ""
echo "📈 Step 6: Indexes"
echo "-------------------------------------------"

INDEX_COUNT=$(psql -U postgres -d howard_sidewalk_db -t -c "SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE 'idx_%geom';" 2>/dev/null | xargs)
if [ "$INDEX_COUNT" -gt "0" ] 2>/dev/null; then
  echo -e "Spatial indexes ... ${GREEN}✅ $INDEX_COUNT${NC}"
  ((PASSED++))
else
  echo -e "Spatial indexes ... ${YELLOW}⚠️  none${NC}"
fi

echo ""
echo "============================================"
echo "            Summary"
echo "============================================"
echo ""
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All checks passed. DB is ready.${NC}"
  echo ""
  echo "Next:"
  echo "  1. npm run dev"
  echo "  2. Open http://localhost:3000/planning"
  echo "  3. Start planning sidewalks."
else
  echo -e "${RED}⚠️  $FAILED issue(s) found. Fix items marked ❌ above.${NC}"
  echo ""
  echo "Suggestions:"
  echo "  1. Fix failed items in order"
  echo "  2. Re-run this script to verify"
fi

echo ""
echo "============================================"
