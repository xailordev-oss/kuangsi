#!/usr/bin/env bash
# backup DB + ຮູບຫຼັກຖານ → ເຂົ້າລະຫັດ → Backblaze B2 · ຄູ່ມື: docs/deploy.md ພາກ 9
# ແລ່ນດ້ວຍ user kuangsi ຈາກ cron (deploy/crontab.txt)
#
# ອ່ານຄ່າຈາກ /etc/kuangsi/backup.env:
#   MYSQL_DEFAULTS_FILE  ໄຟລ໌ [client] user/password ຂອງ kuangsi_backup (chmod 600)
#   PASSPHRASE_FILE      ລະຫັດເຂົ້າລະຫັດ backup (chmod 600) — ເຮັດສຳເນົາເກັບນອກ server ນຳ ບໍ່ດັ່ງນັ້ນກູ້ຄືນບໍ່ໄດ້
#   RCLONE_REMOTE        ເຊັ່ນ b2:kuangsi-backup/daily
#   PROOF_DIR            ຄືກັບ PROOF_UPLOAD_DIR ໃນ .env
#   LOCAL_DIR            ເຊັ່ນ /var/backups/kuangsi
#   LOCAL_KEEP_DAYS      ເກັບໃນເຄື່ອງ (ເຊັ່ນ 7)
#   REMOTE_KEEP_DAYS     ເກັບໃນ B2 — 30 ຕາມຂໍ້ຕົກລົງ 55 (ເລກບັນຊີລູກຄ້າ)
set -euo pipefail
umask 077

# shellcheck source=/dev/null
source /etc/kuangsi/backup.env

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$LOCAL_DIR/kuangsi-$stamp.tar.gz.enc"
work="$(mktemp -d "$LOCAL_DIR/.work.XXXXXX")"
trap 'rm -rf "$work"' EXIT

# --single-transaction: ສຳເນົາທີ່ສອດຄ່ອງກັນ ໂດຍບໍ່ລັອກຕາຕະລາງ · mysqldump ຂຽນເວລາເປັນ UTC (--tz-utc ຄ່າເລີ່ມຕົ້ນ)
mysqldump --defaults-extra-file="$MYSQL_DEFAULTS_FILE" \
  --single-transaction --no-tablespaces --set-gtid-purged=OFF \
  --default-character-set=utf8mb4 \
  kuangsi > "$work/kuangsi.sql"

tar -C "$(dirname "$PROOF_DIR")" -cf "$work/proofs.tar" "$(basename "$PROOF_DIR")"

tar -C "$work" -czf - kuangsi.sql proofs.tar \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$PASSPHRASE_FILE" -out "$out"

rclone copy "$out" "$RCLONE_REMOTE"

# ລຶບແທ້ (--b2-hard-delete) ບໍ່ແມ່ນແຕ່ເຊື່ອງ — B2 ເກັບສະບັບເກົ່າໄວ້ຖ້າບໍ່ hard delete
rclone delete --min-age "${REMOTE_KEEP_DAYS}d" --b2-hard-delete "$RCLONE_REMOTE"
find "$LOCAL_DIR" -maxdepth 1 -name 'kuangsi-*.tar.gz.enc' -mtime +"$LOCAL_KEEP_DAYS" -delete

date -u +%Y-%m-%dT%H:%M:%SZ > "$LOCAL_DIR/last-success"
echo "backup ok: $out"
