# 🚀 Howard County Sidewalk Planning System - Deployment Guide

## Overview

This guide will help you deploy the Howard County Sidewalk Planning System on a fresh server with a **single command**. The entire system (application + database with real data) will be packaged and deployed using Docker Compose.

## Prerequisites

Before deployment, ensure your server has:

- **Docker** 20.10+ installed and running
- **Docker Compose** v2 (plugin) or v1.29+
- **8GB+ RAM** available
- **10GB+ disk space** available
- **Internet connection** (for pulling Docker images)
- **Ports available**: 3000 (app), 15432 (database, optional)

## Quick Start (One-Command Deployment)

```bash
# 1. Clone the repository
git clone <repository-url>
cd my-app

# 2. Create environment file
cp .env.example .env
# Edit .env and fill in your API keys (see below)

# 3. Deploy everything (database will auto-initialize with real data)
docker compose up -d --build
```

That's it! The application will be available at `http://localhost:3000`

## Detailed Deployment Steps

### Step 1: Install Docker and Docker Compose

#### On Ubuntu 24.04 / Debian

```bash
# Install Docker
sudo apt update
sudo apt install docker.io -y
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group (to run without sudo)
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

#### On Other Linux Distributions

```bash
# Install Docker (follow official guide)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
```

### Step 2: Clone the Repository

```bash
git clone <repository-url>
cd my-app
```

### Step 3: Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file
nano .env  # or use your preferred editor
```

**Required Configuration:**

```bash
# OpenAI API (for natural language processing)
OPENAI_API_KEY=your_actual_openai_api_key_here
OPENAI_BASE_URL=https://us.api.openai.com/v1
OPENAI_MODEL=gpt-4o

# Mapillary API (for street imagery)
MAPILLARY_CLIENT_TOKEN=your_actual_mapillary_token_here

# Database (use default values for Docker deployment)
DATABASE_NAME=howard_sidewalk_db
DATABASE_USER=appuser
DATABASE_PASSWORD=ChangeMe_StrongPW  # ⚠️ Change this in production!
```

**Important Notes:**
- You MUST provide valid `OPENAI_API_KEY` and `MAPILLARY_CLIENT_TOKEN`
- Change `DATABASE_PASSWORD` to a strong password in production
- The database will run inside Docker and auto-initialize with real Howard County road data

### Step 4: Deploy the Application

```bash
# Start all services (database + application)
docker compose up -d --build

# Wait for services to start (usually 30-60 seconds)
# The database will automatically:
# - Create all tables and indexes
# - Import schema from sql/init/001_schema.sql
# - Load real Howard County road data from sql/init/002_seed.sql
```

### Step 5: Verify Deployment

```bash
# Check service status
docker compose ps

# Expected output:
# NAME                    STATUS
# howard_sidewalk_app     Up (healthy)
# howard_sidewalk_db      Up (healthy)

# Check logs
docker compose logs app --tail=50

# Verify database has data
docker compose exec db psql -U appuser -d howard_sidewalk_db -c "SELECT COUNT(*) FROM roads_howard;"
```

### Step 6: Access the Application

#### Local Access (on the server)

```
http://localhost:3000
```

#### Remote Access (from another computer)

```
http://your-server-ip:3000
```

To find your server IP:
```bash
hostname -I
```

## Post-Deployment Configuration

### Configure Firewall (if needed)

```bash
# Allow port 3000 for application access
sudo ufw allow 3000/tcp

# Optional: Allow port 15432 for database access (for debugging)
sudo ufw allow 15432/tcp
```

### Access Database from Host (Optional)

The database is accessible from the host machine on port **15432**:

```bash
# Using psql
psql -h localhost -p 15432 -U appuser -d howard_sidewalk_db

# Connection parameters for pgAdmin/DBeaver:
Host: localhost
Port: 15432
Database: howard_sidewalk_db
User: appuser
Password: (your DATABASE_PASSWORD from .env)
```

## Management Commands

### Using Makefile (Recommended)

```bash
# View all available commands
make help

# Start services
make up

# Stop services
make down

# View logs
make logs

# Check status
make ps

# Restart services
make restart

# Reset database (⚠️ deletes all data!)
make reset-db
```

### Using Docker Compose Directly

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Check status
docker compose ps

# Restart specific service
docker compose restart app
docker compose restart db

# Reset database (⚠️ deletes all data!)
docker compose down -v
docker compose up -d
```

## Troubleshooting

### Issue: Cannot connect to application

**Check:**
```bash
# Verify containers are running
docker compose ps

# Check application logs
docker compose logs app

# Test from inside the server
curl http://localhost:3000
```

**Solution:**
- Ensure port 3000 is not blocked by firewall
- Check if another service is using port 3000: `sudo lsof -i :3000`

### Issue: Database connection error

**Check:**
```bash
# Check database logs
docker compose logs db

# Verify database is healthy
docker compose exec db pg_isready -U appuser -d howard_sidewalk_db
```

**Solution:**
- Wait 30-60 seconds for database to fully initialize
- Check if database completed initialization: `docker compose logs db | grep "initialized successfully"`
- Restart services: `docker compose restart`

### Issue: OpenAI API authentication error

**Error message:** `❌ OpenAI auth failed (401)`

**Solution:**
1. Verify your API key is correct in `.env`
2. Check the OPENAI_BASE_URL matches your account region:
   - US accounts: `https://us.api.openai.com/v1`
   - EU accounts: `https://eu.api.openai.com/v1`
   - Default: `https://api.openai.com/v1`
3. Restart services to reload environment variables:
   ```bash
   docker compose down
   docker compose up -d
   ```

### Issue: Empty road data or "Road not found" errors

**Check:**
```bash
# Verify road data is loaded
docker compose exec db psql -U appuser -d howard_sidewalk_db -c "SELECT COUNT(*) FROM roads_howard;"
```

**Solution:**
If count is 0 or very small:
1. Check `sql/init/002_seed.sql` exists and contains data
2. Reset database to re-run initialization:
   ```bash
   docker compose down -v
   docker compose up -d
   ```
3. Check database logs during initialization:
   ```bash
   docker compose logs db | grep -A 10 "Seed data"
   ```

### Issue: Port 5432 already in use

**Error:** `Bind for 0.0.0.0:5432 failed: port is already allocated`

**Solution:**
This means you have PostgreSQL running locally. The Docker database uses port **15432** internally, so there should be no conflict. If you see this error:

1. Check `docker-compose.yml` - the database port should NOT be exposed or should use 15432:
   ```yaml
   # ports:
   #   - "15432:5432"  # Commented out by default
   ```

2. If you need to access the database from host, edit `docker-compose.yml` and uncomment the ports section.

## Database Backup and Restore

### Backup Database

```bash
# Export database to SQL file
docker compose exec db pg_dump -U appuser -d howard_sidewalk_db > backup.sql

# Or backup with docker compose
docker compose exec db pg_dump -U appuser -d howard_sidewalk_db -F c > backup.dump
```

### Restore Database

```bash
# From SQL file
cat backup.sql | docker compose exec -T db psql -U appuser -d howard_sidewalk_db

# From dump file
docker compose exec -T db pg_restore -U appuser -d howard_sidewalk_db < backup.dump
```

## Updating the Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose down
docker compose up -d --build

# Check logs
docker compose logs -f
```

## Uninstalling

```bash
# Stop and remove containers, networks
docker compose down

# Also remove data volumes (⚠️ deletes all data!)
docker compose down -v

# Remove Docker images (optional)
docker rmi $(docker images -q my-app*)
```

## Architecture

### Services

- **app**: Next.js application (Port 3000)
  - Built with Node.js 20 Alpine
  - Runs in production mode
  - Connects to database via Docker internal network

- **db**: PostgreSQL 16 with PostGIS (Port 15432)
  - Uses PostGIS for geospatial data
  - Auto-initializes with schema and real Howard County data
  - Data persists in Docker volume

### Data Flow

```
User Request
    ↓
Next.js App (Port 3000)
    ↓
Database Connection (Internal: db:5432)
    ↓
PostgreSQL + PostGIS
    ↓
Response (GeoJSON)
```

### Auto-Initialization

On first startup, the database automatically executes:
1. `sql/init/001_schema.sql` - Creates all tables, indexes, functions
2. `sql/init/002_seed.sql` - Loads real Howard County road data

## Security Considerations

- **Change default passwords**: Update `DATABASE_PASSWORD` in `.env`
- **Protect API keys**: Never commit `.env` file to Git
- **Use HTTPS in production**: Deploy behind Nginx/Caddy with SSL
- **Restrict database access**: By default, database is not exposed to host
- **Keep Docker updated**: Regularly update Docker and images

## Performance Tuning

### Adjust Database Connection Pool

Edit `.env`:
```bash
DB_POOL_MAX=20              # Maximum connections (default: 10)
DB_IDLE_TIMEOUT_MS=60000    # Idle timeout (default: 30000)
DB_CONN_TIMEOUT_MS=10000    # Connection timeout (default: 5000)
```

Restart services:
```bash
docker compose restart app
```

## Support

For issues or questions:
1. Check logs: `docker compose logs -f`
2. Verify prerequisites are met
3. Review troubleshooting section above
4. Check GitHub issues/discussions

---

**Quick Reference:**
- Application: http://localhost:3000
- Database (optional): localhost:15432
- Logs: `docker compose logs -f`
- Status: `docker compose ps`
- Restart: `docker compose restart`
