# ✅ Deployment Checklist

Print this page and follow step by step.

---

## 📋 Pre-Deployment

- [ ] Server with Ubuntu 20.04+ (or similar Linux)
- [ ] 8GB+ RAM available
- [ ] 10GB+ disk space available
- [ ] Root or sudo access
- [ ] OpenAI API key (get from https://platform.openai.com/api-keys)
- [ ] Mapillary token (get from https://www.mapillary.com/dashboard/developers)
- [ ] Downloaded deployment archive: `howard-sidewalk-deployment-*.tar.gz`

---

## 🔧 Step 1: Install Docker

```bash
sudo apt update
sudo apt install docker.io docker-compose-plugin -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
newgrp docker
```

**Verify:**
```bash
docker --version
docker compose version
```

- [ ] Docker installed successfully
- [ ] Docker Compose installed successfully

---

## 📦 Step 2: Extract Archive

```bash
tar -xzf howard-sidewalk-deployment-*.tar.gz
cd my-app
```

**Verify:**
```bash
ls -l
```

- [ ] `docker-compose.yml` exists
- [ ] `Dockerfile` exists
- [ ] `.env.example` exists
- [ ] `sql/init/` directory exists

---

## ⚙️ Step 3: Configure Environment

```bash
cp .env.example .env
nano .env
```

**Fill in these values:**

```bash
OPENAI_API_KEY=_________________________________
MAPILLARY_CLIENT_TOKEN=_________________________
DATABASE_PASSWORD=______________________________
```

- [ ] Filled in `OPENAI_API_KEY`
- [ ] Filled in `MAPILLARY_CLIENT_TOKEN`
- [ ] Changed `DATABASE_PASSWORD` (production)
- [ ] Saved file (Ctrl+X, Y, Enter)

---

## 🚀 Step 4: Deploy

```bash
docker compose up -d --build
```

**Wait 3-5 minutes for build to complete.**

- [ ] No error messages during build
- [ ] Build completed successfully

---

## ✅ Step 5: Verify Deployment

### Check Container Status

```bash
docker compose ps
```

**Expected output:**
```
NAME                    STATUS
howard_sidewalk_app     Up (healthy)
howard_sidewalk_db      Up (healthy)
```

- [ ] Both containers are "Up"
- [ ] Both show "healthy" status

---

### Check Database

```bash
docker compose exec db psql -U appuser -d howard_sidewalk_db -c "SELECT COUNT(*) FROM roads_howard;"
```

**Expected:** ~9613 roads

- [ ] Road count > 9000

---

### Check Logs

```bash
docker compose logs app --tail=50
```

- [ ] No critical errors in logs
- [ ] Application started successfully

---

### Test API

```bash
curl http://localhost:3000/api/sidewalks?scenario=base
```

**Expected:** JSON response with sidewalk data

- [ ] API responds successfully
- [ ] Returns JSON data

---

### Test Web Interface

**From server:**
```bash
curl http://localhost:3000
```

**From browser:**
```
http://localhost:3000
```

- [ ] Port 3000 is accessible
- [ ] Web page loads successfully
- [ ] Map interface appears

---

## 🌐 Step 6: External Access (Optional)

### Get Server IP

```bash
hostname -I
```

IP Address: ___________________________________________

### Open Firewall

```bash
sudo ufw allow 3000/tcp
```

- [ ] Firewall rule added
- [ ] Can access from external browser: `http://SERVER_IP:3000`

---

## 🧪 Step 7: Functional Test

1. Open application in browser
2. Try natural language input: "Add sidewalk on both sides of Fels Lane"
3. Verify:
   - [ ] Input accepted
   - [ ] AI processes request
   - [ ] Sidewalk appears on map
   - [ ] Street imagery loads (Mapillary)

---

## 📝 Post-Deployment Notes

### Important Commands

```bash
# View logs
docker compose logs -f

# Restart services
docker compose restart

# Stop services
docker compose down

# Update application
docker compose down
docker compose up -d --build
```

---

### Backup Database

```bash
docker compose exec db pg_dump -U appuser howard_sidewalk_db > backup-$(date +%Y%m%d).sql
```

---

### Monitor Resources

```bash
# Check disk usage
df -h

# Check memory
free -h

# Check Docker resources
docker stats
```

---

## ⚠️ Troubleshooting

### If containers won't start:

```bash
docker compose logs
```

### If database initialization failed:

```bash
docker compose down -v
docker compose up -d --build
```

### If OpenAI authentication fails:

1. Check API key in `.env`
2. Verify `OPENAI_BASE_URL` matches your region
3. Restart: `docker compose restart`

### If port 3000 is blocked:

```bash
sudo ufw status
sudo ufw allow 3000/tcp
sudo systemctl restart docker
```

---

## 📊 Deployment Summary

**Date:** ___________________  
**Server IP:** ___________________  
**Deployed by:** ___________________

**Status:**
- [ ] ✅ Deployment successful
- [ ] ✅ All tests passed
- [ ] ✅ Accessible from browser
- [ ] ✅ Functional test passed

**Notes:**
_____________________________________________
_____________________________________________
_____________________________________________

---

## 🎉 Success!

You have successfully deployed the Howard County Sidewalk Planning System!

**Access:** http://localhost:3000 or http://YOUR_SERVER_IP:3000

**Documentation:**
- QUICK_START.md - Quick reference
- DEPLOYMENT_FROM_ARCHIVE.md - Detailed guide
- DATABASE_ACCESS.md - Database access

---

**Deployment Time:** _______ minutes  
**Difficulty:** Easy ⭐⭐⭐  
**Version:** 1.0
