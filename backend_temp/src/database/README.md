# Database Schema Documentation

This directory contains the SQL schema definitions for the Trading Backtesting Platform.

## Directory Structure

- `schema/`: Contains the DDL scripts to create the database structure.
  - `01_init_schema.sql`: Core tables (Users, Accounts, Trades).
  - `02_timescale_market_data.sql`: TimescaleDB hypertables for market data.
  - `03_analytics_views.sql`: Materialized views daily/monthly performance.
  - `04_indexes.sql`: Additional performance indexes.
  - `06_security_policies.sql`: Row-Level Security (RLS) policies.
- `seeds/`: Contains initial data for development.
  - `05_seed_data.sql`: Creates a test user and sample trades.

## Prerequisites

- PostgreSQL 14+
- TimescaleDB Extension
- pg_cron (Optional for auto-refreshing views)

## Setup Instructions

1. **Create Database**:
   ```sql
   CREATE DATABASE trading_platform;
   ```

2. **Run Schema Scripts**:
   Order matters! Execute the SQL files in numerical order.
   ```bash
   psql -d trading_platform -f schema/01_init_schema.sql
   psql -d trading_platform -f schema/02_timescale_market_data.sql
   psql -d trading_platform -f schema/03_analytics_views.sql
   psql -d trading_platform -f schema/04_indexes.sql
   # Optional: Enable RLS
   psql -d trading_platform -f schema/06_security_policies.sql
   ```

3. **Seed Data (Development Only)**:
   ```bash
   psql -d trading_platform -f seeds/05_seed_data.sql
   ```

## Key Features

- **TimescaleDB**: Market data is partitioned by time automatically.
- **Materialized Views**: Use `daily_performance_summary` for dashboard charts. Remember to refresh them via `REFRESH MATERIALIZED VIEW` or use the provided function.
- **Row-Level Security**: Enabled on main tables. Ensure your application sets `app.current_user_id` session variable.

## Schema Diagram

See `implementation_plan.md` for the ER diagram.
