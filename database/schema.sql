
CREATE DATABASE IF NOT EXISTS service_job_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE service_job_management;


CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  phone         VARCHAR(20)   NULL,
  role          ENUM('Admin','Worker') NOT NULL DEFAULT 'Worker',
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS jobs (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title              VARCHAR(150) NOT NULL,
  description        TEXT         NULL,
  customer_name      VARCHAR(100) NOT NULL,
  customer_contact   VARCHAR(20)  NOT NULL,
  address            VARCHAR(500) NOT NULL,
  assigned_worker_id INT UNSIGNED NULL,
  priority           ENUM('Low','Medium','High','Urgent') NOT NULL DEFAULT 'Medium',
  status             ENUM('Pending','Assigned','In Progress','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
  created_by         INT UNSIGNED NOT NULL,
  created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_jobs_status (status),
  KEY idx_jobs_priority (priority),
  KEY idx_jobs_worker (assigned_worker_id),
  KEY idx_jobs_created_at (created_at),
  KEY idx_jobs_customer_name (customer_name),
  CONSTRAINT fk_jobs_worker  FOREIGN KEY (assigned_worker_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_jobs_creator FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS job_parts (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  job_id      INT UNSIGNED  NOT NULL,
  part_name   VARCHAR(150)  NOT NULL,
  unit_price  DECIMAL(10,2) NOT NULL,
  quantity    INT UNSIGNED  NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  added_by    INT UNSIGNED  NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_parts_job (job_id),
  CONSTRAINT chk_parts_price CHECK (unit_price >= 0),
  CONSTRAINT chk_parts_qty   CHECK (quantity > 0),
  CONSTRAINT fk_parts_job  FOREIGN KEY (job_id)   REFERENCES jobs(id)  ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT fk_parts_user FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS job_images (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id        INT UNSIGNED NOT NULL,
  file_name     VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(50)  NOT NULL,
  file_size     INT UNSIGNED NOT NULL,
  file_path     VARCHAR(500) NOT NULL,
  uploaded_by   INT UNSIGNED NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_images_file_name (file_name),
  KEY idx_images_job (job_id),
  CONSTRAINT fk_images_job  FOREIGN KEY (job_id)      REFERENCES jobs(id)  ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT fk_images_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS invoices (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  invoice_number VARCHAR(30)   NOT NULL,
  job_id         INT UNSIGNED  NOT NULL,
  parts_total    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  service_cost   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  cleaning_cost  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  subtotal       DECIMAL(12,2) NOT NULL,
  gst_percent    DECIMAL(5,2)  NOT NULL DEFAULT 10.00,
  gst_amount     DECIMAL(12,2) NOT NULL,
  final_total    DECIMAL(12,2) NOT NULL,
  generated_by   INT UNSIGNED  NOT NULL,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoices_job (job_id),
  UNIQUE KEY uq_invoices_number (invoice_number),
  CONSTRAINT chk_inv_service  CHECK (service_cost >= 0),
  CONSTRAINT chk_inv_cleaning CHECK (cleaning_cost >= 0),
  CONSTRAINT fk_invoices_job  FOREIGN KEY (job_id)       REFERENCES jobs(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_invoices_user FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;
