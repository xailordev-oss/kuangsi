-- =====================================================================
--  ລະບົບຈອງປີ້ທ່ອງທ່ຽວ ຕາດກວາງຊີ — MySQL Schema
--  ສຳລັບ MySQL 8.0+ / MySQL Workbench
--
--  ຂໍ້ຕົກລົງ v1: ລາຄາເປັນກີບຢ່າງດຽວ · 1 QR ຕໍ່ 1 ການຈອງ · ຈອງແບບ guest
--              ຮອບເວລາປິດໄວ້ກ່ອນ (time_slot = NULL) · ລາຍລະອຽດໃນ CLAUDE.md ພາກ 7
--
--  ວິທີໃຊ້:
--    1. ເປີດ MySQL Workbench
--    2. File > Open SQL Script > ເລືອກໄຟລ໌ນີ້
--    3. ກົດ ⚡ (Execute) ທັງໝົດ
--    4. ດູ ER diagram: Database > Reverse Engineer
-- =====================================================================

-- ສຳຄັນ: ເກັບເວລາເປັນ UTC — ຕັ້ງທີ່ session ບໍ່ແມ່ນ global (server ອື່ນ/ຕອນ deploy ອາດບໍ່ແມ່ນ UTC)
-- ບໍ່ດັ່ງນັ້ນ CURRENT_TIMESTAMP ຂອງ seed ຈະເປັນເວລາທ້ອງຖິ່ນຂອງ server (+07)
SET time_zone = '+00:00';

-- ສຳຄັນ: utf8mb4 ຈຳເປັນສຳລັບຂໍ້ຄວາມພາສາລາວ
CREATE DATABASE IF NOT EXISTS kuangsi
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE kuangsi;

SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================
--  1. ຜູ້ໃຊ້ລະບົບ
-- =====================================================================

CREATE TABLE users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(150) NOT NULL,
  phone         VARCHAR(30)  NULL,
  role          ENUM('admin','cashier','scanner','viewer') NOT NULL DEFAULT 'viewer',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at DATETIME     NULL,
  -- ກັນການເດົາລະຫັດ (ຂໍ້ຕົກລົງ 22): ຜິດຄົບ settings.login_max_attempts → ລັອກ settings.login_lockout_minutes
  failed_login_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until  DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_users_username (username),
  UNIQUE KEY uk_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB;

-- =====================================================================
--  2. ປະເພດປີ້
-- =====================================================================

CREATE TABLE ticket_types (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(30)  NOT NULL,              -- 'LAO_ADULT', 'FOR_CHILD'
  name_lo       VARCHAR(100) NOT NULL,
  name_en       VARCHAR(100) NOT NULL,
  name_zh       VARCHAR(100) NULL,
  name_th       VARCHAR(100) NULL,
  visitor_group ENUM('lao','foreigner') NOT NULL,
  age_group     ENUM('adult','child','senior','free') NOT NULL,
  age_min       TINYINT UNSIGNED NULL,              -- NULL = ບໍ່ຈຳກັດ
  age_max       TINYINT UNSIGNED NULL,
  price         DECIMAL(12,2) NOT NULL,
  currency      CHAR(3)      NOT NULL DEFAULT 'LAK',
  sort_order    SMALLINT     NOT NULL DEFAULT 0,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_ticket_types_code (code),
  KEY idx_ticket_types_active (is_active, visitor_group)
) ENGINE=InnoDB;

-- =====================================================================
--  3. ບໍລິການເສີມ
-- =====================================================================

CREATE TABLE add_ons (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(30)  NOT NULL,                -- 'SHUTTLE', 'GUIDE', 'LOCKER'
  name_lo     VARCHAR(100) NOT NULL,
  name_en     VARCHAR(100) NOT NULL,
  name_zh     VARCHAR(100) NULL,
  name_th     VARCHAR(100) NULL,
  price       DECIMAL(12,2) NOT NULL,
  currency    CHAR(3)      NOT NULL DEFAULT 'LAK',
  unit        ENUM('per_person','per_booking','per_item') NOT NULL DEFAULT 'per_person',
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_add_ons_code (code)
) ENGINE=InnoDB;

-- =====================================================================
--  4. ຜູ້ຈອງ
-- =====================================================================

CREATE TABLE customers (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name   VARCHAR(150) NOT NULL,
  phone       VARCHAR(30)  NULL,
  email       VARCHAR(255) NULL,
  nationality CHAR(2)      NULL,                    -- ISO 3166-1: 'LA','TH','CN'
  id_number   VARCHAR(50)  NULL,                    -- ບັດປະຈຳຕົວ / passport
  id_type     ENUM('national_id','passport','other') NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_customers_phone (phone),   -- ໃຊ້ຫາລູກຄ້າເກົ່າດ້ວຍເບີໂທ (ຂໍ້ຕົກລົງ 4: ບໍ່ສ້າງຊ້ຳ)
  KEY idx_customers_email (email),
  KEY idx_customers_nationality (nationality)
) ENGINE=InnoDB;

-- =====================================================================
--  4b. ຮອບເວລາ — v1 ປິດໄວ້ (is_active = FALSE) ຈອງເປັນວັນ
-- =====================================================================

CREATE TABLE time_slots (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  start_time   TIME         NOT NULL,
  end_time     TIME         NOT NULL,
  max_visitors INT UNSIGNED NULL,                   -- NULL = ໃຊ້ຈຳນວນຂອງທັງວັນ
  sort_order   SMALLINT     NOT NULL DEFAULT 0,
  is_active    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_time_slots_range (start_time, end_time)
) ENGINE=InnoDB;

-- =====================================================================
--  5. ການຈອງ
-- =====================================================================

CREATE TABLE bookings (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_code   VARCHAR(20)  NOT NULL,             -- 'KS-7X4K9'
  qr_token       CHAR(36)     NOT NULL,             -- UUID ສຳລັບ QR
  customer_id    BIGINT UNSIGNED NULL,              -- NULL = ຂາຍໜ້າປະຕູ ບໍ່ມີຂໍ້ມູນລູກຄ້າ (ຂໍ້ຕົກລົງ 16)

  visit_date     DATE         NOT NULL,
  time_slot_id   BIGINT UNSIGNED NULL,              -- NULL = ຈອງທັງວັນ (v1)

  subtotal       DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency       CHAR(3)      NOT NULL DEFAULT 'LAK',

  -- verifying = ອັບໂຫຼດຫຼັກຖານແລ້ວ ລໍພະນັກງານກວດ (expires_at = NULL, ຂໍ້ຕົກລົງ 15)
  status         ENUM('pending','verifying','paid','used','cancelled','expired')
                 NOT NULL DEFAULT 'pending',
  channel        ENUM('online','gate','tour_agency') NOT NULL DEFAULT 'online',

  expires_at     DATETIME     NULL,                 -- ປີ້ pending ໝົດອາຍຸ
  note           TEXT         NULL,
  created_by     BIGINT UNSIGNED NULL,              -- ພະນັກງານ (ຖ້າຂາຍຢູ່ປະຕູ)
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_bookings_code (booking_code),
  UNIQUE KEY uk_bookings_qr (qr_token),
  KEY idx_bookings_visit_date (visit_date, status),
  KEY idx_bookings_status (status),
  KEY idx_bookings_customer (customer_id),
  KEY idx_bookings_time_slot (time_slot_id),

  CONSTRAINT fk_bookings_customer FOREIGN KEY (customer_id)
    REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_time_slot FOREIGN KEY (time_slot_id)
    REFERENCES time_slots(id) ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_user FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE RESTRICT  -- ຫ້າມລຶບ user (CLAUDE.md ພາກ 4)
) ENGINE=InnoDB;

-- ລາຍການປີ້ໃນແຕ່ລະການຈອງ
CREATE TABLE booking_items (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id     BIGINT UNSIGNED NOT NULL,
  ticket_type_id BIGINT UNSIGNED NOT NULL,
  quantity       SMALLINT UNSIGNED NOT NULL,
  unit_price     DECIMAL(12,2) NOT NULL,            -- snapshot ລາຄາຕອນຈອງ
  line_total     DECIMAL(12,2) NOT NULL,

  KEY idx_booking_items_booking (booking_id),
  CONSTRAINT fk_items_booking FOREIGN KEY (booking_id)
    REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_ticket_type FOREIGN KEY (ticket_type_id)
    REFERENCES ticket_types(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ບໍລິການເສີມທີ່ຈອງ
CREATE TABLE booking_add_ons (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id  BIGINT UNSIGNED NOT NULL,
  add_on_id   BIGINT UNSIGNED NOT NULL,
  quantity    SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  unit_price  DECIMAL(12,2) NOT NULL,
  line_total  DECIMAL(12,2) NOT NULL,

  KEY idx_booking_add_ons_booking (booking_id),
  CONSTRAINT fk_baddons_booking FOREIGN KEY (booking_id)
    REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_baddons_addon FOREIGN KEY (add_on_id)
    REFERENCES add_ons(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =====================================================================
--  6. ການຈ່າຍເງິນ
-- =====================================================================

CREATE TABLE payments (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id     BIGINT UNSIGNED NOT NULL,
  method         ENUM('bcel_one','ldb','onepay','card','cash','other') NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,
  currency       CHAR(3)      NOT NULL DEFAULT 'LAK',
  exchange_rate  DECIMAL(14,6) NULL,                -- ຖ້າຈ່າຍຕ່າງສະກຸນ
  transaction_id VARCHAR(100) NULL,                 -- ເລກອ້າງອີງຈາກ gateway
  proof_url      VARCHAR(500) NULL,                 -- ຫຼັກຖານການໂອນ
  status         ENUM('pending','success','failed','refunded') NOT NULL DEFAULT 'pending',
  paid_at        DATETIME     NULL,
  refund_amount  DECIMAL(12,2) NULL,
  refund_reason  VARCHAR(255) NULL,
  refunded_at    DATETIME     NULL,
  -- ການກວດຫຼັກຖານໂອນ (ຂໍ້ຕົກລົງ 20): ຜູ້ຮັບຜິດຊອບຕ້ອງເຫັນໃນແຖວນີ້ໂດຍກົງ ບໍ່ແມ່ນໃນ audit_logs ຢ່າງດຽວ
  reject_reason  VARCHAR(255) NULL,                 -- ລູກຄ້າເຫັນ — ແຍກຈາກ refund_reason ແລະ bookings.note
  verified_by    BIGINT UNSIGNED NULL,              -- ຜູ້ອະນຸມັດ ຫຼື ປະຕິເສດ
  verified_at    DATETIME     NULL,
  raw_response   JSON         NULL,                 -- ເກັບ response ດິບຈາກ gateway
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_payments_booking (booking_id),
  KEY idx_payments_status (status),
  KEY idx_payments_txn (transaction_id),
  KEY idx_payments_verified_by (verified_by),
  CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id)
    REFERENCES bookings(id) ON DELETE RESTRICT,
  -- RESTRICT ບໍ່ແມ່ນ SET NULL: ລຶບ user ບໍ່ໄດ້ຖ້າເຄີຍກວດເງິນ (ໃຫ້ປິດດ້ວຍ is_active ແທນ)
  CONSTRAINT fk_payments_verified_by FOREIGN KEY (verified_by)
    REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =====================================================================
--  7. ການກວດປີ້ເຂົ້າ
-- =====================================================================

CREATE TABLE check_ins (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id  BIGINT UNSIGNED NOT NULL,
  gate        VARCHAR(30)  NOT NULL DEFAULT 'main',
  scanned_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  scanned_by  BIGINT UNSIGNED NULL,
  result      ENUM('ok','duplicate','expired','invalid','wrong_date','unpaid','cancelled')
              NOT NULL DEFAULT 'ok',
  note        VARCHAR(255) NULL,

  -- ປີ້ 1 ອັນ ຜ່ານປະຕູໄດ້ຄັ້ງດຽວ: ບັງຄັບດ້ວຍ unique ສະເພາະ result='ok'
  -- (MySQL ບໍ່ມີ partial index — ໃຊ້ generated column ແທນ)
  ok_booking_id BIGINT UNSIGNED
    GENERATED ALWAYS AS (IF(result = 'ok', booking_id, NULL)) STORED,

  UNIQUE KEY uk_check_ins_ok (ok_booking_id),
  KEY idx_check_ins_booking (booking_id),
  KEY idx_check_ins_scanned_at (scanned_at),
  -- RESTRICT: MySQL ບໍ່ອະນຸຍາດ CASCADE ກັບຄໍລຳທີ່ເປັນຖານຂອງ STORED generated column
  CONSTRAINT fk_checkins_booking FOREIGN KEY (booking_id)
    REFERENCES bookings(id) ON DELETE RESTRICT,
  CONSTRAINT fk_checkins_user FOREIGN KEY (scanned_by)
    REFERENCES users(id) ON DELETE RESTRICT  -- ຫ້າມລຶບ user (CLAUDE.md ພາກ 4)
) ENGINE=InnoDB;

-- =====================================================================
--  8. ຈຳນວນຈຳກັດ / ຕາຕະລາງເປີດ-ປິດ
-- =====================================================================

CREATE TABLE daily_capacity (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  capacity_date DATE         NOT NULL,
  time_slot_id  BIGINT UNSIGNED NULL,               -- NULL = ທັງວັນ
  max_visitors  INT UNSIGNED NOT NULL,
  -- ບໍ່ເກັບຈຳນວນທີ່ຈອງແລ້ວໄວ້ທີ່ນີ້ — ຄິດຈາກ bookings ທຸກຄັ້ງ ເພື່ອບໍ່ໃຫ້ຕົວເລກໄປຄົນລະທາງ (ຂໍ້ຕົກລົງ 27)

  -- UNIQUE ຖືວ່າ NULL ບໍ່ຊ້ຳກັນ → ໃຊ້ 0 ແທນ NULL ເພື່ອກັນແຖວ "ທັງວັນ" ຊ້ຳ
  slot_key      BIGINT UNSIGNED
    GENERATED ALWAYS AS (IFNULL(time_slot_id, 0)) STORED,

  UNIQUE KEY uk_capacity_date_slot (capacity_date, slot_key),
  KEY idx_capacity_time_slot (time_slot_id),
  CONSTRAINT fk_capacity_time_slot FOREIGN KEY (time_slot_id)
    REFERENCES time_slots(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE operating_hours (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  day_of_week TINYINT UNSIGNED NOT NULL,            -- 0=ອາທິດ ... 6=ເສົາ
  open_time   TIME         NOT NULL,
  close_time  TIME         NOT NULL,
  is_closed   BOOLEAN      NOT NULL DEFAULT FALSE,

  UNIQUE KEY uk_operating_dow (day_of_week)
) ENGINE=InnoDB;

CREATE TABLE holidays (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  holiday_date DATE         NOT NULL,
  name_lo      VARCHAR(100) NOT NULL,
  name_en      VARCHAR(100) NULL,
  is_closed    BOOLEAN      NOT NULL DEFAULT TRUE,

  UNIQUE KEY uk_holidays_date (holiday_date)
) ENGINE=InnoDB;

-- =====================================================================
--  9. ອັດຕາແລກປ່ຽນ (ເກັບປະຫວັດ ເພື່ອໃຫ້ລາຍງານຍ້ອນຫຼັງຖືກຕ້ອງ)
-- =====================================================================

CREATE TABLE exchange_rates (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  from_currency CHAR(3)      NOT NULL,
  to_currency   CHAR(3)      NOT NULL,
  rate          DECIMAL(14,6) NOT NULL,
  effective_date DATE        NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_rates (from_currency, to_currency, effective_date)
) ENGINE=InnoDB;

-- =====================================================================
--  10. cache ເສັ້ນທາງ (ຟັງຊັນໄລຍະທາງ)
-- =====================================================================

CREATE TABLE route_cache (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  origin_key   VARCHAR(32)  NOT NULL,               -- '19.89,102.14' — ປັດ 2 ທົດສະນິຍົມ (~1 ກມ)
                                                    -- ຫ້າມເກັບພິກັດແທ້ຂອງຜູ້ໃຊ້
  distance_km  DECIMAL(8,2) NOT NULL,
  duration_min INT UNSIGNED NOT NULL,
  provider     VARCHAR(32)  NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- ອາຍຸຂອງ cache (ບໍ່ແມ່ນເວລາທີ່ຜູ້ໃຊ້ມາ)

  UNIQUE KEY uk_route_cache_origin (origin_key),
  KEY idx_route_cache_created (created_at)
) ENGINE=InnoDB;

-- ບ່ອນພັກ / ຈຸດທ່ອງທ່ຽວຍອດນິຍົມ: dropdown ເລືອກຈຸດເລີ່ມຕົ້ນ + ໄລຍະທາງທີ່ຄຳນວນໄວ້ລ່ວງໜ້າ
-- ເປັນສະຖານທີ່ສາທາລະນະ ບໍ່ແມ່ນພິກັດຂອງຜູ້ໃຊ້
CREATE TABLE places (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name_lo      VARCHAR(150) NOT NULL,
  name_en      VARCHAR(150) NOT NULL,
  name_zh      VARCHAR(150) NULL,
  name_th      VARCHAR(150) NULL,
  type         ENUM('hotel','landmark','airport') NOT NULL,
  lat          DECIMAL(9,6) NOT NULL,
  lng          DECIMAL(9,6) NOT NULL,
  distance_km  DECIMAL(8,2) NULL,                   -- NULL = ຍັງບໍ່ໄດ້ຄຳນວນດ້ວຍ routing API
  duration_min INT UNSIGNED NULL,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,

  KEY idx_places_active_type (is_active, type)
) ENGINE=InnoDB;

-- =====================================================================
--  11. ການຕັ້ງຄ່າ + Audit log
-- =====================================================================

CREATE TABLE settings (
  setting_key   VARCHAR(80)  PRIMARY KEY,
  setting_value TEXT         NOT NULL,
  description   VARCHAR(255) NULL,
  updated_by    BIGINT UNSIGNED NULL,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_settings_user FOREIGN KEY (updated_by)
    REFERENCES users(id) ON DELETE RESTRICT  -- ຫ້າມລຶບ user (CLAUDE.md ພາກ 4)
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NULL,
  action      VARCHAR(50)  NOT NULL,                -- 'booking.cancel', 'price.update'
  table_name  VARCHAR(50)  NULL,
  record_id   BIGINT UNSIGNED NULL,
  old_value   JSON         NULL,
  new_value   JSON         NULL,
  ip_address  VARCHAR(45)  NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_audit_user (user_id),
  KEY idx_audit_created (created_at),
  KEY idx_audit_record (table_name, record_id),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE RESTRICT  -- ຫ້າມລຶບ user (CLAUDE.md ພາກ 4)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
--  VIEW: ລາຍໄດ້ຕໍ່ວັນ
-- =====================================================================

CREATE OR REPLACE VIEW v_daily_revenue AS
SELECT
  b.visit_date,
  b.channel,
  COUNT(*)                                  AS booking_count,
  COALESCE(SUM(v.visitors), 0)              AS visitor_count,
  COALESCE(SUM(b.total_amount), 0)          AS revenue_lak
FROM bookings b
-- ລວມຈຳນວນຄົນຕໍ່ການຈອງກ່ອນ JOIN ບໍ່ດັ່ງນັ້ນ total_amount ຈະຖືກນັບຊ້ຳຕາມຈຳນວນແຖວ items
LEFT JOIN (
  SELECT booking_id, SUM(quantity) AS visitors
  FROM booking_items
  GROUP BY booking_id
) v ON v.booking_id = b.id
WHERE b.status IN ('paid','used')
GROUP BY b.visit_date, b.channel;

-- =====================================================================
--  SEED DATA
--  ⚠️ ລາຄາຂ້າງລຸ່ມເປັນ "ຕົວຢ່າງ" ເທົ່ານັ້ນ
--  TODO: ຢືນຢັນລາຄາແທ້ກັບຜູ້ຈັດການຕາດກວາງຊີ ກ່ອນເປີດໃຊ້ຈິງ
-- =====================================================================

INSERT INTO ticket_types
  (code, name_lo, name_en, visitor_group, age_group, age_min, age_max, price, sort_order)
VALUES
  ('LAO_ADULT',  'ຄົນລາວ — ຜູ້ໃຫຍ່',      'Lao — Adult',       'lao',       'adult',  13, NULL,  25000.00, 1),
  ('LAO_CHILD',  'ຄົນລາວ — ເດັກ',          'Lao — Child',       'lao',       'child',   6,   12,  10000.00, 2),
  ('LAO_FREE',   'ຄົນລາວ — ເດັກນ້ອຍ ຟຣີ',  'Lao — Infant Free', 'lao',       'free',    0,    5,      0.00, 3),
  ('FOR_ADULT',  'ຕ່າງປະເທດ — ຜູ້ໃຫຍ່',   'Foreigner — Adult', 'foreigner', 'adult',  13, NULL,  65000.00, 4),
  ('FOR_CHILD',  'ຕ່າງປະເທດ — ເດັກ',       'Foreigner — Child', 'foreigner', 'child',   6,   12,  35000.00, 5),
  ('FOR_FREE',   'ຕ່າງປະເທດ — ເດັກນ້ອຍ ຟຣີ','Foreigner — Infant','foreigner','free',    0,    5,      0.00, 6);

INSERT INTO add_ons (code, name_lo, name_en, price, unit) VALUES
  ('SHUTTLE', 'ລົດຮັບສົ່ງ',        'Shuttle bus',  50000.00, 'per_person'),
  ('GUIDE',   'ໄກ້ນຳທ່ຽວ',         'Tour guide',  150000.00, 'per_booking'),
  ('LOCKER',  'ຕູ້ຝາກຂອງ',         'Locker',       10000.00, 'per_item'),
  ('BEAR',    'ເຂົ້າຊົມສູນໝີ',     'Bear centre',  20000.00, 'per_person');

INSERT INTO operating_hours (day_of_week, open_time, close_time) VALUES
  (0,'08:00:00','17:30:00'), (1,'08:00:00','17:30:00'), (2,'08:00:00','17:30:00'),
  (3,'08:00:00','17:30:00'), (4,'08:00:00','17:30:00'), (5,'08:00:00','17:30:00'),
  (6,'08:00:00','17:30:00');

INSERT INTO settings (setting_key, setting_value, description) VALUES
  ('site_lat',            '19.74917',  'latitude ຕາດກວາງຊີ'),
  ('site_lng',            '101.99167', 'longitude ຕາດກວາງຊີ'),
  ('booking_hold_minutes','30',        'ປີ້ pending ໝົດອາຍຸຫຼັງ x ນາທີ'),
  ('refund_full_hours',   '24',        'ຍົກເລີກກ່ອນ x ຊມ ຄືນ 100%'),
  ('refund_half_hours',   '12',        'ຍົກເລີກກ່ອນ x ຊມ ຄືນ 50%'),
  ('default_currency',    'LAK',       'ສະກຸນເງິນຫຼັກ'),
  ('max_visitors_per_day','3000',      'ຈຳນວນສູງສຸດຕໍ່ວັນ — TODO: ຢືນຢັນ'),
  ('pos_auto_checkin',    'false',     'true = ປີ້ທີ່ຂາຍຢູ່ POS ໝາຍເຂົ້າແລ້ວທັນທີ — TODO: ຢືນຢັນຜັງພື້ນທີ່ປະຕູ/ບ່ອນຂາຍກັບຜູ້ຈັດການຕາດ'),
  ('session_hours',       '12',        'ອາຍຸ session ພະນັກງານ (ຊົ່ວໂມງ, 1–24) — 1 ກະເຮັດວຽກ, ບັງຄັບ login ໃໝ່ທຸກເຊົ້າ'),
  ('login_max_attempts',  '5',         'ລະຫັດຜ່ານຜິດຕິດກັນ x ຄັ້ງ → ລັອກບັນຊີ'),
  ('login_lockout_minutes','15',       'ລັອກບັນຊີ x ນາທີ ຫຼັງຜິດຄົບ login_max_attempts'),
  ('max_people_per_booking','30',      'ຈຳນວນຄົນສູງສຸດຕໍ່ການຈອງ online 1 ອັນ (POS ບໍ່ຈຳກັດ)'),
  ('max_advance_days',    '90',        'ຈອງ online ລ່ວງໜ້າໄດ້ໄກສຸດ x ວັນ — ລາຄາປ່ຽນທຸກໄຕມາດ'),
  ('booking_create_limit_per_ip','20', 'ສ້າງການຈອງ online ໄດ້ x ຄັ້ງຕໍ່ IP ໃນ booking_create_window_minutes (ກັນ bot ກັນບ່ອນ) — ໂຮງແຮມໃຊ້ IP ຮ່ວມກັນ ຢ່າຕັ້ງຕ່ຳເກີນ'),
  ('booking_create_window_minutes','60','ໄລຍະເວລາ (ນາທີ) ສຳລັບ booking_create_limit_per_ip'),
  -- ຂໍ້ຕົກລົງ 28: ຍັງເປັນ TODO → ການຈອງ online ປິດອັດຕະໂນມັດ ຈົນກວ່າ admin ໃສ່ຂໍ້ມູນແທ້
  ('bank_name',           'TODO: ຕ້ອງຢືນຢັນ', 'ຊື່ທະນາຄານສຳລັບໂອນເງິນ'),
  ('bank_account_number', 'TODO: ຕ້ອງຢືນຢັນ', 'ເລກບັນຊີສຳລັບໂອນເງິນ'),
  ('bank_account_name',   'TODO: ຕ້ອງຢືນຢັນ', 'ຊື່ບັນຊີສຳລັບໂອນເງິນ'),
  -- ເວລາກວດຫຼັກຖານ ສະແດງຕອນລູກຄ້າກຳລັງຈະໂອນ → ຕ້ອງມີຄົບ 4 ພາສາ ຈຶ່ງເປີດຈອງ online ໄດ້
  ('verify_time_note_lo', 'TODO: ຕ້ອງຢືນຢັນ', 'ເວລາກວດຫຼັກຖານ (ລາວ) ເຊັ່ນ "ກວດພາຍໃນ 1 ຊົ່ວໂມງ ໃນເວລາເຮັດວຽກ"'),
  ('verify_time_note_en', 'TODO: ຕ້ອງຢືນຢັນ', 'ເວລາກວດຫຼັກຖານ (ອັງກິດ) ເຊັ່ນ "Checked within 1 hour during opening hours"'),
  ('verify_time_note_zh', 'TODO: ຕ້ອງຢືນຢັນ', 'ເວລາກວດຫຼັກຖານ (ຈີນ)'),
  ('verify_time_note_th', 'TODO: ຕ້ອງຢືນຢັນ', 'ເວລາກວດຫຼັກຖານ (ໄທ)');

-- ບັນຊີ admin ເລີ່ມຕົ້ນ
-- ⚠️ password_hash ຂ້າງລຸ່ມເປັນ placeholder — ຕ້ອງສ້າງ hash ຈິງດ້ວຍ bcrypt
INSERT INTO users (username, email, password_hash, full_name, role) VALUES
  ('admin', 'admin@kuangsi.la', '$2b$10$REPLACE_ME_WITH_REAL_BCRYPT_HASH', 'ຜູ້ດູແລລະບົບ', 'admin');
