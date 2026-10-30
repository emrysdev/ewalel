-- Ewalel Cottages database. Safe to run more than once (the server runs it at start-up).
-- Money is whole Kenya shillings (INT). Dates are DATE. created_at / confirmed_at are Unix milliseconds.

CREATE TABLE IF NOT EXISTS units (
  id          VARCHAR(20)  NOT NULL PRIMARY KEY,
  name        VARCHAR(80)  NOT NULL,
  price       INT          NOT NULL,            -- KES per night
  cap         INT          NOT NULL,            -- maximum guests
  beds        VARCHAR(40)  NOT NULL DEFAULT '',
  blurb       TEXT,
  sort_order  INT          NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS unit_images (
  id        INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  unit_id   VARCHAR(20)  NOT NULL,
  url       VARCHAR(300) NOT NULL,
  position  INT          NOT NULL DEFAULT 0,   -- 0 = cover photo
  KEY idx_unit_images (unit_id, position),
  CONSTRAINT fk_images_unit FOREIGN KEY (unit_id) REFERENCES units (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bookings (
  id            VARCHAR(20)  NOT NULL PRIMARY KEY,
  ref           VARCHAR(12)  NOT NULL,                     -- booking code the guest sees (M-Pesa account number)
  unit_id       VARCHAR(20)  NOT NULL,
  check_in      DATE         NOT NULL,
  check_out     DATE         NOT NULL,                     -- the check-out day itself is free for the next guest
  nights        INT          NOT NULL,
  guests        INT          NOT NULL,
  name          VARCHAR(80)  NOT NULL,
  phone         VARCHAR(20)  NOT NULL DEFAULT '',
  email         VARCHAR(100) NOT NULL DEFAULT '',
  notes         VARCHAR(300) NOT NULL DEFAULT '',
  total         INT          NOT NULL,
  deposit       INT          NOT NULL DEFAULT 0,
  status        ENUM('awaiting_payment','payment_submitted','confirmed','cancelled') NOT NULL,
  receipt       VARCHAR(20)  NULL,                         -- M-Pesa receipt number
  source        ENUM('web','admin') NOT NULL DEFAULT 'web',
  created_at    BIGINT       NOT NULL,
  confirmed_at  BIGINT       NULL,
  UNIQUE KEY uq_bookings_ref (ref),
  UNIQUE KEY uq_bookings_receipt (receipt),                -- one M-Pesa receipt can pay for one booking only
  KEY idx_bookings_unit_dates (unit_id, check_in, check_out),
  KEY idx_bookings_status (status),
  KEY idx_bookings_phone (phone),
  CONSTRAINT fk_bookings_unit FOREIGN KEY (unit_id) REFERENCES units (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS blocks (                        -- maintenance days, first and last day both included
  id         VARCHAR(20)  NOT NULL PRIMARY KEY,
  unit_id    VARCHAR(20)  NOT NULL,
  from_date  DATE         NOT NULL,
  to_date    DATE         NOT NULL,
  reason     VARCHAR(200) NOT NULL DEFAULT 'Maintenance',
  KEY idx_blocks_unit_dates (unit_id, from_date, to_date),
  CONSTRAINT fk_blocks_unit FOREIGN KEY (unit_id) REFERENCES units (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mpesa_payments (                -- payments reported by Safaricom Daraja
  trans_id     VARCHAR(20)  NOT NULL PRIMARY KEY,          -- the M-Pesa receipt number
  amount       INT          NOT NULL,
  msisdn       VARCHAR(40)  NULL,
  name         VARCHAR(120) NULL,
  account      VARCHAR(40)  NULL,
  paid_at      VARCHAR(20)  NULL,
  received_at  BIGINT       NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (                      -- value is JSON text
  name   VARCHAR(40) NOT NULL PRIMARY KEY,
  value  TEXT        NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
