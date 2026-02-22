/**
 * PHTS System - Database Configuration
 *
 * MySQL connection pool setup using mysql2 with promise support
 *
 * Date: 2025-12-30
 */

import mysql, { type PoolConnection } from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { loadEnv } from '@config/env.js';

// Load environment variables
loadEnv();

const dbTimezone = process.env.DB_TIMEZONE || "+07:00";

async function ensureSessionTimezone(connection: PoolConnection): Promise<void> {
  await connection.query("SET time_zone = ?", [dbTimezone]);
}

async function ensureSessionTimezoneOnEventConnection(
  connection: { query: (...args: any[]) => any; promise?: () => { query: (...args: any[]) => Promise<any> } },
): Promise<void> {
  // mysql2 "connection" event provides a callback-style connection.
  // Use promise wrapper when available; otherwise execute with callback.
  if (typeof connection.promise === "function") {
    await connection.promise().query("SET time_zone = ?", [dbTimezone]);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    connection.query("SET time_zone = ?", [dbTimezone], (error: unknown) => {
      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      resolve();
    });
  });
}

type DbRuntimeConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

function readLocalEnvDbConfig(): Partial<DbRuntimeConfig> {
  const localPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(localPath)) return {};
  const parsed = dotenv.parse(fs.readFileSync(localPath));
  const localPort = Number.parseInt(String(parsed.DB_PORT || ""), 10);
  return {
    host: String(parsed.DB_HOST || "").trim() || undefined,
    port: Number.isFinite(localPort) ? localPort : undefined,
    user: String(parsed.DB_USER || "").trim() || undefined,
    password: String(parsed.DB_PASSWORD || ""),
  };
}

function resolveDbRuntimeConfig(): DbRuntimeConfig {
  const envConfig: DbRuntimeConfig = {
    host: process.env.DB_HOST || "localhost",
    port: Number.parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "phts_system",
  };

  // In NODE_ENV=test, allow explicit TEST_DB_* overrides first.
  if (process.env.NODE_ENV === "test") {
    const overriddenByTestEnv: DbRuntimeConfig = {
      host: process.env.TEST_DB_HOST || envConfig.host,
      port: Number.parseInt(process.env.TEST_DB_PORT || String(envConfig.port), 10),
      user: process.env.TEST_DB_USER || envConfig.user,
      password: process.env.TEST_DB_PASSWORD ?? envConfig.password,
      database: process.env.TEST_DB_NAME || envConfig.database,
    };

    if (
      process.env.TEST_DB_HOST ||
      process.env.TEST_DB_PORT ||
      process.env.TEST_DB_USER ||
      process.env.TEST_DB_PASSWORD ||
      process.env.TEST_DB_NAME
    ) {
      return overriddenByTestEnv;
    }

    // Test fallback for local dev machine:
    // keep DB_NAME from test env, but allow host/port/user/password from .env.local
    // when no TEST_DB_* override is provided.
    const local = readLocalEnvDbConfig();
    return {
      host: local.host || envConfig.host,
      port: local.port ?? envConfig.port,
      user: local.user || envConfig.user,
      password: local.password ?? envConfig.password,
      database: envConfig.database,
    };
  }

  return envConfig;
}

const dbConfig = resolveDbRuntimeConfig();

if (process.env.NODE_ENV === "test" && !/test/i.test(dbConfig.database)) {
  throw new Error(
    `[database] Refusing NODE_ENV=test with non-test database: ${dbConfig.database}`,
  );
}

/**
 * Database connection pool configuration
 * Uses connection pooling for better performance and resource management
 */
const pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: dbTimezone,
});

pool.on("connection", (connection) => {
  void ensureSessionTimezoneOnEventConnection(connection).catch((error) => {
    console.error("✗ Failed to set DB session timezone:", error);
  });
});

/**
 * Test database connection
 * Called during server startup to ensure database is accessible
 */
export async function testConnection(): Promise<void> {
  try {
    const connection = await pool.getConnection();
    await ensureSessionTimezone(connection);
    console.log("✓ Database connected successfully to:", process.env.DB_NAME);
    connection.release();
  } catch (error) {
    console.error("✗ Database connection failed:", error);
    throw error;
  }
}

/**
 * Execute a database query with automatic connection management
 *
 * @param query SQL query string
 * @param params Query parameters for prepared statements
 * @returns Query results
 */
export async function query<T = any>(
  query: string,
  params?: any[],
): Promise<T> {
  try {
    const [results] = await pool.execute(query, params);
    return results as T;
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  }
}

/**
 * Get a connection from the pool for transactions
 * Remember to release the connection after use
 */
export async function getConnection() {
  const connection = await pool.getConnection();
  await ensureSessionTimezone(connection);
  return connection;
}

/**
 * Close all database connections
 * Called during graceful shutdown
 */
export async function closePool(): Promise<void> {
  try {
    await pool.end();
    if (process.env.NODE_ENV !== "test") {
      console.log("✓ Database connection pool closed");
    }
  } catch (error) {
    console.error("✗ Error closing database pool:", error);
    throw error;
  }
}

export default pool;
