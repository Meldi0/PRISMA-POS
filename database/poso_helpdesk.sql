-- PRISMA POS schema. No DROP statements or demo credentials.
-- Select your target database before importing, then run npm run migrate.
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(50) PRIMARY KEY, name VARCHAR(150) NOT NULL, email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL, role VARCHAR(50) NOT NULL DEFAULT 'UPT_LUAR',
  is_active TINYINT NOT NULL DEFAULT 1, account_status ENUM('PENDING','ACTIVE','REJECTED','SUSPENDED','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  region_id VARCHAR(50) NULL, office_id VARCHAR(50) NULL, data_scope ENUM('GLOBAL','REGIONAL','OFFICE','OWN') NOT NULL DEFAULT 'OFFICE',
  mfa_enabled TINYINT NOT NULL DEFAULT 0, failed_attempts INT NOT NULL DEFAULT 0, locked_until DATETIME NULL, last_login_at DATETIME NULL,
  nip VARCHAR(50) NULL, department VARCHAR(150) NULL, role_title VARCHAR(150) NULL, position VARCHAR(100) NULL, created_by VARCHAR(150) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS tickets (
  ticket_id VARCHAR(50) PRIMARY KEY, subject VARCHAR(255) NOT NULL, category VARCHAR(100) NOT NULL, department VARCHAR(150) NULL,
  topic VARCHAR(150) NULL, location VARCHAR(150) NULL, region_id VARCHAR(50) NULL, office_id VARCHAR(50) NULL, description LONGTEXT NOT NULL,
  priority ENUM('Low','Medium','High','Urgent') NOT NULL DEFAULT 'Medium', status ENUM('open','in_progress','waiting','resolved','closed') NOT NULL DEFAULT 'open',
  channel ENUM('web','email') NOT NULL DEFAULT 'web', requester_name VARCHAR(150) NULL, requester_email VARCHAR(150) NOT NULL,
  requester_phone VARCHAR(30) NULL, requester_nip VARCHAR(50) NULL, assigned_upt VARCHAR(100) NULL, assigned_operator VARCHAR(150) NULL,
  sla_due_at DATETIME NULL, closed_at DATETIME NULL, is_archived TINYINT NOT NULL DEFAULT 0,
  reopen_status ENUM('NONE','PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'NONE', attachments JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tickets_created (created_at), INDEX idx_tickets_requester (requester_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS threads (
  thread_id VARCHAR(50) PRIMARY KEY, ticket_id VARCHAR(50) NOT NULL, sender_id VARCHAR(50) NOT NULL, sender_name VARCHAR(150) NOT NULL,
  sender_role VARCHAR(50) NOT NULL, message LONGTEXT NOT NULL, visibility ENUM('public','internal') NOT NULL DEFAULT 'public',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_thread_ticket_date (ticket_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id VARCHAR(50) PRIMARY KEY, ticket_id VARCHAR(50) NULL, actor_id VARCHAR(50) NULL, actor_name VARCHAR(150) NOT NULL, actor_role VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL, entity_type VARCHAR(50) NULL, entity_id VARCHAR(50) NULL, details TEXT NULL, description TEXT NULL,
  ip_address VARCHAR(45) NULL, user_agent TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_actor_action_date (actor_id,action,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(100) PRIMARY KEY, setting_value TEXT NOT NULL, description VARCHAR(255) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS regions (
        region_id VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) NOT NULL,
        description VARCHAR(255) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (region_id),
        UNIQUE KEY uk_regions_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS offices (
        office_id VARCHAR(50) NOT NULL,
        region_id VARCHAR(50) NOT NULL,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(20) NOT NULL,
        type ENUM('PUSAT', 'KCU', 'KC', 'KCP') NOT NULL DEFAULT 'KC',
        address TEXT DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (office_id),
        KEY idx_offices_region_id (region_id),
        KEY idx_offices_code (code),
        CONSTRAINT fk_offices_region FOREIGN KEY (region_id) REFERENCES regions (region_id) ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS roles (
        role_code VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) DEFAULT NULL,
        default_scope ENUM('GLOBAL', 'REGIONAL', 'OFFICE', 'OWN') NOT NULL DEFAULT 'OFFICE',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(100) NOT NULL,
        name VARCHAR(150) NOT NULL,
        description VARCHAR(255) DEFAULT NULL,
        module VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_permissions_code (code),
        KEY idx_permissions_module (module)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_code VARCHAR(50) NOT NULL,
        permission_id INT NOT NULL,
        effect ENUM('ALLOW', 'DENY') NOT NULL DEFAULT 'ALLOW',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_role_perm (role_code, permission_id),
        CONSTRAINT fk_rp_role FOREIGN KEY (role_code) REFERENCES roles (role_code) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS user_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        permission_id INT NOT NULL,
        effect ENUM('ALLOW', 'DENY') NOT NULL DEFAULT 'ALLOW',
        granted_by VARCHAR(50) DEFAULT 'system',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_perm (user_id, permission_id),
        CONSTRAINT fk_up_perm FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS registration_approvals (
        approval_id VARCHAR(50) NOT NULL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
        reviewed_by VARCHAR(50) DEFAULT NULL,
        reviewer_name VARCHAR(150) DEFAULT NULL,
        rejection_reason TEXT DEFAULT NULL,
        reviewed_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_reg_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS mfa_challenges (
        challenge_id VARCHAR(50) NOT NULL PRIMARY KEY,
        challenge_token VARCHAR(255) NOT NULL,
        user_id VARCHAR(50) NOT NULL,
        expires_at DATETIME NOT NULL,
        is_used TINYINT(1) NOT NULL DEFAULT 0,
        attempts INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_challenge_token (challenge_token),
        KEY idx_challenge_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS login_sessions (
        session_id VARCHAR(50) NOT NULL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45) DEFAULT NULL,
        user_agent TEXT DEFAULT NULL,
        last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        is_revoked TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_sessions_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS ticket_reopen_requests (
        request_id VARCHAR(50) NOT NULL PRIMARY KEY,
        ticket_id VARCHAR(50) NOT NULL,
        requester_id VARCHAR(50) NOT NULL,
        requester_name VARCHAR(150) NOT NULL,
        requester_email VARCHAR(150) NOT NULL,
        reason TEXT NOT NULL,
        status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
        reviewed_by VARCHAR(50) DEFAULT NULL,
        reviewer_name VARCHAR(150) DEFAULT NULL,
        review_note TEXT DEFAULT NULL,
        reviewed_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_reopen_ticket (ticket_id),
        KEY idx_reopen_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
