#!/bin/bash

# Howard County Sidewalk Planning System - One-shot install script
# Usage: chmod +x scripts/install-all.sh && sudo ./scripts/install-all.sh

set -e

echo "🚀 ============================================"
echo "   Howard County Sidewalk Planning System"
echo "   One-shot install"
echo "============================================"
echo ""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then 
  echo -e "${YELLOW}Run this script with sudo${NC}"
  echo "Command: sudo ./scripts/install-all.sh"
  exit 1
fi

ACTUAL_USER=${SUDO_USER:-$USER}
USER_HOME=$(eval echo ~$ACTUAL_USER)
PROJECT_DIR="$USER_HOME/my-app"

echo -e "${BLUE}📦 Step 1: PostgreSQL + PostGIS${NC}"
echo "-------------------------------------------"
apt update
apt install -y postgresql postgresql-contrib postgresql-14-postgis-3
systemctl start postgresql
systemctl enable postgresql
echo -e "${GREEN}✅ PostgreSQL installed${NC}"
echo ""

echo -e "${BLUE}🗄️  Step 2: Create database${NC}"
echo "-------------------------------------------"
sudo -u postgres createdb howard_sidewalk_db 2>/dev/null || echo "Database may already exist"
sudo -u postgres psql -d howard_sidewalk_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"
sudo -u postgres psql -d howard_sidewalk_db -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;"
echo -e "${GREEN}✅ Database created${NC}"
echo ""

echo -e "${BLUE}📋 Step 3: Create tables${NC}"
echo "-------------------------------------------"
sudo -u postgres psql -d howard_sidewalk_db -f "$PROJECT_DIR/scripts/setup-database.sql"
echo -e "${GREEN}✅ Tables created${NC}"
echo ""

echo -e "${BLUE}⚙️  Step 4: Env config${NC}"
echo "-------------------------------------------"
if [ ! -f "$PROJECT_DIR/.env.local" ]; then
  sudo -u $ACTUAL_USER touch "$PROJECT_DIR/.env.local"
fi

if ! grep -q "DATABASE_HOST" "$PROJECT_DIR/.env.local" 2>/dev/null; then
  sudo -u $ACTUAL_USER cat >> "$PROJECT_DIR/.env.local" << 'EOF'

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=howard_sidewalk_db
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
EOF
  echo -e "${GREEN}✅ Env configured${NC}"
else
  echo -e "${YELLOW}⚠️  DB config already present, skipping${NC}"
fi
echo ""

echo -e "${BLUE}📦 Step 5: Install tsx${NC}"
echo "-------------------------------------------"
sudo npm install -g tsx
echo -e "${GREEN}✅ tsx installed${NC}"
echo ""

echo -e "${BLUE}🌍 Step 6: Import boundary${NC}"
echo "-------------------------------------------"
cd "$PROJECT_DIR"
sudo -u $ACTUAL_USER tsx scripts/import-howard-boundary.ts
echo -e "${GREEN}✅ Boundary imported${NC}"
echo ""

echo -e "${BLUE}🛣️  Step 7: Import roads (5-10 min)${NC}"
echo "-------------------------------------------"
echo "⏳ Downloading from OpenStreetMap..."
sudo -u $ACTUAL_USER tsx scripts/import-osm-roads.ts
echo -e "${GREEN}✅ Roads imported${NC}"
echo ""

echo "============================================"
echo -e "${GREEN}🎉 Install complete.${NC}"
echo "============================================"
echo ""
echo "Next:"
echo "  1. npm run dev"
echo "  2. Open http://localhost:3000/planning"
echo "  3. Click map to set start/end and plan."
echo ""
echo "Verify: ./scripts/check-database.sh"
echo ""
