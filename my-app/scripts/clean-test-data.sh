#!/bin/bash

# Clean test data script
# Usage: ./scripts/clean-test-data.sh

set -e

echo "🧹 Cleaning test data..."
echo ""

if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | grep DATABASE_ | xargs)
else
  echo "❌ Error: .env.local not found"
  exit 1
fi

echo "⚠️  This will delete:"
echo "   - All command history"
echo "   - All generated sidewalks (OSM data kept)"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Cancelled"
  exit 0
fi

echo ""
echo "🗑️  Deleting data..."

PGPASSWORD="$DATABASE_PASSWORD" psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" << 'EOF'

\echo '📊 Before:'
SELECT 
  'command_history' as table_name, 
  COUNT(*) as count 
FROM command_history
UNION ALL
SELECT 
  'sidewalks (generated)' as table_name, 
  COUNT(*) as count 
FROM sidewalks_howard 
WHERE source IN ('generated', 'precise_coordinate');

\echo ''
\echo '🗑️  Deleting command history...'
DELETE FROM command_history;

\echo '🗑️  Deleting generated sidewalks...'
DELETE FROM sidewalks_howard 
WHERE source IN ('generated', 'precise_coordinate');

\echo ''
\echo '📊 After:'
SELECT 
  'command_history' as table_name, 
  COUNT(*) as count 
FROM command_history
UNION ALL
SELECT 
  'sidewalks (all)' as table_name, 
  COUNT(*) as count 
FROM sidewalks_howard;

\echo ''
\echo '✅ Cleanup done.'

EOF

if [ $? -eq 0 ]; then
  echo ""
  echo "🎉 Test data cleaned."
  echo ""
  echo "💡 Command history and generated sidewalks removed; OSM data kept."
  echo "   Ready for a fresh test run."
else
  echo ""
  echo "❌ Cleanup failed. Check DB connection."
  exit 1
fi
