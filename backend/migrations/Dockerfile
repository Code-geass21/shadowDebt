FROM postgres:16-alpine

# Bake the migration scripts directly into the database image using absolute repository paths.
# Postgres automatically runs anything in this directory in alphabetical order.
COPY backend/migrations/init.sql /docker-entrypoint-initdb.d/01_init.sql
COPY backend/migrations/002_targets.sql /docker-entrypoint-initdb.d/02_targets.sql
COPY backend/migrations/003_advanced_loans.sql /docker-entrypoint-initdb.d/03_advanced_loans.sql
COPY backend/migrations/004_schema_sync.sql /docker-entrypoint-initdb.d/04_schema_sync.sql
COPY backend/migrations/006_app_settings.sql /docker-entrypoint-initdb.d/05_app_settings.sql
COPY backend/migrations/007_defaulted_status.sql /docker-entrypoint-initdb.d/06_defaulted_status.sql
# 👇 NEW: Inject the authentication system for fresh installations 👇
COPY backend/migrations/008_auth_system.sql /docker-entrypoint-initdb.d/07_auth_system.sql
COPY backend/migrations/seed.sql /docker-entrypoint-initdb.d/99_seed.sql
