#!/usr/bin/env bash
# ==============================================================================
# BarberFlow — Database Restore Script
# Mengembalikan database dari arsip .sql atau .sql.gz dengan konfirmasi eksplisit.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ $# -lt 1 ]; then
    echo "Penggunaan: $0 <path_file_backup.sql.gz>"
    echo "Contoh:     $0 backups/backup_2026-11-17_11-00-00.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "!! Error: File backup tidak ditemukan di: ${BACKUP_FILE}" >&2
    exit 1
fi

# Muat variabel lingkungan
if [ -f "${ROOT_DIR}/.env.prod" ]; then
    set -a
    source "${ROOT_DIR}/.env.prod"
    set +a
elif [ -f "${ROOT_DIR}/.env" ]; then
    set -a
    source "${ROOT_DIR}/.env"
    set +a
else
    echo "!! Error: File .env.prod atau .env tidak ditemukan." >&2
    exit 1
fi

echo "================================================================="
echo "⚠️  PERINGATAN PEMULIHAN DATABASE BARBERFLOW"
echo "================================================================="
echo "File arsip : ${BACKUP_FILE}"
echo "Database   : ${POSTGRES_DB:-barberflow}"
echo "Tindakan   : Seluruh data saat ini akan DITIMPA dengan isi arsip!"
echo "================================================================="
read -r -p "Ketik 'YA' untuk mengonfirmasi pemulihan data: " CONFIRMATION

if [ "${CONFIRMATION}" != "YA" ]; then
    echo "Operasi pemulihan dibatalkan oleh pengguna."
    exit 0
fi

echo ">> Memulai pemulihan database..."

RESTORE_CMD="cat"
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    RESTORE_CMD="gunzip -c"
fi

if command -v docker >/dev/null 2>&1 && docker ps | grep -q "barberflow.*db"; then
    CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep "db" | head -n 1)
    echo ">> Menjalankan pemulihan ke Docker container: ${CONTAINER_NAME}..."
    ${RESTORE_CMD} "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${POSTGRES_OWNER_USER:-barberflow_owner}" -d "${POSTGRES_DB:-barberflow}"
elif [ -n "${DATABASE_URL_OWNER:-}" ]; then
    echo ">> Menjalankan pemulihan via DATABASE_URL_OWNER..."
    ${RESTORE_CMD} "${BACKUP_FILE}" | psql "${DATABASE_URL_OWNER}"
else
    echo "!! Error: Tidak dapat menemukan container database atau DATABASE_URL_OWNER." >&2
    exit 1
fi

echo "✅ Database berhasil dipulihkan dari: ${BACKUP_FILE}"
