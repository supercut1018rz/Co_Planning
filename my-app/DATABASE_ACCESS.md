# Database Access Guide

## Port layout

```
┌─────────────────────────────────────────────────────────────┐
│                   Your machine (host)                        │
│                                                              │
│  Local PostgreSQL ──────► port 5432                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Docker network                             │ │
│  │                                                          │ │
│  │  ┌──────────────┐              ┌──────────────┐        │ │
│  │  │  db container │              │  app container│       │ │
│  │  │               │              │               │       │ │
│  │  │ PostgreSQL    │◄─────────────┤  Next.js     │       │ │
│  │  │   :5432       │  db:5432     │               │       │ │
│  │  │ (inside ctr)  │  (internal)  │               │       │ │
│  │  └──────┬────────┘              └──────────────┘       │ │
│  │         │                                                │ │
│  │         └─ mapped to host port                           │ │
│  └──────────────────────────────────────────────────────────┘ │
│             │                                                 │
│  Host access ─┴───► localhost:5433                            │
│  (pgAdmin, DBeaver, psql, etc.)                                │
└─────────────────────────────────────────────────────────────┘
```

## Two ways to connect

### 1. From app container (automatic)

The app uses the Docker network:

```
Connection string: postgresql://appuser:PASSWORD@db:5432/howard_sidewalk_db
```

- **Host**: `db` (container name, resolved on Docker network)
- **Port**: `5432` (inside container)
- No change needed; docker-compose sets this up

### 2. From your machine (local tools)

Use pgAdmin, DBeaver, psql from the host:

```bash
Host: localhost
Port: 5433  (not 5432)
Database: howard_sidewalk_db
User: appuser
Password: (value from .env)
```

## Examples

### psql

```bash
psql -h localhost -p 5433 -U appuser -d howard_sidewalk_db

# Or connection string
psql postgresql://appuser:PASSWORD@localhost:5433/howard_sidewalk_db
```

### pgAdmin

1. Add new server
2. Connection:
   - **Host**: `localhost`
   - **Port**: `5433`
   - **Maintenance DB**: `howard_sidewalk_db`
   - **Username**: `appuser`
   - **Password**: (your password)

### DBeaver

1. New connection → PostgreSQL
2. Server: `localhost`, Port: `5433`
3. Database: `howard_sidewalk_db`, User: `appuser`, Password: (yours)

## Export from host

To export the Docker DB from the host:

```bash
# In .env
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5433   # 5433
DATABASE_NAME=howard_sidewalk_db
DATABASE_USER=appuser
DATABASE_PASSWORD=your_password

make export-db
```

## Changing the port

Edit `docker-compose.yml`:

```yaml
db:
  ports:
    - "5433:5432"  # Left = host port; right = container (leave as 5432)
```

Common host ports: `5433` (recommended), `15432`, or any free port.

## FAQ

### Why 5433 instead of 5432?

Your machine may already use 5432 for local PostgreSQL. Using 5433 avoids conflict and lets both run.

### App cannot connect to DB

1. Check containers: `docker compose ps`
2. DB logs: `docker compose logs db`
3. Ensure DB is healthy in `docker compose ps`

### Cannot connect from host

1. Use port **5433** (not 5432)
2. Check firewall
3. Verify password in `.env`
4. Confirm DB container is up: `docker compose ps`

### Use 5432 for Docker DB

Stop local PostgreSQL first:

```bash
sudo systemctl stop postgresql

# In docker-compose.yml
ports:
  - "5432:5432"

sudo docker compose down
sudo docker compose up -d
```

## Summary

| Source           | Host        | Port | Notes                    |
|------------------|------------|------|--------------------------|
| App container    | `db`       | 5432 | Docker internal          |
| Host tools       | `localhost`| 5433 | Your machine → Docker DB |
| Local PostgreSQL | `localhost`| 5432 | DB on your machine       |
