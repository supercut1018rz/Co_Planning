# 🚀 Deployment from Archive Package

## Overview

This guide will help you deploy the Howard County Sidewalk Planning System from the provided archive file (`.tar.gz`). The package contains everything you need, including real Howard County road data.

## What's Included

- ✅ Complete Next.js application
- ✅ PostgreSQL database with PostGIS configuration
- ✅ **Real Howard County road data** (9600+ roads from OpenStreetMap)
- ✅ Auto-initialization SQL scripts
- ✅ Docker configuration for one-command deployment
- ✅ Complete documentation

## Prerequisites

Before starting, ensure your server has:

- **Docker** 20.10+ installed and running
- **Docker Compose** v2 (plugin) or v1.29+
- **8GB+ RAM** available
- **10GB+ disk space** available
- **Internet connection** (for pulling Docker images)

## Quick Start (3 Steps)

```bash
# 1. Extract the archive
tar -xzf howard-sidewalk-deployment-YYYYMMDD.tar.gz
cd my-app

# 2. Configure environment variables
cp .env.example .env
nano .env  # Fill in your API keys

# 3. Deploy!
docker compose up -d --build
```

Access the application at: `http://localhost:3000`

## Detailed Instructions

### Step 1: Install Docker (if not already installed)

#### Ubuntu/Debian

```bash
# Install Docker
sudo apt update
sudo apt install docker.io -y
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

#### Other Linux

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo mkdir -p /usr/local/lib/docker/cli-plugins/
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
```

### Step 2: Extract the Archive

```bash
# Extract to current directory
tar -xzf howard-sidewalk-deployment-YYYYMMDD.tar.gz

# Enter the application directory
cd my-app

# Verify extraction
ls -la
# Should see: Dockerfile, docker-compose.yml, .env.example, sql/, scripts/, etc.
```

### Step 3: Configure API Keys

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your preferred editor
nano .env
# or
vim .env
```

**Required Configuration:**

```bash
# OpenAI API Key (REQUIRED)
OPENAI_API_KEY=your_actual_openai_api_key_here

# OpenAI Base URL (use the correct region for your account)
OPENAI_BASE_URL=https://us.api.openai.com/v1
# For US accounts: https://us.api.openai.com/v1
# For EU accounts: https://eu.api.openai.com/v1
# Default: https://api.openai.com/v1

# OpenAI Model
OPENAI_MODEL=gpt-4o

# Mapillary Token (REQUIRED)
MAPILLARY_CLIENT_TOKEN=your_actual_mapillary_token_here

# Database Password (CHANGE IN PRODUCTION!)
DATABASE_PASSWORD=ChangeMe_StrongPW
```

**How to get API keys:**

- **OpenAI API Key**: https://platform.openai.com/api-keys
- **Mapillary Token**: https://www.mapillary.com/dashboard/developers

### Step 4: Deploy the Application

```bash
# Start all services
docker compose up -d --build

# The first build will take 2-5 minutes
# Docker will:
# 1. Pull PostgreSQL image with PostGIS
# 2. Build Next.js application
# 3. Start database and auto-initialize with real road data
# 4. Start application server
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

# Verify database has real data
docker compose exec db psql -U appuser -d howard_sidewalk_db -c "SELECT COUNT(*) FROM roads_howard;"
# Should show a large number (e.g., 9000+)

# Test API
curl http://localhost:3000/api/sidewalks?scenario=base
# Should return JSON with sidewalk data
```

### Step 6: Access the Application

#### From the Server

```
http://localhost:3000
```

#### From Another Computer

First, get the server's IP address:

```bash
hostname -I
# Example output: 192.168.1.100
```

Then access from another computer's browser:

```
http://192.168.1.100:3000
```

## Management Commands

### Using Makefile (Recommended)

```bash
# View all commands
make help

# Start services
make up

# Stop services
make down

# View logs
make logs

# Check status
make ps

# Restart
make restart
```

### Using Docker Compose

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs (follow mode)
docker compose logs -f

# View logs (last 100 lines)
docker compose logs --tail=100

# Restart specific service
docker compose restart app
docker compose restart db

# Check status
docker compose ps
```

## Troubleshooting

### Issue: Cannot start - port 5432 already in use

**Error message:** `Bind for 0.0.0.0:5432 failed`

**Solution:** This means you have PostgreSQL running locally. The database port configuration in `docker-compose.yml` should use port 15432 (not 5432). Check the file:

```bash
grep -A 2 "ports:" docker-compose.yml | grep -A 1 "db:" -A 3
```

It should show port 15432 or be commented out (recommended).

### Issue: OpenAI authentication failed

**Error:** `❌ OpenAI auth failed (401)`

**Solutions:**

1. Verify your API key in `.env` is correct
2. Check `OPENAI_BASE_URL` matches your account region:
   ```bash
   # Test your API key
   curl https://us.api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```
3. Restart services after changing `.env`:
   ```bash
   docker compose down
   docker compose up -d
   ```

### Issue: Application starts but shows errors

**Check logs:**

```bash
# Application logs
docker compose logs app

# Database logs
docker compose logs db

# All logs
docker compose logs
```

Common issues:
- Missing API keys in `.env`
- Database still initializing (wait 30-60 seconds)
- Firewall blocking port 3000

### Issue: No road data / empty results

**Check database:**

```bash
docker compose exec db psql -U appuser -d howard_sidewalk_db -c "
SELECT 
  (SELECT COUNT(*) FROM roads_howard) as roads,
  (SELECT COUNT(*) FROM scenarios) as scenarios,
  (SELECT COUNT(*) FROM sidewalks_howard) as sidewalks;
"
```

**Solution:** If roads count is 0:

```bash
# Check if initialization ran
docker compose logs db | grep "initialized successfully"

# If not, reset and reinitialize
docker compose down -v
docker compose up -d --build
```

### Issue: Cannot access from another computer

**Solutions:**

1. Check firewall:
   ```bash
   sudo ufw allow 3000/tcp
   ```

2. Verify port 3000 is listening:
   ```bash
   sudo netstat -tlnp | grep 3000
   ```

3. Test from server:
   ```bash
   curl http://localhost:3000
   ```

## Updating

To update the application:

1. Get the new archive file
2. Stop current services:
   ```bash
   docker compose down
   ```
3. Backup data (optional):
   ```bash
   docker compose exec db pg_dump -U appuser howard_sidewalk_db > backup.sql
   ```
4. Extract new archive
5. Copy your `.env` file to the new directory
6. Start services:
   ```bash
   docker compose up -d --build
   ```

## Uninstalling

```bash
# Stop and remove containers
docker compose down

# Also remove database (⚠️ deletes all data!)
docker compose down -v

# Remove images (optional)
docker rmi $(docker images -q my-app*)
```

## Database Access (Optional)

The database is accessible on port **15432** (not 5432):

```bash
# Using psql
psql -h localhost -p 15432 -U appuser -d howard_sidewalk_db

# Using pgAdmin or DBeaver:
Host: localhost
Port: 15432
Database: howard_sidewalk_db
User: appuser
Password: (from .env)
```

## Architecture

```
┌─────────────────────────────────────┐
│         Your Computer/Server        │
│                                     │
│  ┌──────────────────────────────┐  │
│  │      Docker Network          │  │
│  │                              │  │
│  │  ┌────────┐   ┌──────────┐  │  │
│  │  │  App   │   │Database  │  │  │
│  │  │:3000   │──→│:5432     │  │  │
│  │  │Next.js │   │Postgres  │  │  │
│  │  └────────┘   │+ PostGIS │  │  │
│  │                └──────────┘  │  │
│  └──────────────────────────────┘  │
│         ↓                           │
│    Port 3000                        │
└─────────────────────────────────────┘
         ↓
    Your Browser
```

## Performance

The system is designed to handle:
- Thousands of roads
- Hundreds of planning scenarios
- Multiple concurrent users (with proper hardware)

**Recommended minimum specs:**
- 2 CPU cores
- 8GB RAM
- 20GB disk space

## Security

**Important:**
1. Change `DATABASE_PASSWORD` in `.env` (production)
2. Use HTTPS in production (deploy behind Nginx/Caddy)
3. Never expose `.env` file
4. Keep Docker and images updated
5. Use firewall to restrict access

## Support

If you encounter issues:

1. Check logs: `docker compose logs -f`
2. Review troubleshooting section above
3. Verify all prerequisites are met
4. Ensure `.env` file is properly configured

## Quick Reference Card

```bash
# Deploy
docker compose up -d --build

# Status
docker compose ps

# Logs
docker compose logs -f

# Stop
docker compose down

# Restart
docker compose restart

# Access
http://localhost:3000

# Database
psql -h localhost -p 15432 -U appuser -d howard_sidewalk_db
```

---

**Need Help?** Check `DEPLOYMENT.md` for more detailed documentation.
