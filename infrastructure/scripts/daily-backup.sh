#!/bin/bash
# =============================================================================
# Trading Platform - Automated Daily Backup Script
# =============================================================================
# Usage: ./daily-backup.sh
# Cron:  0 2 * * * /path/to/daily-backup.sh >> /var/log/backup.log 2>&1
#
# Required environment variables:
#   DB_HOST, DB_USER, DB_NAME, DB_PASSWORD
#   AWS_REGION, S3_BACKUP_BUCKET (or defaults used)
# =============================================================================

set -euo pipefail

# --- Configuration ---
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
S3_BUCKET="${S3_BACKUP_BUCKET:-trading-platform-backups}"
S3_PREFIX="postgres"
BACKUP_FILE="backup-${DATE}.sql.gz"
LOG_PREFIX="[BACKUP]"

# --- Functions ---
log_info()  { echo "${LOG_PREFIX} [INFO]  $(date +'%Y-%m-%d %H:%M:%S') - $1"; }
log_error() { echo "${LOG_PREFIX} [ERROR] $(date +'%Y-%m-%d %H:%M:%S') - $1" >&2; }
log_warn()  { echo "${LOG_PREFIX} [WARN]  $(date +'%Y-%m-%d %H:%M:%S') - $1"; }

cleanup() {
  if [ $? -ne 0 ]; then
    log_error "Backup FAILED. Check logs for details."
    # Send alert (customize for your notification system)
    # curl -s -X POST "$SLACK_WEBHOOK" -d '{"text":"❌ Database backup failed!"}'
  fi
}
trap cleanup EXIT

# --- Validate prerequisites ---
for cmd in pg_dump gzip aws; do
  if ! command -v "$cmd" &>/dev/null; then
    log_error "Required command '$cmd' not found. Aborting."
    exit 1
  fi
done

if [ -z "${DB_HOST:-}" ] || [ -z "${DB_USER:-}" ] || [ -z "${DB_NAME:-}" ]; then
  log_error "Required environment variables DB_HOST, DB_USER, DB_NAME must be set."
  exit 1
fi

# --- Create backup directory ---
mkdir -p "$BACKUP_DIR"
log_info "Starting backup of database '$DB_NAME' on '$DB_HOST'"

# --- Perform database dump ---
log_info "Creating compressed dump: $BACKUP_FILE"
PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=custom \
  --compress=9 \
  --verbose \
  --no-owner \
  --no-privileges \
  2>/dev/null | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

BACKUP_SIZE=$(du -sh "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
log_info "Dump complete. Size: ${BACKUP_SIZE}"

# --- Verify backup integrity ---
log_info "Verifying backup integrity..."
if gunzip -t "${BACKUP_DIR}/${BACKUP_FILE}"; then
  log_info "✅ Backup integrity verified."
else
  log_error "❌ Backup integrity check FAILED!"
  rm -f "${BACKUP_DIR}/${BACKUP_FILE}"
  exit 1
fi

# --- Upload to S3 ---
log_info "Uploading to s3://${S3_BUCKET}/${S3_PREFIX}/${DATE}/"
aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" \
  "s3://${S3_BUCKET}/${S3_PREFIX}/${DATE}/${BACKUP_FILE}" \
  --storage-class STANDARD_IA \
  --quiet

# Verify S3 upload
if aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/${DATE}/${BACKUP_FILE}" &>/dev/null; then
  log_info "✅ S3 upload verified."
else
  log_error "❌ S3 upload verification FAILED!"
  exit 1
fi

# --- Apply retention policy ---
log_info "Applying ${RETENTION_DAYS}-day retention policy on local backups..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "backup-*.sql.gz" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
log_info "Deleted ${DELETED_COUNT} old local backup(s)."

# S3 lifecycle policy should handle remote retention (configured in S3 bucket settings)

# --- Summary ---
log_info "========================================="
log_info "Backup completed successfully!"
log_info "  Database:  ${DB_NAME}"
log_info "  File:      ${BACKUP_FILE}"
log_info "  Size:      ${BACKUP_SIZE}"
log_info "  S3 Path:   s3://${S3_BUCKET}/${S3_PREFIX}/${DATE}/${BACKUP_FILE}"
log_info "========================================="

exit 0
