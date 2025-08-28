#!/bin/bash

# Automated backup script for BoosterBeacon
# Runs daily via cron to create database backups

set -e

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="booster_beacon_${TIMESTAMP}"
RETENTION_DAYS=30

# Database connection details
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-booster_beacon}"
DB_USER="${POSTGRES_USER:-postgres}"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

log "Starting database backup: $BACKUP_NAME"

# Create database dump
pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --verbose \
    --clean \
    --no-owner \
    --no-privileges \
    --format=custom \
    --file="$BACKUP_DIR/${BACKUP_NAME}.dump"

if [ $? -eq 0 ]; then
    log "Database backup completed successfully"
    
    # Compress backup
    gzip "$BACKUP_DIR/${BACKUP_NAME}.dump"
    
    # Calculate checksum
    CHECKSUM=$(sha256sum "$BACKUP_DIR/${BACKUP_NAME}.dump.gz" | cut -d' ' -f1)
    echo "$CHECKSUM" > "$BACKUP_DIR/${BACKUP_NAME}.dump.gz.sha256"
    
    log "Backup compressed and checksum created: $CHECKSUM"
    
    # Clean up old backups
    find "$BACKUP_DIR" -name "booster_beacon_*.dump.gz" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "booster_beacon_*.dump.gz.sha256" -mtime +$RETENTION_DAYS -delete
    
    log "Old backups cleaned up (retention: $RETENTION_DAYS days)"
    
    # Log backup info
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/${BACKUP_NAME}.dump.gz" | cut -f1)
    log "Backup completed: ${BACKUP_NAME}.dump.gz (${BACKUP_SIZE})"
    
else
    log "ERROR: Database backup failed"
    exit 1
fi