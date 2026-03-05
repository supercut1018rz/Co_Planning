# 🎯 Quick Start - Howard County Sidewalk Planning System

Thank you for receiving this deployment package! This system is ready to deploy with **one command**.

## ⚡ 3-Step Deployment

```bash
# 1. Extract archive
tar -xzf howard-sidewalk-deployment-*.tar.gz
cd my-app

# 2. Configure API keys
cp .env.example .env
nano .env  # Add your OpenAI and Mapillary API keys

# 3. Deploy!
docker compose up -d --build
```

**Access:** http://localhost:3000

## 📋 Prerequisites

- Docker 20.10+
- Docker Compose v2
- 8GB+ RAM
- OpenAI API key (get from https://platform.openai.com/api-keys)
- Mapillary token (get from https://www.mapillary.com/dashboard/developers)

## 📖 Documentation

- **Quick Start:** This file
- **Detailed Instructions:** See `DEPLOYMENT_FROM_ARCHIVE.md`
- **Complete Documentation:** See `DEPLOYMENT.md`
- **Troubleshooting:** See `DEPLOYMENT_FROM_ARCHIVE.md` → Troubleshooting section

## ✅ What's Included

- Complete Next.js application
- PostgreSQL database with PostGIS
- **Real Howard County road data** (9600+ roads)
- Auto-initialization scripts
- All dependencies

## 🆘 Need Help?

1. Check you have Docker installed: `docker --version`
2. Check you filled in `.env` with real API keys
3. Check logs: `docker compose logs -f`
4. See troubleshooting in `DEPLOYMENT_FROM_ARCHIVE.md`

## 🎉 That's It!

The system will be ready in 2-5 minutes. No database setup needed, no data import needed - everything is automated!
