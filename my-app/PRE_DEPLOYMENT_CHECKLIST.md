# 📋 Pre-Deployment Checklist

Complete these steps **on your machine** before sharing the code with others.

## ✅ Step 1: Export Real Database to SQL Files

This is the most important step! It ensures others get the real Howard County road data.

```bash
cd /home/leichengadmin/Desktop/Co-planning./my-app

# Configure connection to Docker database
cat > .env.export << EOF
DATABASE_HOST=127.0.0.1
DATABASE_PORT=15432
DATABASE_NAME=howard_sidewalk_db
DATABASE_USER=appuser
DATABASE_PASSWORD=ChangeMe_StrongPW
EOF

# Export real data
export $(cat .env.export | xargs)
bash scripts/export_db.sh --all

# Verify the SQL files are large (contain real data)
ls -lh sql/init/
# 001_schema.sql should be ~5-10 KB
# 002_seed.sql should be several MB (with real road data)

# Clean up
rm .env.export
```

## ✅ Step 2: Verify SQL Files

```bash
# Check schema file
head -50 sql/init/001_schema.sql
# Should see: CREATE EXTENSION postgis, CREATE TABLE roads_howard, etc.

# Check seed file
head -100 sql/init/002_seed.sql
# Should see: INSERT INTO roads_howard with real Howard County roads

# Count roads in seed file
grep -c "INSERT INTO roads_howard" sql/init/002_seed.sql
# Should show a large number (e.g., 100+)
```

## ✅ Step 3: Clean Sensitive Data

```bash
# Remove any temporary env files
rm -f .env.export .env.local .env.docker

# Verify .env is not tracked
git status | grep ".env"
# Should NOT show .env (only .env.example is tracked)

# Verify .gitignore is correct
cat .gitignore | grep -E "^\.env$"
```

## ✅ Step 4: Update README with Deployment Link

Add this section to README.md:

```markdown
## 🚀 Quick Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.

**One-command deployment:**
```bash
cp .env.example .env
# Edit .env with your API keys
docker compose up -d --build
```

The system includes real Howard County road data and will be ready in minutes.
```

## ✅ Step 5: Test Clean Deployment (Optional but Recommended)

Test that others can deploy successfully:

```bash
# Simulate clean deployment
docker compose down -v

# Re-deploy
docker compose up -d --build

# Verify real data is loaded
docker compose logs db | grep "Demo roads"
# Should show count > 0

# Check application works
curl http://localhost:3000/api/sidewalks?scenario=base
```

## ✅ Step 6: Commit and Push

```bash
cd /home/leichengadmin/Desktop/Co-planning./my-app

# Check what will be committed
git status

# Should include:
# - sql/init/001_schema.sql (updated)
# - sql/init/002_seed.sql (updated with real data)
# - DEPLOYMENT.md (new)
# - docker-compose.yml
# - Dockerfile
# - .env.example
# - Makefile

# Should NOT include:
# - .env (contains real API keys)
# - .env.local
# - node_modules/

# Add files
git add sql/init/ DEPLOYMENT.md docker-compose.yml Dockerfile .env.example Makefile README.md .dockerignore .gitignore

# Commit
git commit -m "Add Docker deployment with real Howard County data

- Add complete deployment documentation
- Include real OSM road data in sql/init/002_seed.sql
- Docker compose setup with PostgreSQL + PostGIS
- One-command deployment: docker compose up -d --build
- Auto-initialize database with real data on first startup
"

# Push
git push
```

## ✅ Step 7: Create Release Package (Alternative to Git)

If you're sharing via archive instead of Git:

```bash
cd /home/leichengadmin/Desktop/Co-planning./my-app

# Create archive (excluding node_modules, .next, etc.)
tar -czf ../howard-sidewalk-deployment.tar.gz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.git' \
  --exclude='*.log' \
  .

# Verify archive size (should be < 50MB)
ls -lh ../howard-sidewalk-deployment.tar.gz

# Test extraction
cd /tmp
tar -xzf /home/leichengadmin/Desktop/howard-sidewalk-deployment.tar.gz
ls -la my-app/sql/init/
```

## ✅ Final Checklist

Before sharing with others, verify:

- [ ] `sql/init/001_schema.sql` exists and contains complete schema
- [ ] `sql/init/002_seed.sql` exists and contains real road data (> 1MB)
- [ ] `DEPLOYMENT.md` exists with complete instructions
- [ ] `.env.example` exists with placeholder values
- [ ] `.env` is NOT committed (contains real API keys)
- [ ] `docker-compose.yml` configured correctly (port 15432)
- [ ] `Dockerfile` builds successfully
- [ ] `Makefile` has convenience commands
- [ ] `.gitignore` excludes sensitive files
- [ ] Tested clean deployment works: `docker compose down -v && docker compose up -d`

## 📧 What to Tell Others

Send them this message:

---

**Howard County Sidewalk Planning System - Deployment Package**

This package contains a ready-to-deploy system with real Howard County road data.

**Quick Start:**
1. Ensure Docker and Docker Compose are installed
2. See `DEPLOYMENT.md` for complete instructions
3. Or run these commands:
   ```bash
   cd my-app
   cp .env.example .env
   # Edit .env with your OpenAI and Mapillary API keys
   docker compose up -d --build
   ```

The application will be available at http://localhost:3000

**What's Included:**
- ✅ Complete Next.js application
- ✅ PostgreSQL database with PostGIS
- ✅ Real Howard County road data (9600+ roads from OpenStreetMap)
- ✅ Auto-initialization SQL scripts
- ✅ One-command deployment
- ✅ Complete documentation

**Requirements:**
- Docker 20.10+
- Docker Compose v2
- 8GB+ RAM
- OpenAI API key
- Mapillary API token

See `DEPLOYMENT.md` for detailed instructions.

---

## 🎯 Summary

**What Others Need to Do:**
1. Install Docker and Docker Compose
2. Get OpenAI API key and Mapillary token
3. Run: `cp .env.example .env` and fill in keys
4. Run: `docker compose up -d --build`
5. Access: http://localhost:3000

**What They DON'T Need to Do:**
- ❌ Install PostgreSQL manually
- ❌ Run `import-osm-roads.ts` (data is pre-packaged)
- ❌ Set up database schema manually
- ❌ Import road data from OpenStreetMap

Everything is automated! 🎉
