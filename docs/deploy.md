# ຄູ່ມື Deploy — ລະບົບຈອງປີ້ຕາດກວາງຊີ

ໃຊ້ໄດ້ກັບ **Ubuntu 24.04 LTS VPS ທົ່ວໄປ** (ຜູ້ໃຫ້ບໍລິການໃດກໍໄດ້ — ສິງກະໂປ ຫຼື ລາວ) ທີ່ມີສິດ root/sudo.
ຂະໜາດແນະນຳ: 2 vCPU · 4 GB RAM · 80 GB disk (`next build` + MySQL ຢູ່ເຄື່ອງດຽວກັນ).

ໄຟລ໌ປະກອບຢູ່ໃນ `deploy/`:

| ໄຟລ໌ | ໄປຢູ່ໃສໃນ server |
|---|---|
| `deploy/Caddyfile` | `/etc/caddy/Caddyfile` |
| `deploy/kuangsi.service` | `/etc/systemd/system/kuangsi.service` |
| `deploy/backup.sh` | ແລ່ນຈາກ `/opt/kuangsi/current/deploy/backup.sh` |
| `deploy/crontab.txt` | crontab ຂອງ user `kuangsi` |

---

## 0. ພາບລວມ

```
Internet → Caddy (:443 HTTPS · :80 → 443)
             └→ Next.js `next start` (127.0.0.1:3000) — systemd: kuangsi.service
                   ├→ MySQL 8 (127.0.0.1:3306 ເທົ່ານັ້ນ)
                   └→ /var/lib/kuangsi/proofs (ຮູບຫຼັກຖານ — ຂໍ້ຕົກລົງ 29)
cron (user kuangsi): refunds:purge 01:30 · backup → B2 02:00 (ເວລາລາວ)
```

ໂຄງສ້າງໄດເລັກທໍຣີ:

```
/opt/kuangsi/repo                  git clone (ດຶງດ້ວຍ deploy key ອ່ານຢ່າງດຽວ)
/opt/kuangsi/releases/<ວັນເວລາ>-<sha>  ແຕ່ລະ release ທີ່ build ແລ້ວ (ເກັບ 5 ອັນລ່າສຸດ)
/opt/kuangsi/current → releases/…  symlink ໄປ release ທີ່ໃຊ້ຢູ່ (rollback = ປ່ຽນ symlink)
/etc/kuangsi/kuangsi.env           .env ຂອງ server (ທຸກ release ໃຊ້ຮ່ວມກັນຜ່ານ symlink)
/etc/kuangsi/backup.env            ຄ່າຂອງ backup.sh
/etc/kuangsi/backup.my.cnf         user/password ຂອງ kuangsi_backup
/etc/kuangsi/backup.pass           ລະຫັດເຂົ້າລະຫັດ backup
/var/lib/kuangsi                   home ຂອງ user kuangsi
/var/lib/kuangsi/proofs            ຮູບຫຼັກຖານ (ຢູ່ນອກ release → ບໍ່ຫາຍຕອນ deploy)
/var/backups/kuangsi               backup ໃນເຄື່ອງ (7 ວັນ)
/var/log/kuangsi                   log ຂອງ cron
```

---

## 1. ສິ່ງທີ່ຕ້ອງມີກ່ອນເລີ່ມ

- [ ] VPS Ubuntu 24.04 + IP ສາທາລະນະ + SSH key ຂອງເຈົ້າຢູ່ໃນ server
- [ ] ໂດເມນ + record `A` ຊີ້ໄປ IP ຂອງ VPS (ຖ້າໃຊ້ Cloudflare: **DNS only** — ຫ້າມເປີດ proxy ສີສົ້ມ)
- [ ] GitHub private repo ທີ່ push code ແລ້ວ
- [ ] ບັນຊີ Backblaze B2 (ພາກ 9)
- [ ] `ORS_API_KEY` ຈາກ openrouteservice.org (ຟຣີ)

ຄຳສັ່ງທັງໝົດຂ້າງລຸ່ມແລ່ນໃນ server ດ້ວຍ user ທີ່ມີ sudo. ຄ່າໃນ `<...>` ໃຫ້ແທນດ້ວຍຄ່າຈິງ.

---

## 2. ຕັ້ງ server ພື້ນຖານ

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install git curl unzip ufw

# ເວລາຂອງ OS — ຄວນເປັນ UTC (ຄ່າເລີ່ມຕົ້ນຂອງ VPS ສ່ວນໃຫຍ່)
timedatectl | grep "Time zone"
# ຖ້າບໍ່ແມ່ນ UTC: ບໍ່ຕ້ອງປ່ຽນ — ແຕ່ຕ້ອງແກ້ເວລາໃນ deploy/crontab.txt ໃຫ້ກົງກັບ 01:30 / 02:00 ເວລາລາວ

# firewall: ເປີດແຕ່ SSH / HTTP / HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# SSH: ເຂົ້າດ້ວຍ key ເທົ່ານັ້ນ (ກວດໃຫ້ແນ່ໃຈວ່າ login ດ້ວຍ key ໄດ້ກ່ອນ!)
sudo sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# ອັບເດດຄວາມປອດໄພອັດຕະໂນມັດ (Ubuntu ເປີດໄວ້ແລ້ວ — ກວດວ່າມີ)
systemctl is-enabled unattended-upgrades

# user ສຳລັບແລ່ນ app (ບໍ່ມີສິດ login ດ້ວຍລະຫັດ)
sudo adduser --system --group --home /var/lib/kuangsi --shell /bin/bash kuangsi
sudo install -d -o kuangsi -g kuangsi -m 755 /opt/kuangsi /opt/kuangsi/releases
sudo install -d -o kuangsi -g kuangsi -m 700 /var/lib/kuangsi/proofs /var/backups/kuangsi
sudo install -d -o kuangsi -g kuangsi -m 755 /var/log/kuangsi
sudo install -d -o root -g kuangsi -m 750 /etc/kuangsi
```

---

## 3. ຕິດຕັ້ງ Node · MySQL · Caddy · rclone

ທັງໝົດເປັນ package ຂອງ OS — **ບໍ່ມີ package npm ໃໝ່**.

1. **Node 26 LTS** (ເວີຊັນດຽວກັບເຄື່ອງພັດທະນາ): ຕິດຕັ້ງຕາມວິທີທາງການທີ່ https://nodejs.org/en/download (ເລືອກ Linux + package manager)
   ```bash
   node -v           # ຕ້ອງເປັນ v26.x
   which node        # ຕ້ອງເປັນ /usr/bin/node — ຖ້າບໍ່ແມ່ນ ແກ້ ExecStart ໃນ kuangsi.service
   ```
2. **MySQL 8.0+**:
   ```bash
   sudo apt -y install mysql-server
   mysql --version
   # ຕ້ອງຟັງສະເພາະ 127.0.0.1 (ຄ່າເລີ່ມຕົ້ນຂອງ Ubuntu)
   sudo ss -tlnp | grep 3306     # ຕ້ອງເຫັນ 127.0.0.1:3306 ບໍ່ແມ່ນ 0.0.0.0
   ```
   ⚠️ **ຫ້າມປ່ຽນ global `time_zone` ຂອງ MySQL** — app ຕັ້ງ UTC ຕໍ່ connection ເອງ (`lib/db.ts`)
3. **Caddy**: ຕິດຕັ້ງຈາກ apt repo ທາງການຕາມ https://caddyserver.com/docs/install#debian-ubuntu-raspbian
4. **rclone** (ສຳລັບສົ່ງ backup ໄປ B2): `sudo apt -y install rclone`

---

## 4. ຖານຂໍ້ມູນສະອາດ (ບໍ່ copy DB ພັດທະນາ)

```bash
# ດຶງ code ກ່ອນ ເພື່ອໃຫ້ມີ db/kuangsi-schema.sql (ພາກ 8 ຂັ້ນ 1–2)
# ແລ້ວ:
sudo mysql < /opt/kuangsi/repo/db/kuangsi-schema.sql
```

ໄຟລ໌ນີ້ສ້າງ DB `kuangsi` (utf8mb4) + ຕາຕະລາງ + seed ໃນຄັ້ງດຽວ · ແຖວທຳອິດເປັນ `SET time_zone = '+00:00'` ຢູ່ແລ້ວ.
ໄຟລ໌ນີ້ໃຊ້ສະເພາະ DB ເປົ່າ (ບໍ່ມີ `DROP TABLE`) — ສ້າງໃໝ່ທັງໝົດເບິ່ງພາກ 14.

ສ້າງ user ຂອງ MySQL (ລະຫັດສ້າງດ້ວຍ `openssl rand -base64 24`):

```sql
-- sudo mysql
CREATE USER 'kuangsi_app'@'localhost' IDENTIFIED BY '<ລະຫັດ app>';
GRANT SELECT, INSERT, UPDATE, DELETE ON kuangsi.* TO 'kuangsi_app'@'localhost';

CREATE USER 'kuangsi_backup'@'localhost' IDENTIFIED BY '<ລະຫັດ backup>';
GRANT SELECT, SHOW VIEW, LOCK TABLES ON kuangsi.* TO 'kuangsi_backup'@'localhost';
```

- `kuangsi_app` ບໍ່ມີສິດແກ້ໂຄງສ້າງ (CREATE/ALTER/DROP) — ການແກ້ schema ເຮັດດ້ວຍ `sudo mysql` ເທົ່ານັ້ນ (ພາກ 12.3)
- ກວດວ່າບໍ່ມີບັນຊີທົດສອບ: `sudo mysql -e "SELECT username, role, is_active FROM kuangsi.users"` → ຕ້ອງມີແຕ່ `admin`
- `admin` ຈາກ seed ມີ hash placeholder (login ບໍ່ໄດ້) → ຕັ້ງລະຫັດຈິງໃນພາກ 11

---

## 5. ໄຟລ໌ env ຂອງ server

```bash
sudo nano /etc/kuangsi/kuangsi.env
```

```ini
DATABASE_URL="mysql://kuangsi_app:<ລະຫັດ app>@127.0.0.1:3306/kuangsi"
AUTH_SECRET="<openssl rand -base64 33 — ສ້າງໃໝ່ ຫ້າມໃຊ້ຄືນຂອງເຄື່ອງພັດທະນາ>"
AUTH_URL="https://<ໂດເມນ>"
PROOF_UPLOAD_DIR=/var/lib/kuangsi/proofs
ORS_API_KEY=<key>
```

- **ບໍ່ມີ `AUTH_TRUST_HOST`** — Auth.js ເຊື່ອ host ເອງເມື່ອມີ `AUTH_URL`
- ຖ້າລະຫັດ DB ມີຕົວອັກສອນພິເສດ (`@ : / ? #`) ຕ້ອງ URL-encode
- ສິດໄຟລ໌:
  ```bash
  sudo chown root:kuangsi /etc/kuangsi/kuangsi.env
  sudo chmod 640 /etc/kuangsi/kuangsi.env
  ```

---

## 6. HTTPS (Caddy)

HTTPS ຈຳເປັນສຳລັບ: Geolocation (DistanceCard), ກ້ອງສະແກນ QR ທີ່ `/staff/scan`, service worker (ຂໍ້ຕົກລົງ 34).

```bash
sudo cp /opt/kuangsi/repo/deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile          # ແທນ kuangsi.example.la ດ້ວຍໂດເມນຈິງ
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

- DNS ຕ້ອງຊີ້ມາ server ແລ້ວ ແລະ port 80/443 ເປີດ — Caddy ຂໍໃບຢັ້ງຢືນ Let's Encrypt ເອງ ແລະ ຕໍ່ອາຍຸເອງ
- ກວດ: `curl -I http://<ໂດເມນ>` → 308 ໄປ `https://` · `curl -I https://<ໂດເມນ>` → ມີ `strict-transport-security`
- ຖ້າໃບຢັ້ງຢືນບໍ່ອອກ: `sudo journalctl -u caddy -n 50`

**X-Forwarded-For (ຂໍ້ຕົກລົງ 26):** Caddy ບໍ່ເຊື່ອ header ທີ່ client ສົ່ງມາ ແລະ ຕັ້ງເປັນ IP ແທ້ → rate limit ນັບຖືກ.
ຖ້າໃນອະນາຄົດເພີ່ມ proxy/CDN ທາງໜ້າ ຕ້ອງຕັ້ງ `trusted_proxies` ໃຫ້ຖືກ ບໍ່ດັ່ງນັ້ນທຸກຄົນຈະມີ IP ດຽວກັນ.

---

## 7. systemd

```bash
sudo cp /opt/kuangsi/repo/deploy/kuangsi.service /etc/systemd/system/kuangsi.service
sudo systemctl daemon-reload
sudo systemctl enable kuangsi       # start ຫຼັງ release ທຳອິດ (ພາກ 8)
```

ຄຳສັ່ງທີ່ໃຊ້ເລື້ອຍ:

```bash
sudo systemctl status kuangsi
sudo systemctl restart kuangsi
sudo journalctl -u kuangsi -n 100 -f
```

---

## 8. Deploy release

### 8.1 ຄັ້ງທຳອິດ — deploy key (ອ່ານຢ່າງດຽວ)

```bash
sudo -u kuangsi ssh-keygen -t ed25519 -N "" -f /var/lib/kuangsi/.ssh/id_ed25519 -C kuangsi-deploy
sudo cat /var/lib/kuangsi/.ssh/id_ed25519.pub
```

GitHub → repo → Settings → Deploy keys → Add → ວາງ key · **ບໍ່ຕິກ** "Allow write access".

```bash
sudo -u kuangsi git clone git@github.com:<owner>/<repo>.git /opt/kuangsi/repo
```

### 8.2 ທຸກຄັ້ງທີ່ deploy (ລວມຄັ້ງທຳອິດ)

```bash
sudo -iu kuangsi
set -e
cd /opt/kuangsi/repo
git fetch origin
SHA=$(git rev-parse --short origin/main)
REL=/opt/kuangsi/releases/$(date -u +%Y%m%d-%H%M)-$SHA
mkdir "$REL"
git archive origin/main | tar -x -C "$REL"
echo "$SHA" > "$REL/REVISION"

cd "$REL"
ln -s /etc/kuangsi/kuangsi.env .env
npm ci
npx prisma generate --config prisma7.config.ts
npx tsc --noEmit
npm test
npm run build

# ສະຫຼັບໄປ release ໃໝ່ (atomic)
ln -sfn "$REL" /opt/kuangsi/current.tmp && mv -T /opt/kuangsi/current.tmp /opt/kuangsi/current
exit
```

```bash
sudo systemctl restart kuangsi
curl -sI http://127.0.0.1:3000 | head -1      # ຕ້ອງໄດ້ 200 ຫຼື 307
```

ຖ້າ build ລົ້ມ: `current` ຍັງຊີ້ release ເກົ່າ — ລະບົບບໍ່ກະທົບ · ລຶບ `$REL` ແລ້ວແກ້ບັນຫາ.

ລ້າງ release ເກົ່າ (ເກັບ 5 ອັນລ່າສຸດ ສຳລັບ rollback):

```bash
sudo -u kuangsi bash -c 'cd /opt/kuangsi/releases && ls -1d */ | sort | head -n -5 | xargs -r rm -rf'
```

---

## 9. Backup → Backblaze B2

ສິ່ງທີ່ backup: DB ທັງໝົດ + ຮູບຫຼັກຖານ · ເຂົ້າລະຫັດ (AES-256) **ກ່ອນ** ສົ່ງອອກຈາກ server · ເກັບ **30 ວັນ** (ຂໍ້ຕົກລົງ 55).

### 9.1 ຕັ້ງ B2 (ເຮັດຄັ້ງດຽວໃນໜ້າເວັບ Backblaze)

1. ສ້າງ bucket **Private** ເຊັ່ນ `kuangsi-backup`
2. Lifecycle Settings → custom rule (ຊັ້ນປ້ອງກັນທີ 2 ນອກຈາກ script):
   `fileNamePrefix = daily/` · `daysFromUploadingToHiding = 31` · `daysFromHidingToDeleting = 1`
3. Application Keys → ສ້າງ key ທີ່ໃຊ້ໄດ້ **ສະເພາະ bucket ນີ້** (Read and Write) → ຈົດ keyID + applicationKey

### 9.2 ຕັ້ງໃນ server

```bash
# rclone remote ຊື່ b2 (ເກັບໃນ /var/lib/kuangsi/.config/rclone/)
sudo -u kuangsi rclone config create b2 b2 account <keyID> key <applicationKey>
sudo -u kuangsi rclone lsd b2:                 # ຕ້ອງເຫັນ kuangsi-backup

# ລະຫັດເຂົ້າລະຫັດ backup
sudo sh -c 'openssl rand -base64 48 > /etc/kuangsi/backup.pass'
sudo cat /etc/kuangsi/backup.pass
```

⚠️ **ສຳເນົາລະຫັດ `backup.pass` ເກັບໄວ້ນອກ server ຢ່າງໜ້ອຍ 2 ບ່ອນ** (ເຊັ່ນ password manager + ເຈ້ຍໃນຕູ້ເຊຟ).
ຖ້າ server ເພ ແລະ ບໍ່ມີລະຫັດນີ້ → backup ທັງໝົດຖອດບໍ່ໄດ້.

```bash
sudo tee /etc/kuangsi/backup.my.cnf >/dev/null <<'EOF'
[client]
user=kuangsi_backup
password=<ລະຫັດ backup>
host=127.0.0.1
EOF

sudo tee /etc/kuangsi/backup.env >/dev/null <<'EOF'
MYSQL_DEFAULTS_FILE=/etc/kuangsi/backup.my.cnf
PASSPHRASE_FILE=/etc/kuangsi/backup.pass
RCLONE_REMOTE=b2:kuangsi-backup/daily
PROOF_DIR=/var/lib/kuangsi/proofs
LOCAL_DIR=/var/backups/kuangsi
LOCAL_KEEP_DAYS=7
REMOTE_KEEP_DAYS=30
EOF

sudo chown kuangsi:kuangsi /etc/kuangsi/backup.*
sudo chmod 600 /etc/kuangsi/backup.*
```

ທົດລອງແລ່ນດ້ວຍມື:

```bash
sudo -u kuangsi /opt/kuangsi/current/deploy/backup.sh
sudo -u kuangsi rclone ls b2:kuangsi-backup/daily
```

### 9.3 ກູ້ຄືນ (restore)

**ທົດລອງກູ້ຄືນກ່ອນເປີດຈິງ 1 ຄັ້ງ ແລະ ທຸກເດືອນ** — ກູ້ໃສ່ DB ແຍກ ບໍ່ແຕະ DB ຈິງ:

```bash
sudo -iu kuangsi
mkdir -p ~/restore && cd ~/restore
rclone copy b2:kuangsi-backup/daily/<ໄຟລ໌>.tar.gz.enc .
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:/etc/kuangsi/backup.pass \
  -in <ໄຟລ໌>.tar.gz.enc | tar -xzf -
ls -l kuangsi.sql proofs.tar
exit

sudo mysql -e "CREATE DATABASE kuangsi_restore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
sudo mysql kuangsi_restore_test < /var/lib/kuangsi/restore/kuangsi.sql
sudo mysql -e "SELECT COUNT(*) FROM kuangsi_restore_test.bookings; SELECT COUNT(*) FROM kuangsi_restore_test.payments"
# ປຽບທຽບກັບ DB ຈິງ ແລ້ວລຶບ:
sudo mysql -e "DROP DATABASE kuangsi_restore_test"
sudo rm -rf /var/lib/kuangsi/restore
```

**ກູ້ຄືນແທ້** (server ໃໝ່ ຫຼື DB ເສຍ) — ຢຸດ app ກ່ອນ:

```bash
sudo systemctl stop kuangsi
sudo mysql -e "CREATE DATABASE kuangsi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"   # ຖ້າຍັງບໍ່ມີ
sudo mysql kuangsi < kuangsi.sql
sudo tar -xf proofs.tar -C /var/lib/kuangsi
sudo chown -R kuangsi:kuangsi /var/lib/kuangsi/proofs && sudo chmod 700 /var/lib/kuangsi/proofs
# server ໃໝ່: ສ້າງ user MySQL ຄືນຕາມພາກ 4
sudo systemctl start kuangsi
```

ຂໍ້ມູນທີ່ເກີດຫຼັງ backup ຄັ້ງສຸດທ້າຍ (ສູງສຸດ ~24 ຊມ) ຈະຫາຍ.

---

## 10. cron

```bash
sudo crontab -u kuangsi /opt/kuangsi/current/deploy/crontab.txt
sudo crontab -u kuangsi -l
```

- 01:30 ເວລາລາວ: `npm run refunds:purge` (ຂໍ້ຕົກລົງ 55)
- 02:00 ເວລາລາວ: `deploy/backup.sh`
- ກວດ: `tail /var/log/kuangsi/backup.log` · `cat /var/backups/kuangsi/last-success` (ຕ້ອງເປັນມື້ນີ້ ຫຼື ມື້ວານ)

---

## 11. ບັນຊີ ແລະ ຂໍ້ມູນເລີ່ມຕົ້ນ

```bash
sudo -iu kuangsi
cd /opt/kuangsi/current
npm run user:upsert -- --username admin --role admin     # ພິມລະຫັດຜ່ານໃໝ່ (ອ່ານຈາກ stdin)
npm run places:routes                                    # ຄຳນວນໄລຍະທາງດ້ວຍ ORS (ຕ້ອງມີ ORS_API_KEY)
exit
```

ແລ້ວ login ເປັນ admin ທີ່ `https://<ໂດເມນ>`:

1. ສ້າງບັນຊີພະນັກງານຈິງ (cashier / scanner / viewer) ຈາກໜ້າຈັດການຜູ້ໃຊ້
2. ໜ້າ settings: ລາຄາປີ້ · ອາຍຸເດັກ · ຈຳນວນສູງສຸດຕໍ່ວັນ · ເວລາເປີດ · ປະຕູ · ນະໂຍບາຍຄືນເງິນ · ອັດຕາແລກປ່ຽນ (ຖ້າມີ)
3. ບັນຊີທະນາຄານ + `verify_time_note` ຄົບ 4 ພາສາ → **ໃສ່ຕອນສຸດທ້າຍ** ເພາະຈະເປີດການຈອງ online ທັນທີ (ຂໍ້ຕົກລົງ 28)

---

## 12. Rollback — ຖ້າ deploy ແລ້ວມີບັນຫາ

### 12.1 ກັບໄປ release ກ່ອນໜ້າ (ໄວທີ່ສຸດ ~10 ວິນາທີ · ບໍ່ຕ້ອງ build ໃໝ່)

```bash
ls -1 /opt/kuangsi/releases                   # ລາຍຊື່ release (ໃໝ່ສຸດຢູ່ລຸ່ມ)
readlink /opt/kuangsi/current                 # ອັນທີ່ໃຊ້ຢູ່ດຽວນີ້

sudo -u kuangsi bash -c 'ln -sfn /opt/kuangsi/releases/<release ກ່ອນໜ້າ> /opt/kuangsi/current.tmp \
  && mv -T /opt/kuangsi/current.tmp /opt/kuangsi/current'
sudo systemctl restart kuangsi
cat /opt/kuangsi/current/REVISION              # ກວດວ່າເປັນ commit ທີ່ຕ້ອງການ
```

ແກ້ບັນຫາແລ້ວ deploy ໃໝ່ຕາມພາກ 8.2 ຕາມປົກກະຕິ.

### 12.2 ກັບໄປ commit ທີ່ບໍ່ມີ release ເຫຼືອແລ້ວ

ໃຊ້ພາກ 8.2 ທັງໝົດ ແຕ່ປ່ຽນ `origin/main` ເປັນ commit ທີ່ຕ້ອງການ:

```bash
git log --oneline -20 origin/main        # ຫາ commit
SHA=<sha>
git archive "$SHA" | tar -x -C "$REL"    # ແທນແຖວ git archive origin/main
```

### 12.3 ຖ້າ deploy ນັ້ນມີການແກ້ schema

rollback code **ບໍ່ໄດ້ຍົກເລີກການແກ້ DB**. ສະນັ້ນ:

1. ກ່ອນແກ້ schema ທຸກຄັ້ງ: ແລ່ນ backup ດ້ວຍມື (`sudo -u kuangsi /opt/kuangsi/current/deploy/backup.sh`)
2. ການແກ້ຄວນເປັນແບບ "ເພີ່ມ" (ADD COLUMN ທີ່ມີຄ່າເລີ່ມຕົ້ນ / NULL ໄດ້) → code ເກົ່າຍັງໃຊ້ໄດ້ ເມື່ອ rollback ຕາມ 12.1
3. ແລ່ນ ALTER ດ້ວຍ `sudo mysql kuangsi < ໄຟລ໌.sql` — ແຖວທຳອິດຂອງໄຟລ໌ຕ້ອງເປັນ `SET time_zone = '+00:00';`
4. ຖ້າການແກ້ບໍ່ເຂົ້າກັບ code ເກົ່າ ແລະ ຕ້ອງ rollback → ກູ້ DB ຈາກ backup ຂໍ້ 1 (ພາກ 9.3) — ຂໍ້ມູນຫຼັງ backup ຈະຫາຍ ສະນັ້ນຕັດສິນໃຈໄວ

---

## 13. ກວດກ່ອນເປີດໃຫ້ຄົນນອກໃຊ້

### ໂຄງສ້າງພື້ນຖານ
- [ ] `https://<ໂດເມນ>` ເປີດໄດ້ ໃບຢັ້ງຢືນຖືກຕ້ອງ · `http://` ສົ່ງຕໍ່ໄປ `https://`
- [ ] `sudo ss -tlnp`: port 3000 ແລະ 3306 ຟັງສະເພາະ `127.0.0.1` · ຈາກນອກເຂົ້າໄດ້ແຕ່ 22/80/443
- [ ] SSH login ດ້ວຍລະຫັດຜ່ານບໍ່ໄດ້
- [ ] `systemctl is-enabled kuangsi caddy mysql` → enabled ທັງໝົດ · reboot ແລ້ວລະບົບຂຶ້ນເອງ

### ຄວາມປອດໄພ ແລະ ການຕັ້ງຄ່າ
- [ ] `AUTH_SECRET` ໃໝ່ (ບໍ່ຄືກັບເຄື່ອງພັດທະນາ) · ມີ `AUTH_URL` · ບໍ່ມີ `AUTH_TRUST_HOST`
- [ ] `DATABASE_URL` ໃຊ້ `kuangsi_app` ບໍ່ແມ່ນ root
- [ ] `/etc/kuangsi/kuangsi.env` = 640 root:kuangsi · `/etc/kuangsi/backup.*` = 600 · `/var/lib/kuangsi/proofs` = 700
- [ ] `users` ບໍ່ມີບັນຊີທົດສອບ (`dev_*`, `e2e_*`, `t10b_*`) · admin seed ຕັ້ງລະຫັດຈິງແລ້ວ
- [ ] rate limit: ສົ່ງ `X-Forwarded-For` ປອມຫຼາຍຄ່າ → ຍັງຖືກຈຳກັດຕາມ IP ແທ້ (ທົດລອງກ່ອນລ້າງ DB ພາກ 14)
- [ ] URL ຮູບຫຼັກຖານເປີດບໍ່ໄດ້ຖ້າບໍ່ມີສິດ · ບໍ່ມີໄຟລ໌ໃນ `public/` ຂອງ release

### ຟັງຊັນ (ທົດລອງເທິງ server ຈິງ ດ້ວຍໂທລະສັບຈິງ)
- [ ] login ທັງ 4 ບົດບາດ (admin / cashier / scanner / viewer) ໄປໜ້າທີ່ຖືກຕ້ອງ ບໍ່ມີ 404
- [ ] ລັອກຫຼັງຜິດ 5 ຄັ້ງ · ບັນຊີທີ່ປິດ login ບໍ່ໄດ້ · session ໝົດອາຍຸຕາມ `session_hours`
- [ ] ຈອງ online ຄົບ 4 ພາສາ → ອັບໂຫຼດຫຼັກຖານ → cashier ເຫັນຮູບ → ອະນຸມັດ / ປະຕິເສດ
- [ ] ໜ້າ QR ຂອງລູກຄ້າເປີດໄດ້ຕອນ offline (service worker)
- [ ] `/staff/scan` ເປີດກ້ອງໄດ້ເທິງໂທລະສັບ · ສະແກນຜ່ານ / ຊ້ຳ / ບໍ່ທັນຈ່າຍ · ຕັດເນັດ → ສະແດງ "offline"
- [ ] DistanceCard ຂໍພິກັດໄດ້ (Geolocation) · ໄລຍະທາງບໍ່ໝາຍ "ປະມານ" (ORS ໃຊ້ໄດ້)
- [ ] POS ຂາຍ 1 ກຸ່ມ ≤ 30 ວິນາທີ · ພິມປີ້ກັບເຄື່ອງພິມຈິງ · ຕັດເນັດ → ປິດປຸ່ມຂາຍ
- [ ] ຍົກເລີກ + ຄືນເງິນ: ລູກຄ້າຍົກເລີກເອງ · admin ຄືນໂອນ · cashier void POS · ຄືນເງິນສົດຜ່ານຄິວ
- [ ] dashboard ສະແດງ ຮັບເງິນ / ຄືນເງິນ / ສຸດທິ ຖືກຕ້ອງ

### ຂໍ້ມູນທຸລະກິດ (ຢືນຢັນກັບຜູ້ຈັດການຕາດແລ້ວ)
- [ ] ລາຄາປີ້ທຸກປະເພດ · ອາຍຸເດັກເຂົ້າຟຣີ
- [ ] ຈຳນວນສູງສຸດຕໍ່ວັນ · ເວລາເປີດ-ປິດ · ຈຳນວນປະຕູ · `pos_auto_checkin`
- [ ] ນະໂຍບາຍຄືນເງິນ + `refund_time_note` 4 ພາສາ
- [ ] ພິກັດ places · `npm run places:routes` ແລ່ນແລ້ວ
- [ ] ບັນຊີທະນາຄານ + `verify_time_note` 4 ພາສາ → ໜ້າຈອງສະແດງວິທີໂອນ (ໃສ່ເປັນຢ່າງສຸດທ້າຍ)

### Backup
- [ ] `backup.sh` ແລ່ນຜ່ານ · ມີໄຟລ໌ໃນ B2 · `last-success` ເປັນມື້ນີ້
- [ ] ທົດລອງກູ້ຄືນ (ພາກ 9.3) ຜ່ານ — ຈຳນວນແຖວກົງກັບ DB ຈິງ
- [ ] ສຳເນົາ `backup.pass` ເກັບນອກ server 2 ບ່ອນແລ້ວ
- [ ] B2 lifecycle rule ຕັ້ງແລ້ວ

### ກ່ອນກົດເປີດ
- [ ] ລ້າງ DB ຫຼັງທົດລອງແລ້ວ (ພາກ 14)
- [ ] code review ຄັ້ງສຸດທ້າຍກ່ອນເປີດໃຊ້ຈິງ
- [ ] ຈົດ `REVISION` ຂອງ release ທີ່ເປີດໃຊ້ (ສຳລັບ rollback)

---

## 14. ລ້າງ DB ຫຼັງທົດລອງ (ກ່ອນເປີດຈິງ)

ການຈອງ/ການຈ່າຍທີ່ທົດລອງເທິງ server ລຶບບໍ່ໄດ້ທີລະແຖວ (FK RESTRICT) → ສ້າງ DB ໃໝ່ທັງໝົດ:

```bash
sudo systemctl stop kuangsi
sudo mysql -e "DROP DATABASE kuangsi"
sudo mysql < /opt/kuangsi/current/db/kuangsi-schema.sql
# user MySQL ບໍ່ຫາຍ (ເກັບແຍກ) ແຕ່ GRANT ຜູກກັບ kuangsi.* — ກວດ:
sudo mysql -e "SHOW GRANTS FOR 'kuangsi_app'@'localhost'"
sudo find /var/lib/kuangsi/proofs -type f -delete
sudo -u kuangsi rclone delete --b2-hard-delete b2:kuangsi-backup/daily   # backup ຂອງຊ່ວງທົດລອງ
sudo rm -f /var/backups/kuangsi/kuangsi-*.tar.gz.enc
sudo systemctl start kuangsi
```

ແລ້ວເຮັດພາກ 11 ຄືນ (admin · ພະນັກງານ · settings · `places:routes`).
