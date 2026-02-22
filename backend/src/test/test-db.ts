import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { loadEnv } from '@config/env.js';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const ensureColumn = async (
  conn: mysql.Connection,
  table: string,
  column: string,
  definition: string,
) => {
  try {
    await conn.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (error: any) {
    const message = String(error?.message || "");
    if (!message.includes("Duplicate column")) {
      throw error;
    }
  }
};

type TestDbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectTimeout: number;
};

const unique = <T>(items: T[]) => Array.from(new Set(items));

function buildTestDbCandidates(): TestDbConfig[] {
  loadEnv();

  const host = process.env.TEST_DB_HOST || process.env.DB_HOST || "127.0.0.1";
  const database = process.env.TEST_DB_NAME || process.env.DB_NAME || "phts_test";
  const connectTimeout = Number.parseInt(
    process.env.DB_CONNECT_TIMEOUT_MS || "5000",
    10,
  );
  const envPort = Number.parseInt(
    process.env.TEST_DB_PORT || process.env.DB_PORT || "3306",
    10,
  );
  const envUser = process.env.TEST_DB_USER || process.env.DB_USER || "root";
  const envPassword = process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? "";

  const ports: number[] = [envPort];
  const hosts: string[] = [host];
  const userPassCandidates: Array<{ user: string; password: string }> = [
    { user: envUser, password: envPassword },
  ];

  const localPath = path.join(process.cwd(), ".env.local");
  if (process.env.NODE_ENV === "test" && fs.existsSync(localPath)) {
    const parsed = dotenv.parse(fs.readFileSync(localPath));
    const localHost = String(parsed.DB_HOST || "").trim();
    const localPort = Number.parseInt(String(parsed.DB_PORT || ""), 10);
    const localUser = String(parsed.DB_USER || "").trim();
    const localPassword = String(parsed.DB_PASSWORD || "");

    if (localHost) hosts.push(localHost);
    if (Number.isFinite(localPort)) ports.push(localPort);
    if (localUser) userPassCandidates.push({ user: localUser, password: localPassword });
  }

  const dedupedPorts = unique(ports).filter((p) => Number.isFinite(p));
  const dedupedHosts = unique(hosts).filter((h) => h.length > 0);
  const creds = unique(
    userPassCandidates.map((c) => `${c.user}\u0000${c.password}`),
  ).map((entry) => {
    const [user, password] = entry.split("\u0000");
    return { user, password };
  });

  const candidates: TestDbConfig[] = [];
  for (const candidateHost of dedupedHosts) {
    for (const cred of creds) {
      for (const port of dedupedPorts) {
        candidates.push({
          host: candidateHost,
          port,
          user: cred.user,
          password: cred.password,
          database,
          connectTimeout,
        });
      }
    }
  }
  return candidates;
}

async function ensureDatabaseExists(config: TestDbConfig): Promise<void> {
  const conn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    connectTimeout: config.connectTimeout,
    multipleStatements: true,
  });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
  } finally {
    await conn.end();
  }
}

export async function getTestConnection() {
  const candidates = buildTestDbCandidates();
  const dbName = candidates[0]?.database || "phts_test";
  if (!/test/i.test(dbName)) {
    throw new Error(
      `[test-db] Refusing to run on non-test DB name: ${dbName}`,
    );
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return await mysql.createConnection({
        host: candidate.host,
        port: candidate.port,
        user: candidate.user,
        password: candidate.password,
        database: candidate.database,
        connectTimeout: candidate.connectTimeout,
        multipleStatements: true,
      });
    } catch (error: any) {
      const code = String(error?.code || "");
      if (code === "ER_BAD_DB_ERROR") {
        try {
          await ensureDatabaseExists(candidate);
          return await mysql.createConnection({
            host: candidate.host,
            port: candidate.port,
            user: candidate.user,
            password: candidate.password,
            database: candidate.database,
            connectTimeout: candidate.connectTimeout,
            multipleStatements: true,
          });
        } catch (ensureErr) {
          lastError = ensureErr;
          continue;
        }
      }
      lastError = error;
    }
  }

  throw lastError;
}

async function waitForDatabase(retries = 20, delayMs = 250): Promise<void> {
  const isNonRetryableError = (error: unknown): boolean => {
    const code = String((error as any)?.code || "");
    const message = String((error as any)?.message || "");
    return (
      code === "ER_ACCESS_DENIED_ERROR" ||
      code === "ER_DBACCESS_DENIED_ERROR" ||
      code === "ER_BAD_DB_ERROR" ||
      message.includes("Access denied") ||
      message.includes("Unknown database")
    );
  };

  const retryCount = Number.parseInt(
    process.env.TEST_DB_WAIT_RETRIES || String(retries),
    10,
  );
  const retryDelayMs = Number.parseInt(
    process.env.TEST_DB_WAIT_DELAY_MS || String(delayMs),
    10,
  );

  let lastError: unknown;
  for (let i = 0; i < retryCount; i += 1) {
    try {
      const conn = await getTestConnection();
      await conn.ping();
      await conn.end();
      return;
    } catch (error) {
      lastError = error;
      if (isNonRetryableError(error)) {
        throw error;
      }
      await sleep(retryDelayMs);
    }
  }
  throw lastError;
}

export async function resetAuthSchema(): Promise<void> {
  await waitForDatabase();
  const conn = await getTestConnection();
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        citizen_id VARCHAR(20) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        is_active TINYINT NOT NULL DEFAULT 1,
        last_login_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS emp_profiles (
        citizen_id VARCHAR(20) PRIMARY KEY,
        first_name VARCHAR(100) NULL,
        last_name VARCHAR(100) NULL,
        position_name VARCHAR(255) NULL,
        department VARCHAR(255) NULL,
        sub_department VARCHAR(255) NULL,
        position_number VARCHAR(100) NULL,
        email VARCHAR(255) NULL,
        phone VARCHAR(50) NULL,
        emp_type VARCHAR(50) NULL,
        mission_group VARCHAR(255) NULL,
        start_work_date DATE NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await ensureColumn(conn, "emp_profiles", "position_name", "VARCHAR(255) NULL");
    await ensureColumn(conn, "emp_profiles", "department", "VARCHAR(255) NULL");
    await ensureColumn(conn, "emp_profiles", "sub_department", "VARCHAR(255) NULL");
    await ensureColumn(conn, "emp_profiles", "position_number", "VARCHAR(100) NULL");
    await ensureColumn(conn, "emp_profiles", "email", "VARCHAR(255) NULL");
    await ensureColumn(conn, "emp_profiles", "phone", "VARCHAR(50) NULL");
    await ensureColumn(conn, "emp_profiles", "emp_type", "VARCHAR(50) NULL");
    await ensureColumn(conn, "emp_profiles", "mission_group", "VARCHAR(255) NULL");
    await ensureColumn(conn, "emp_profiles", "start_work_date", "DATE NULL");
    await ensureColumn(
      conn,
      "emp_profiles",
      "updated_at",
      "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
    );

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS emp_support_staff (
        citizen_id VARCHAR(20) PRIMARY KEY,
        first_name VARCHAR(100) NULL,
        last_name VARCHAR(100) NULL,
        position_name VARCHAR(255) NULL,
        department VARCHAR(255) NULL,
        emp_type VARCHAR(50) NULL
      )
    `);
    await ensureColumn(conn, "emp_support_staff", "position_name", "VARCHAR(255) NULL");
    await ensureColumn(conn, "emp_support_staff", "department", "VARCHAR(255) NULL");
    await ensureColumn(conn, "emp_support_staff", "emp_type", "VARCHAR(50) NULL");

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS emp_licenses (
        license_id INT AUTO_INCREMENT PRIMARY KEY,
        citizen_id VARCHAR(20) NOT NULL,
        license_name VARCHAR(255) NULL,
        license_no VARCHAR(100) NULL,
        valid_from DATE NULL,
        valid_until DATE NULL,
        status VARCHAR(50) NULL,
        synced_at DATETIME NULL
      )
    `);

    await conn.execute("DELETE FROM emp_licenses");
    await conn.execute("DELETE FROM emp_support_staff");
    await conn.execute("DELETE FROM emp_profiles");
    await conn.execute("DELETE FROM users");
  } finally {
    await conn.end();
  }
}

export async function resetNotificationSchema(): Promise<void> {
  await resetAuthSchema();
  const conn = await getTestConnection();
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS ntf_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        link VARCHAR(255) NOT NULL DEFAULT '#',
        type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
        is_read TINYINT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS ntf_user_settings (
        user_id INT PRIMARY KEY,
        in_app TINYINT NOT NULL DEFAULT 1,
        sms TINYINT NOT NULL DEFAULT 0,
        email TINYINT NOT NULL DEFAULT 0,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute("DELETE FROM ntf_user_settings");
    await conn.execute("DELETE FROM ntf_messages");
  } finally {
    await conn.end();
  }
}

export async function resetRequestSchema(): Promise<void> {
  await resetAuthSchema();
  const conn = await getTestConnection();
  try {
    await conn.execute("DROP TABLE IF EXISTS req_submissions");
    await conn.execute(`
      CREATE TABLE req_submissions (
        request_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        citizen_id VARCHAR(20) NOT NULL,
        request_no VARCHAR(50) NULL,
        personnel_type VARCHAR(50) NULL,
        current_department VARCHAR(255) NULL,
        status VARCHAR(20) NOT NULL,
        current_step INT NOT NULL,
        assigned_officer_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS req_verification_snapshots (
        snapshot_id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        user_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS req_attachments (
        attachment_id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS req_approvals (
        approval_id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        actor_id INT NOT NULL,
        action VARCHAR(20) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute("DELETE FROM req_approvals");
    await conn.execute("DELETE FROM req_attachments");
    await conn.execute("DELETE FROM req_verification_snapshots");
    await conn.execute("DELETE FROM req_submissions");
  } finally {
    await conn.end();
  }
}

export async function resetPayrollSchema(): Promise<void> {
  await resetAuthSchema();
  const conn = await getTestConnection();
  try {
    await conn.execute("DROP TABLE IF EXISTS req_submissions");
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS pay_periods (
        period_id INT AUTO_INCREMENT PRIMARY KEY,
        period_month INT NOT NULL,
        period_year INT NOT NULL,
        status VARCHAR(50) NOT NULL,
        total_amount DECIMAL(12,2) NULL,
        total_headcount INT NULL,
        closed_at DATETIME NULL,
        is_locked TINYINT NOT NULL DEFAULT 0,
        snapshot_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        snapshot_ready_at DATETIME NULL,
        frozen_at DATETIME NULL,
        frozen_by INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS pay_period_items (
        period_item_id INT AUTO_INCREMENT PRIMARY KEY,
        period_id INT NOT NULL,
        request_id INT NOT NULL,
        user_id INT NULL,
        citizen_id VARCHAR(20) NOT NULL,
        snapshot_id INT NULL,
        UNIQUE KEY uk_pay_period_items_period_request (period_id, request_id),
        KEY idx_pay_period_items_period (period_id),
        KEY idx_pay_period_items_period_citizen (period_id, citizen_id),
        KEY idx_pay_period_items_period_user (period_id, user_id)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS req_submissions (
        request_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        citizen_id VARCHAR(20) NOT NULL,
        request_no VARCHAR(50) NULL,
        personnel_type VARCHAR(50) NULL,
        current_department VARCHAR(255) NULL,
        status VARCHAR(20) NOT NULL,
        current_step INT NOT NULL,
        assigned_officer_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS req_verification_snapshots (
        snapshot_id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        user_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS emp_profiles (
        citizen_id VARCHAR(20) PRIMARY KEY,
        first_name VARCHAR(100) NULL,
        last_name VARCHAR(100) NULL,
        position_name VARCHAR(255) NULL,
        department VARCHAR(255) NULL,
        sub_department VARCHAR(255) NULL,
        position_number VARCHAR(100) NULL,
        emp_type VARCHAR(50) NULL,
        mission_group VARCHAR(255) NULL,
        start_work_date DATE NULL
      )
    `);

    await conn.execute("DELETE FROM pay_period_items");
    await conn.execute("DELETE FROM pay_periods");
    await conn.execute("DELETE FROM req_verification_snapshots");
    await conn.execute("DELETE FROM req_submissions");
  } finally {
    await conn.end();
  }
}

export async function resetFinanceSchema(): Promise<void> {
  await waitForDatabase();
  const conn = await getTestConnection();
  try {
    await conn.execute("DROP TABLE IF EXISTS pay_results");
    await conn.execute("DROP TABLE IF EXISTS pay_periods");
    await conn.execute("DROP TABLE IF EXISTS emp_profiles");
    await conn.execute("DROP TABLE IF EXISTS emp_support_staff");

    await conn.execute(`
      CREATE TABLE pay_periods (
        period_id INT AUTO_INCREMENT PRIMARY KEY,
        period_month INT NOT NULL,
        period_year INT NOT NULL,
        status VARCHAR(50) NOT NULL,
        is_locked TINYINT NOT NULL DEFAULT 0,
        snapshot_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        snapshot_ready_at DATETIME NULL,
        frozen_at DATETIME NULL,
        frozen_by INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE pay_results (
        payout_id INT AUTO_INCREMENT PRIMARY KEY,
        period_id INT NOT NULL,
        user_id INT NULL,
        citizen_id VARCHAR(20) NOT NULL,
        profession_code VARCHAR(50) NULL,
        pts_rate_snapshot DECIMAL(10,2) NULL,
        calculated_amount DECIMAL(12,2) NULL,
        retroactive_amount DECIMAL(12,2) NULL,
        total_payable DECIMAL(12,2) NULL,
        payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        paid_at DATETIME NULL,
        paid_by INT NULL,
        updated_at DATETIME NULL
      )
    `);

    await conn.execute(`
      CREATE TABLE emp_profiles (
        citizen_id VARCHAR(20) PRIMARY KEY,
        first_name VARCHAR(100) NULL,
        last_name VARCHAR(100) NULL,
        department VARCHAR(255) NULL,
        department_code VARCHAR(50) NULL
      )
    `);

    await conn.execute(`
      CREATE TABLE emp_support_staff (
        citizen_id VARCHAR(20) PRIMARY KEY,
        first_name VARCHAR(100) NULL,
        last_name VARCHAR(100) NULL,
        department VARCHAR(255) NULL
      )
    `);

    await conn.execute("DELETE FROM pay_results");
    await conn.execute("DELETE FROM pay_periods");
    await conn.execute("DELETE FROM emp_profiles");
    await conn.execute("DELETE FROM emp_support_staff");
  } finally {
    await conn.end();
  }
}

export async function resetSnapshotSchema(): Promise<void> {
  await resetAuthSchema();
  const conn = await getTestConnection();
  try {
    await conn.execute("DROP TABLE IF EXISTS pay_periods");
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS pay_periods (
        period_id INT AUTO_INCREMENT PRIMARY KEY,
        period_month INT NOT NULL,
        period_year INT NOT NULL,
        status VARCHAR(50) NOT NULL,
        is_locked TINYINT NOT NULL DEFAULT 0,
        snapshot_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        snapshot_ready_at DATETIME NULL,
        frozen_at DATETIME NULL,
        frozen_by INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute("DROP TABLE IF EXISTS pay_results");
    await conn.execute(`
      CREATE TABLE pay_results (
        payout_id INT AUTO_INCREMENT PRIMARY KEY,
        period_id INT NOT NULL,
        user_id INT NULL,
        citizen_id VARCHAR(20) NOT NULL,
        profession_code VARCHAR(50) NULL,
        master_rate_id INT NULL,
        calculated_amount DECIMAL(12,2) NULL,
        retroactive_amount DECIMAL(12,2) NULL,
        total_payable DECIMAL(12,2) NULL
      )
    `);

    await conn.execute("DROP TABLE IF EXISTS pay_snapshots");
    await conn.execute(`
      CREATE TABLE pay_snapshots (
        snapshot_id INT AUTO_INCREMENT PRIMARY KEY,
        period_id INT NOT NULL,
        snapshot_type VARCHAR(50) NOT NULL,
        snapshot_data TEXT NOT NULL,
        record_count INT NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute("DROP TABLE IF EXISTS pay_snapshot_outbox");
    await conn.execute(`
      CREATE TABLE pay_snapshot_outbox (
        outbox_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        period_id INT NOT NULL,
        requested_by INT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        attempts INT NOT NULL DEFAULT 0,
        last_error TEXT NULL,
        available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME NULL
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS emp_profiles (
        citizen_id VARCHAR(20) PRIMARY KEY,
        first_name VARCHAR(100) NULL,
        last_name VARCHAR(100) NULL,
        department VARCHAR(255) NULL,
        position_name VARCHAR(255) NULL
      )
    `);
    await ensureColumn(conn, "emp_profiles", "department", "VARCHAR(255) NULL");
    await ensureColumn(conn, "emp_profiles", "position_name", "VARCHAR(255) NULL");

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS emp_support_staff (
        citizen_id VARCHAR(20) PRIMARY KEY,
        first_name VARCHAR(100) NULL,
        last_name VARCHAR(100) NULL,
        department VARCHAR(255) NULL,
        position_name VARCHAR(255) NULL
      )
    `);
    await ensureColumn(conn, "emp_support_staff", "department", "VARCHAR(255) NULL");
    await ensureColumn(conn, "emp_support_staff", "position_name", "VARCHAR(255) NULL");

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS cfg_payment_rates (
        rate_id INT AUTO_INCREMENT PRIMARY KEY,
        amount DECIMAL(12,2) NOT NULL,
        group_no INT NOT NULL,
        item_no VARCHAR(20) NOT NULL,
        profession_code VARCHAR(20) NOT NULL
      )
    `);

    await conn.execute("DELETE FROM pay_snapshots");
    await conn.execute("DELETE FROM pay_snapshot_outbox");
    await conn.execute("DELETE FROM pay_results");
    await conn.execute("DELETE FROM pay_periods");
  } finally {
    await conn.end();
  }
}
