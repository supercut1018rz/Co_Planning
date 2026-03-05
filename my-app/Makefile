.PHONY: help up down logs restart reset-db export-schema export-seed export-db ps

help:
	@echo "Howard County Sidewalk Planning System - Commands:"
	@echo ""
	@echo "  make up              - Start all services (background)"
	@echo "  make down            - Stop all services"
	@echo "  make logs            - View logs"
	@echo "  make restart         - Restart services"
	@echo "  make ps              - Service status"
	@echo "  make reset-db        - Reset DB (remove volume, re-init on next up)"
	@echo ""
	@echo "  make export-schema   - Export schema to sql/init/001_schema.sql"
	@echo "  make export-seed    - Export seed data to sql/init/002_seed.sql"
	@echo "  make export-db      - Export schema + seed"
	@echo ""
	@echo "Export commands require DB connection in .env"

DOCKER_COMPOSE := $(shell command -v docker-compose 2> /dev/null)
ifndef DOCKER_COMPOSE
	DOCKER_COMPOSE := docker compose
endif

up:
	$(DOCKER_COMPOSE) up -d --build

down:
	$(DOCKER_COMPOSE) down

logs:
	$(DOCKER_COMPOSE) logs -f --tail=200

restart:
	$(DOCKER_COMPOSE) restart

ps:
	$(DOCKER_COMPOSE) ps

reset-db:
	@echo "⚠️  This will delete all database data!"
	@read -p "Continue? [y/N] " confirm; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		$(DOCKER_COMPOSE) down -v; \
		echo "✅ DB reset. Run 'make up' to re-init."; \
	else \
		echo "❌ Cancelled"; \
	fi

export-schema:
	@echo "📤 Exporting schema..."
	@bash scripts/export_db.sh --schema-only

export-seed:
	@echo "📤 Exporting seed data..."
	@bash scripts/export_db.sh --seed-only

export-db:
	@echo "📤 Exporting schema and seed..."
	@bash scripts/export_db.sh --all
