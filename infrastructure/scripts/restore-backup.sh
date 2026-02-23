#!/bin/bash
# =============================================================================
# Trading Platform - Restore from Backup
# =============================================================================
# Usage: ./restore-backup.sh <S3_PATH_OR_LOCAL_FILE> [TARGET_DB_NAME]
#
# Examples:
#   ./restore-backup.sh s3://trading-platform-backups/postgres/20260214/backup-20260214_020000.sql.gz
#   ./restore-backup.sh /backups/postgres/backup-20260214_020000.sql.gz my_restored_db
# =============================================================================

set -euo pipefail

# --- Configuration ---
RESTORE_DIR="${RESTORE_DIR:-/tmp/restore}"
S3_PATH="${1:-}"
TARGET_DB="${2:-${DB_NAME:-trading_platform}}"
LOG_PREFIX="[RESTORE]"

# --- Functions ---
log_info()  { echo "${LOG_PREFIX} [INFO]  $(date +'%Y-%m-%d %H:%M:%S') - $1"; }
log_error() { echo "${LOG_PREFIX} [ERROR] $(date +'%Y-%m-%d %H:%M:%S') - $1" >&2; }
log_warn()  { echo "${LOG_PREFIX} [WARN]  $(date +'%Y-%m-%d %H:%M:%S') - $1"; }

# --- Validate input ---
if [ -z "$S3_PATH" ]; then
  echo "Usage: $0 <S3_PATH_OR_LOCAL_FILE> [TARGET_DB_NAME]"
  echo ""
  echo "Arguments:"
  echo "  S3_PATH_OR_LOCAL_FILE  - S3 URI or local path to backup file"
  echo "  TARGET_DB_NAME         - Target database name (default: \$DB_NAME)"
  exit 1
fi

# --- Create restore directory ---
mkdir -p "$RESTORE_DIR"

# --- Download backup if S3 path ---
if [[ "$S3_PATH" == s3://* ]]; then
  BACKUP_FILENAME=$(basename "$S3_PATH")
  log_info "Downloading backup from S3: $S3_PATH"
  aws s3 cp "$S3_PATH" "${RESTORE_DIR}/${BACKUP_FILENAME}"
  LOCAL_FILE="${RESTORE_DIR}/${BACKUP_FILENAME}"
else
  LOCAL_FILE="$S3_PATH"
  BACKUP_FILENAME=$(basename "$LOCAL_FILE")
fi

# --- Verify file exists ---
if [ ! -f "$LOCAL_FILE" ]; then
  log_error "Backup file not found: $LOCAL_FILE"
  exit 1
fi

# --- Verify integrity ---
log_info "Verifying backup integrity..."
if ! gunzip -t "$LOCAL_FILE"; then
  log_error "❌ Backup file is corrupted!"
  exit 1
fi
log_info "✅ Backup integrity verified."

# --- Safety confirmation ---
log_warn "⚠️  This will restore to database: ${TARGET_DB}"
log_warn "⚠️  Host: ${DB_HOST:-localhost}"
read -p "Are you sure you want to proceed? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  log_info "Restore cancelled by user."
  exit 0
fi

# --- Decompress ---
log_info "Decompressing backup..."
DECOMPRESSED_FILE="${RESTORE_DIR}/${BACKUP_FILENAME%.gz}"
gunzip -k -f "$LOCAL_FILE"

# --- Restore database ---
log_info "Restoring to database '${TARGET_DB}' on '${DB_HOST:-localhost}'..."

# Drop existing connections
PGPASSWORD="${DB_PASSWORD:-}" psql \
  -h "${DB_HOST:-localhost}" \
  -U "${DB_USER:-postgres}" \
  -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TARGET_DB}' AND pid <> pg_backend_pid();" \
  2>/dev/null || true

# Drop and recreate database
PGPASSWORD="${DB_PASSWORD:-}" psql \
  -h "${DB_HOST:-localhost}" \
  -U "${DB_USER:-postgres}" \
  -d postgres \
  -c "DROP DATABASE IF EXISTS ${TARGET_DB};" \
  -c "CREATE DATABASE ${TARGET_DB};" \
  2>/dev/null

# Restore from dump
PGPASSWORD="${DB_PASSWORD:-}" pg_restore \
  -h "${DB_HOST:-localhost}" \
  -U "${DB_USER:-postgres}" \
  -d "${TARGET_DB}" \
  --no-owner \
  --no-privileges \
  --verbose \
  "$DECOMPRESSED_FILE" 2>/dev/null || \
PGPASSWORD="${DB_PASSWORD:-}" psql \
  -h "${DB_HOST:-localhost}" \
  -U "${DB_USER:-postgres}" \
  -d "${TARGET_DB}" \
  -f "$DECOMPRESSED_FILE" 2>/dev/null

# --- Verify restore ---
log_info "Verifying restore..."
TABLE_COUNT=$(PGPASSWORD="${DB_PASSWORD:-}" psql \
  -h "${DB_HOST:-localhost}" \
  -U "${DB_USER:-postgres}" \
  -d "${TARGET_DB}" \
  -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" \
  2>/dev/null | tr -d ' ')

log_info "Restored ${TABLE_COUNT} tables to database '${TARGET_DB}'."

# --- Cleanup ---
rm -f "$DECOMPRESSED_FILE"
log_info "Cleaned up temporary files."

# --- Summary ---
log_info "========================================="
log_info "✅ Restore completed successfully!"
log_info "  Source:   ${BACKUP_FILENAME}"
log_info "  Target:   ${TARGET_DB}"
log_info "  Tables:   ${TABLE_COUNT}"
log_info "========================================="

exit 0
