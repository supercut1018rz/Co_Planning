# Howard County Sidewalk Planning System

AI- and GIS-based sidewalk planning system with natural language interaction, multi-scenario management, and visual analysis.

## One-Click Deploy (Recommended)

On any server with Docker and Docker Compose, start the full stack in three steps:

```bash
# 1. Clone repo
git clone <repository-url>
cd my-app

# 2. Configure env
cp .env.example .env
# Edit .env with your real API keys

# 3. Start all services (DB + app)
docker compose up -d --build
```

Open http://localhost:3000 to use the app.

### Access DB from Host (Optional)

The Docker DB port is mapped to host `5433`. Use pgAdmin, DBeaver, psql, etc.:

```
Host: localhost
Port: 5433  (not 5432)
Database: howard_sidewalk_db
User: appuser
Password: (value from .env)
```

See [DATABASE_ACCESS.md](./DATABASE_ACCESS.md) for details.

### Requirements

- Docker 20.10+
- Docker Compose v2
- 8GB+ free memory

### Environment Variables

Edit `.env` with at least:

```bash
# OpenAI (for natural language)
OPENAI_API_KEY=your_actual_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o

# Mapillary (street-level imagery)
MAPILLARY_CLIENT_TOKEN=your_actual_mapillary_token_here

# Database (defaults are fine)
DATABASE_NAME=howard_sidewalk_db
DATABASE_USER=appuser
DATABASE_PASSWORD=ChangeMe_StrongPW  # Use a strong password in production
```

## What’s Included

One-click deploy starts:

1. **PostgreSQL** (with PostGIS)
   - Tables, indexes, and functions created automatically
   - Demo/seed data so the app works out of the box
   - Data stored in a Docker volume

2. **Next.js app**
   - Runs in production mode
   - Waits for DB to be ready (avoids connection errors)
   - Full API and UI

## Common Commands

Makefile shortcuts:

```bash
# List commands
make help

# Start (background)
make up

# Logs
make logs

# Status
make ps

# Stop
make down

# Restart
make restart

# Reset DB (removes all data, re-initializes)
make reset-db
```

### Without Makefile

```bash
docker compose up -d --build
docker compose logs -f --tail=200
docker compose ps
docker compose down
# Reset DB (warning: deletes all data):
docker compose down -v
```

## Export Schema and Data from Existing DB

If you have a running DB with the right schema and data, you can export it for use on new servers.

### 1. Point to existing DB

Edit `.env`:

```bash
DATABASE_HOST=your_existing_db_host
DATABASE_PORT=5432
DATABASE_NAME=howard_sidewalk_db
DATABASE_USER=appuser
DATABASE_PASSWORD=your_db_password
```

### 2. Run export

```bash
make export-db

# Or separately:
make export-schema   # schema only
make export-seed    # seed data only
```

This updates:

- `sql/init/001_schema.sql` – schema (tables, indexes, functions)
- `sql/init/002_seed.sql` – seed data (base scenario + demo data)

### 3. Commit

```bash
git add sql/init/
git commit -m "Update database schema and seed data"
git push
```

### 4. Deploy on new server

After others clone the repo, `docker compose up` will init the DB from these SQL files.

### Customize export

Use env vars to limit what is exported:

```bash
EXPORT_TABLES="scenarios,sidewalks_howard,roads_howard" make export-seed
EXPORT_WHERE="scenario='base' AND status='existing'" make export-seed
```

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Maps**: Leaflet, React-Leaflet
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL 16 + PostGIS
- **AI**: OpenAI GPT-4o
- **Street view**: Mapillary API
- **Containers**: Docker, Docker Compose

## Local Development

Without Docker:

### 1. Install dependencies

```bash
npm install
```

### 2. Set up database

Install PostgreSQL and PostGIS, then:

```bash
createdb howard_sidewalk_db
psql -d howard_sidewalk_db -f sql/init/001_schema.sql
psql -d howard_sidewalk_db -f sql/init/002_seed.sql
```

### 3. Env

```bash
cp .env.example .env.local
# Edit .env.local for local DB connection
```

### 4. Run dev server

```bash
npm run dev
```

Open http://localhost:3000

## Troubleshooting

### App fails with "ECONNREFUSED"

The app tried to connect before the DB was ready. Docker Compose healthchecks usually retry; if not, run `make logs` and `docker compose ps`.

### DB init fails

Check SQL syntax and data compatibility. View DB logs: `docker compose logs db`. Then: `make reset-db` and `make up`.

### API returns empty data

Seed data may not have been loaded. Check `sql/init/002_seed.sql`; if using demo data, run `make export-db` from a real DB, then `make reset-db && make up`.

### Force re-init DB

The init scripts run only when the volume is created for the first time. To re-init:

```bash
docker compose down -v   # Deletes all data
docker compose up -d --build
```

### SQL file changes not applied

After the first `docker compose up`, the DB is already initialized; editing SQL files does not apply automatically. Run `make reset-db` then `make up`.

## API Endpoints

- `GET /api/sidewalks?scenario=base` – get sidewalks for a scenario
- `POST /api/generate-sidewalk` – generate sidewalk from natural language
- `DELETE /api/sidewalks?id=123` – delete sidewalk
- `PUT /api/sidewalks` – update sidewalk
- `POST /api/parse-command` – parse natural language command

## Security

1. Do not commit real keys; `.env` is in `.gitignore`.
2. Change default `DATABASE_PASSWORD` in production.
3. Expose DB only on internal networks in production.
4. Keep secrets in environment variables.

## License

[Add your license information]

## Contributing

Issues and Pull Requests welcome.

---

**Quick start**: `cp .env.example .env && docker compose up -d --build`
