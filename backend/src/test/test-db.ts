import mysql from "mysql2/promise";
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

export async function getTestConnection() {
  loadEnv();
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = Number.parseInt(process.env.DB_PORT || "3306", 10);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "phts_test";
  const connectTimeout = Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS || "5000", 10);
  return mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    connectTimeout,
    multipleStatements: true,
  });
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
        emp_type VARCHAR(50) NULL,
        mission_group VARCHAR(255) NULL,
        start_work_date DATE NULL
      )
    `);
    await ensureColumn(conn, "emp_profiles", "position_name", "VARCHAR(255) NULL");
    await ensureColumn(conn, "emp_profiles", "department", "VARCHAR(255) NULL");
    await ensureColumn(conn, "emp_profiles", "sub_department", "VARCHAR(255) NULL");
    await ensureColumn(conn, "emp_profiles", "position_number", "VARCHAR(100) NULL");
    await ensureColumn(conn, "emp_profiles", "emp_type", "VARCHAR(50) NULL");
    await ensureColumn(conn, "emp_profiles", "mission_group", "VARCHAR(255) NULL");
    await ensureColumn(conn, "emp_profiles", "start_work_date", "DATE NULL");

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
        is_frozen TINYINT NOT NULL DEFAULT 0,
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
        snapshot_id INT NULL
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
        is_frozen TINYINT NOT NULL DEFAULT 0,
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
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS pay_periods (
        period_id INT AUTO_INCREMENT PRIMARY KEY,
        period_month INT NOT NULL,
        period_year INT NOT NULL,
        status VARCHAR(50) NOT NULL,
        is_frozen TINYINT NOT NULL DEFAULT 0,
        frozen_at DATETIME NULL,
        frozen_by INT NULL
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

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS emp_profiles (
        citizen_id VARCHAR(20) PRIMARY KEY,
        first_name VARCHAR(100) NULL,
        last_name VARCHAR(100) NULL,
        department VARCHAR(255) NULL,
        position_name VARCHAR(255) NULL
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS emp_support_staff (
        citizen_id VARCHAR(20) PRIMARY KEY,
        first_name VARCHAR(100) NULL,
        last_name VARCHAR(100) NULL,
        department VARCHAR(255) NULL,
        position_name VARCHAR(255) NULL
      )
    `);

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
    await conn.execute("DELETE FROM pay_results");
    await conn.execute("DELETE FROM pay_periods");
  } finally {
    await conn.end();
  }
}
