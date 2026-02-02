/**
 * PHTS System - Main Server Entry Point
 *
 * Express server with authentication, CORS, and security middleware
 *
 * Date: 2025-12-30
 */

import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { loadEnv } from "./config/env.js";
import { testConnection, closePool } from "./config/database.js";
import { initializePassport } from "./config/passport.js";
import authRoutes from "./modules/auth/auth.routes.js";
import requestRoutes from "./modules/request/request.routes.js";
import signatureRoutes from "./modules/signature/signature.routes.js";
import payrollRoutes from "./modules/payroll/payroll.routes.js";
import reportRoutes from "./modules/report/report.routes.js";
import systemRoutes from "./modules/system/system.routes.js";
import masterDataRoutes from "./modules/master-data/master-data.routes.js";
import notificationRoutes from "./modules/notification/notification.routes.js";
import financeRoutes from "./modules/finance/finance.routes.js";
// Phase 6: Compliance & Quality
import auditRoutes from "./modules/audit/audit.routes.js";
import slaRoutes from "./modules/sla/sla.routes.js";
import accessReviewRoutes from "./modules/access-review/access-review.routes.js";
import dataQualityRoutes from "./modules/data-quality/data-quality.routes.js";
import snapshotRoutes from "./modules/snapshot/snapshot.routes.js";
import licenseAlertsRoutes from "./modules/license-alerts/license-alerts.routes.js";
import { ApiResponse } from "./types/auth.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { apiRateLimiter } from "./middlewares/rateLimiter.js";

// Load environment variables
loadEnv();

// Initialize Express app
const app: Application = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";

/**
 * Security Middleware
 */
app.use(helmet());

// Allow CORS for configured origins (comma-separated env support for multiple frontends)
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      const isAllowed =
        !origin ||
        allowedOrigins.some(
          (allowed) => origin === allowed || origin.startsWith(`${allowed}/`),
        );

      if (isAllowed) {
        return callback(null, true);
      }

      console.warn(`[CORS] Blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

/**
 * Body Parser Middleware
 */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/**
 * Logging Middleware
 * Use 'combined' format in production, 'dev' format in development
 */
if (NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

/**
 * Static Files Middleware
 * Serve uploaded files from /uploads route with CORS headers
 */
import path from "path";
app.use(
  "/uploads",
  (_req, res, next) => {
    // Add CORS headers for static files
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(process.cwd(), "uploads")),
);

/**
 * Initialize Passport for JWT authentication
 */
app.use(initializePassport());

/**
 * Health Check Route
 */
app.get("/health", (_req: Request, res: Response<ApiResponse>) => {
  res.status(200).json({
    success: true,
    message: "PHTS API is running",
    data: {
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      port: PORT,
    },
  });
});

/**
 * API Routes
 */
app.use("/api", apiRateLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/signatures", signatureRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/config", masterDataRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/finance", financeRoutes);
// Phase 6: Compliance & Quality Routes
app.use("/api/audit", auditRoutes);
app.use("/api/sla", slaRoutes);
app.use("/api/access-review", accessReviewRoutes);
app.use("/api/data-quality", dataQualityRoutes);
app.use("/api/snapshots", snapshotRoutes);
app.use("/api/license-alerts", licenseAlertsRoutes);

/**
 * 404 Handler - Route Not Found
 */
app.use(notFoundHandler);

/**
 * Global Error Handler
 * Catches all errors thrown in the application
 */
app.use(errorHandler);

/**
 * Graceful Shutdown
 * Close database connections before exiting
 */
async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  try {
    await closePool();
    console.log("Server shut down successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
}

// Handle process termination signals
if (process.env.NODE_ENV !== "test") {
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle uncaught exceptions
  process.on("uncaughtException", (error: Error) => {
    console.error("Uncaught Exception:", error);
    gracefulShutdown("uncaughtException");
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    gracefulShutdown("unhandledRejection");
  });
}

// Start the server
if (process.env.NODE_ENV !== "test" && process.env.START_SERVER !== "false") {
  try {
    // Verify database connectivity
    console.log("[Server] Verifying database connection...");
    await testConnection();

    // Start Express server
    app.listen(PORT, () => {
      console.log(
        `[Server] PHTS Backend started on port ${PORT} (${process.env.NODE_ENV})`,
      );
      console.log(
        `[Server] Database host: ${process.env.DB_HOST || "localhost"}`,
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

export default app;
