#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-phts_system}"

timestamp="$(date +%Y%m%d_%H%M%S)"
mkdir -p "${BACKUP_DIR}"

export MYSQL_PWD="${DB_PASSWORD}"
backup_file="${BACKUP_DIR}/${DB_NAME}_${timestamp}.sql.gz"

mysqldump -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" "${DB_NAME}" \
  | gzip > "${backup_file}"

unset MYSQL_PWD

find "${BACKUP_DIR}" -type f -name "${DB_NAME}_*.sql.gz" -mtime +"${BACKUP_RETENTION_DAYS}" -delete

echo "Backup written to ${backup_file}"
