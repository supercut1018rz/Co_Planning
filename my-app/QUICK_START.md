# 🚀 Quick Start Guide

Deploy Howard County Sidewalk Planning System in **5 minutes**.

---

## 📋 Prerequisites

- A Linux server (Ubuntu 20.04+ recommended)
- 8GB+ RAM
- 10GB+ disk space
- Root or sudo access

---

## ⚡ Quick Deploy (3 Steps)

### Step 1: Install Docker

#### Ubuntu/Debian

```bash
# Update package list
sudo apt update

# Install Docker
sudo apt install docker.io -y

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group (to run without sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
```

#### Install Docker Compose

```bash
# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Verify installation
docker compose version
```

**Expected output:**
```
Docker Compose version v2.x.x
```

---

### Step 2: Extract and Configure

```bash
# Extract the archive
tar -xzf howard-sidewalk-deployment-*.tar.gz
cd my-app

# Copy environment template
cp .env.example .env

# Edit environment file
nano .env
```

**Required configuration in `.env`:**

```bash
# OpenAI API Key (REQUIRED)
OPENAI_API_KEY=sk-proj-your-actual-key-here

# OpenAI Base URL (use correct region)
OPENAI_BASE_URL=https://us.api.openai.com/v1

# Mapillary Token (REQUIRED)
MAPILLARY_CLIENT_TOKEN=your-actual-token-here

# Database Password (change in production!)
DATABASE_PASSWORD=ChangeMe_StrongPW
```

**Get API keys:**
- OpenAI: https://platform.openai.com/api-keys
- Mapillary: https://www.mapillary.com/dashboard/developers

**Save and exit:** Press `Ctrl+X`, then `Y`, then `Enter`

---

### Step 3: Deploy

```bash
# Start all services
docker compose up -d --build

# Wait 3-5 minutes for first build
```

**Monitor progress:**
```bash
# Check container status
docker compose ps

# View logs
docker compose logs -f
```

**Expected output:**
```
NAME                    STATUS
howard_sidewalk_app     Up (healthy)
howard_sidewalk_db      Up (healthy)
```

---

## ✅ Access the Application

### From the Server

```
http://localhost:3000
```

### From Another Computer

1. Get server IP:
   ```bash
   hostname -I
   ```

2. Access from browser:
   ```
   http://YOUR_SERVER_IP:3000
   ```

**Note:** You may need to open port 3000 in firewall:
```bash
sudo ufw allow 3000/tcp
```

---

## 🎯 Verify Deployment

### Check Database

```bash
# Check road data count
docker compose exec db psql -U appuser -d howard_sidewalk_db -c "SELECT COUNT(*) FROM roads_howard;"
```

**Expected:** 9000+ roads

### Test API

```bash
curl http://localhost:3000/api/sidewalks?scenario=base
```

**Expected:** JSON response with sidewalk data

---

## 🛠️ Common Commands

```bash
# View logs
docker compose logs -f

# Restart services
docker compose restart

# Stop services
docker compose down

# Stop and remove data (⚠️ removes all data)
docker compose down -v
```

---

## 🐛 Troubleshooting

### Issue: Docker command not found

**Solution:**
```bash
# Install Docker
sudo apt update
sudo apt install docker.io -y
sudo systemctl start docker
```

---

### Issue: Permission denied

**Solution:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Or use sudo
sudo docker compose up -d --build
```

---

### Issue: Port 3000 already in use

**Solution:**
```bash
# Check what's using port 3000
sudo lsof -i :3000

# Stop the conflicting service or change port in docker-compose.yml
```

---

### Issue: OpenAI authentication failed (401)

**Solution:**
1. Verify API key in `.env` is correct
2. Check `OPENAI_BASE_URL` matches your account region
3. Test API key:
   ```bash
   curl https://us.api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```
4. Restart services:
   ```bash
   docker compose down
   docker compose up -d
   ```

---

### Issue: Database initialization failed

**Solution:**
```bash
# Check database logs
docker compose logs db

# Reset and restart
docker compose down -v
docker compose up -d --build
```

---

### Issue: Cannot access from another computer

**Solution:**
```bash
# 1. Check firewall
sudo ufw status
sudo ufw allow 3000/tcp

# 2. Verify container is listening
docker compose ps
sudo netstat -tlnp | grep 3000

# 3. Test from server first
curl http://localhost:3000
```

---

## 📚 What's Included

- ✅ Next.js application (TypeScript)
- ✅ PostgreSQL 16 with PostGIS
- ✅ **Real Howard County road data** (9,613 roads from OpenStreetMap)
- ✅ Automatic database initialization
- ✅ AI-powered sidewalk planning (OpenAI GPT-4o)
- ✅ Interactive map interface (Leaflet)
- ✅ Street-level imagery (Mapillary)

---

## 🔒 Security Notes

### For Production

1. **Change database password:**
   ```bash
   nano .env
   # Set DATABASE_PASSWORD to a strong password
   ```

2. **Use HTTPS:**
   - Deploy behind Nginx or Caddy
   - Use Let's Encrypt for SSL certificate

3. **Firewall:**
   ```bash
   sudo ufw enable
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 3000/tcp  # Application
   ```

4. **Keep updated:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

---

## 📖 Additional Documentation

For more details, see:

- `DEPLOYMENT_FROM_ARCHIVE.md` - Detailed deployment guide
- `DEPLOYMENT.md` - Complete documentation
- `DATABASE_ACCESS.md` - Database access guide
- `README.md` - Project overview

---

## 💡 Tips

### Speed up deployment

```bash
# On a fast connection, deployment takes 3-5 minutes
# On a slow connection, it may take 10-15 minutes

# Monitor download progress
docker compose up -d --build --progress=plain
```

### Access database directly

```bash
# Using psql
docker compose exec db psql -U appuser -d howard_sidewalk_db

# Or from host (port 15432)
psql -h localhost -p 15432 -U appuser -d howard_sidewalk_db
```

### View specific service logs

```bash
# Application logs
docker compose logs app -f

# Database logs
docker compose logs db -f
```

---

## 🎉 Success!

You should now have:

✅ Application running at `http://localhost:3000`  
✅ Database with 9,613 real roads  
✅ AI-powered sidewalk planning  
✅ Interactive map interface  

**Try it:**
1. Open `http://localhost:3000`
2. Type: "Add sidewalk on both sides of Fels Lane"
3. See AI-generated sidewalk plan!

---

## 🆘 Need Help?

1. **Check logs:** `docker compose logs -f`
2. **Read troubleshooting:** See section above
3. **Verify requirements:** Docker, API keys, ports
4. **Review documentation:** `DEPLOYMENT_FROM_ARCHIVE.md`

---

## 📊 System Architecture

```
┌─────────────────────────────────────┐
│         Your Server                 │
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

---

**Last Updated:** 2026-02-03  
**Version:** 1.0  
**Deployment Time:** ~5 minutes  
**Difficulty:** Easy ⭐⭐⭐
