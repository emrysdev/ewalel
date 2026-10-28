CREATE DATABASE IF NOT EXISTS ewalel_cottages CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ewalel_cottages;

CREATE TABLE IF NOT EXISTS properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  capacity INT NOT NULL,
  price_per_night DECIMAL(12,2) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
  id CHAR(36) PRIMARY KEY,
  property_id INT NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INT NOT NULL,
  guest_name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(200) NOT NULL DEFAULT '',
  notes TEXT,
  nights INT NOT NULL,
  total_kes DECIMAL(12,2) NOT NULL,
  status ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_property FOREIGN KEY (property_id) REFERENCES properties(id),
  INDEX idx_availability (property_id, status, check_in, check_out),
  CONSTRAINT chk_stay CHECK (check_out > check_in)
) ENGINE=InnoDB;

INSERT INTO properties (name, capacity, price_per_night) VALUES
  ('Nyati House', 4, 11000),
  ('Chui House', 6, 18000)
ON DUPLICATE KEY UPDATE capacity=VALUES(capacity), price_per_night=VALUES(price_per_night);
