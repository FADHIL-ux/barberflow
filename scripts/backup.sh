#!/usr/bin/env bash
# ==============================================================================
# BarberFlow — Database Backup Script (pg_dump + gzip)
# Otomatis menyimpan backup dengan timestamp dan retensi 30 hari.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"

# Muat variabel lingkungan
if [ -f "${ROOT_DIR}/.env.prod" ]; then
    echo ">> Memuat konfigurasi dari .env.prod..."
    set -a
    source "${ROOT_DIR}/.env.prod"
    set +a
elif [ -f "${ROOT_DIR}/.env" ]; then
    echo ">> Memuat konfigurasi dari .env..."
    set -a
    source "${ROOT_DIR}/.env"
    set +a
else
    echo "!! Error: File .env.prod atau .env tidak ditemukan di ${ROOT_DIR}" >&2
    exit 1
fi

mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz"

echo ">> Memulai pencadangan database BarberFlow ke: ${BACKUP_FILE}..."

# Deteksi apakah berjalan di lingkungan docker compose atau lokal
if command -v docker >/dev/null 2>&1 && docker ps | grep -q "barberflow.*db"; then
    CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep "db" | head -n 1)
    echo ">> Menjalankan pg_dump via Docker container: ${CONTAINER_NAME}..."
    docker exec -t "${CONTAINER_NAME}" pg_dump -U "${POSTGRES_OWNER_USER:-barberflow_owner}" "${POSTGRES_DB:-barberflow}" | gzip > "${BACKUP_FILE}"
elif [ -n "${DATABASE_URL_OWNER:-}" ]; then
    echo ">> Menjalankan pg_dump via DATABASE_URL_OWNER..."
    pg_dump "${DATABASE_URL_OWNER}" | gzip > "${BACKUP_FILE}"
else
    echo "!! Error: Tidak dapat menemukan container database atau DATABASE_URL_OWNER." >&2
    exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "✅ Pencadangan selesai dengan sukses! (${BACKUP_SIZE})"
echo "   File: ${BACKUP_FILE}"

# Hapus backup yang lebih tua dari 30 hari
echo ">> Menghapus file backup yang berumur lebih dari 30 hari..."
find "${BACKUP_DIR}" -type f -name "backup_*.sql.gz" -mtime +30 -exec rm -v {} \; || true

echo ">> Selesai."
