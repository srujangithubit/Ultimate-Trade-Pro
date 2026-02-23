# Database Backup & Recovery Procedures

## Automated Daily Backups

### Backup Script
```bash
#!/bin/bash
# File: scripts/backup_database.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"
DB_NAME="trading_platform"
DB_USER="postgres"
DB_HOST="localhost"

# Create backup
pg_dump -h $DB_HOST -U $DB_USER -Fc -d $DB_NAME > $BACKUP_DIR/backup_$DATE.dump

# Upload to S3
aws s3 cp $BACKUP_DIR/backup_$DATE.dump s3://trading-platform-backups/daily/

# Keep only last 30 days locally
find $BACKUP_DIR -name "backup_*.dump" -mtime +30 -delete

# Verify backup
pg_restore -l $BACKUP_DIR/backup_$DATE.dump > /dev/null
if [ $? -eq 0 ]; then
    echo "Backup verified successfully: $DATE"
else
    echo "ERROR: Backup verification failed: $DATE"
    # Send alert
fi
```

### Cron Schedule
```
0 2 * * * /scripts/backup_database.sh
```

## Point-in-Time Recovery

### Enable WAL Archiving
```sql
-- In postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /archive/%f'
```

## Recovery Procedures

### Full Database Restore
```bash
# Stop application
# Drop existing database
dropdb trading_platform

# Create new database
createdb trading_platform

# Restore from backup
pg_restore -h localhost -U postgres -d trading_platform backup_20260214.dump

# Verify
psql -d trading_platform -c "SELECT COUNT(*) FROM users;"
```

### Point-in-Time Recovery
```bash
# Restore base backup
pg_restore -d trading_platform base_backup.dump

# Create recovery.conf
cat > recovery.conf <<EOF
restore_command = 'cp /archive/%f %p'
recovery_target_time = '2026-02-14 12:00:00'
EOF

# Start PostgreSQL - it will replay WAL to the target time
```

## RTO/RPO Targets
- **RTO (Recovery Time Objective):** 4 hours
- **RPO (Recovery Point Objective):** 1 hour
