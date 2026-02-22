#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
DRY_RUN="${DRY_RUN:-true}"
ALLOW_RESTORE="${ALLOW_RESTORE:-false}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-phts_system}"

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "Usage: ./src/scripts/jobs/restore.sh <backup.sql.gz>"
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

if [[ "${BACKUP_FILE}" != *.sql.gz ]]; then
  echo "Invalid backup file extension. Expected .sql.gz"
  exit 1
fi

if [[ "${DB_NAME}" == "mysql" || "${DB_NAME}" == "information_schema" || "${DB_NAME}" == "performance_schema" ]]; then
  echo "Refusing to restore into system database: ${DB_NAME}"
  exit 1
fi

echo "Restore target: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "Backup file: ${BACKUP_FILE}"

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "[DRY_RUN] Validation passed. No data was restored."
  exit 0
fi

if [[ "${ALLOW_RESTORE}" != "true" ]]; then
  echo "Restore blocked. Set ALLOW_RESTORE=true to confirm destructive operation."
  exit 1
fi

export MYSQL_PWD="${DB_PASSWORD}"
gunzip -c "${BACKUP_FILE}" | mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" "${DB_NAME}"
unset MYSQL_PWD

echo "Restore completed successfully."
