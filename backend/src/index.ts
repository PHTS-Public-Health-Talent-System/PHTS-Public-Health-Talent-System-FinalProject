/**
 * PHTS System - Main Server Entry Point
 *
 * Express server with authentication, CORS, and security middleware
 *
 * Date: 2025-12-30
 */

import express, { Application } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { loadEnv } from '@config/env.js';
import { testConnection, closePool } from '@config/database.js';
import { initializePassport } from '@config/passport.js';
import { getJwtSecret } from '@config/jwt.js';
import authRoutes from '@/modules/auth/auth.routes.js';
import requestRoutes from '@/modules/request/request.routes.js';
import signatureRoutes from '@/modules/signature/signature.routes.js';
import payrollRoutes from '@/modules/payroll/payroll.routes.js';
import reportRoutes from '@/modules/report/report.routes.js';
import systemRoutes from '@/modules/system/system.routes.js';
import masterDataRoutes from '@/modules/master-data/master-data.routes.js';
import leaveRecordsRoutes from '@/modules/leave-records/leave-records.routes.js';
import notificationRoutes from '@/modules/notification/notification.routes.js';
import financeRoutes from '@/modules/finance/finance.routes.js';
// Phase 6: Compliance & Quality
import auditRoutes from '@/modules/audit/audit.routes.js';
import slaRoutes from '@/modules/sla/sla.routes.js';
import accessReviewRoutes from '@/modules/access-review/access-review.routes.js';
import snapshotRoutes from '@/modules/snapshot/snapshot.routes.js';
import alertsRoutes from '@/modules/alerts/alerts.routes.js';
import healthRoutes from '@/modules/health/health.routes.js';
import announcementRoutes from '@/modules/announcement/announcement.routes.js';
import supportRoutes from '@/modules/support/support.routes.js';
import dashboardRoutes from '@/modules/dashboard/dashboard.routes.js';
import navigationRoutes from '@/modules/navigation/navigation.routes.js';
import {
  startOcrPrecheckWorker,
  stopOcrPrecheckWorker,
} from '@/modules/request/services/ocr-precheck.service.js';
import { isMaintenanceModeEnabled } from '@/modules/system/services/maintenance.service.js';
import { errorHandler, notFoundHandler } from '@middlewares/errorHandler.js';
import { apiRateLimiter } from '@middlewares/rateLimiter.js';
import { protect } from '@middlewares/authMiddleware.js';
import { tokenBlacklistMiddleware } from '@middlewares/tokenBlacklistMiddleware.js';
import { authorizeUploadAccess } from '@middlewares/uploadAccessMiddleware.js';

// Load environment variables
loadEnv();

// Initialize Express app
const app: Application = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Allow CORS for configured origins (comma-separated env support for multiple frontends)
const envOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const defaultOrigins = ['http://localhost:3000'];
const allowedOrigins = [...new Set([...envOrigins, ...defaultOrigins])];

/**
 * Security Middleware
 */
app.use(
  helmet({
    frameguard: false,
    crossOriginEmbedderPolicy: true,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        frameAncestors: ["'self'", ...allowedOrigins],
      },
    },
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      const isAllowed =
        !origin ||
        allowedOrigins.some((allowed) => origin === allowed || origin.startsWith(`${allowed}/`));

      if (isAllowed) {
        return callback(null, true);
      }

      console.warn(`[CORS] Blocked origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Allow common cache headers so browser/devtools "Disable cache" and other clients
    // don't fail CORS preflight unexpectedly.
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cache-Control',
      'Pragma',
      'If-Modified-Since',
      'If-None-Match',
      'X-Requested-With',
      'X-Request-Id',
    ],
  }),
);

/**
 * Body Parser Middleware
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Disable caching for dynamic API responses to reduce data leak risk via shared caches.
 */
app.use((req, res, next) => {
  const cacheablePublicPaths = new Set(['/sitemap.xml']);
  if (!req.path.startsWith('/uploads') && !cacheablePublicPaths.has(req.path)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

/**
 * Request ID Middleware
 */
app.use((req, res, next) => {
  const incomingId = req.headers['x-request-id'];
  const requestId =
    typeof incomingId === 'string' && incomingId.trim() ? incomingId : crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

/**
 * Logging Middleware
 * Use 'combined' format in production, 'dev' format in development
 */
if (NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

/**
 * Initialize Passport for JWT authentication
 */
app.use(initializePassport());

/**
 * Static Files Middleware
 * Serve uploaded files from /uploads route with CORS headers
 */
import path from 'path';
app.use(
  '/uploads',
  tokenBlacklistMiddleware,
  protect,
  authorizeUploadAccess,
  (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
  },
  express.static(path.join(process.cwd(), 'uploads')),
);

/**
 * Health/Readiness Routes
 */
app.use('/', healthRoutes);

/**
 * Maintenance Mode Middleware
 */
app.use(async (req, res, next) => {
  const maintenanceEnabled = await isMaintenanceModeEnabled();
  if (!maintenanceEnabled) return next();

  const allowPaths = ['/health', '/ready', '/api/system/maintenance', '/api/auth/login'];
  if (allowPaths.some((path) => req.path.startsWith(path))) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const token =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null;

  if (token) {
    try {
      const jwtSecret = getJwtSecret();
      const payload = jwt.verify(token, jwtSecret) as { role?: string };
      if (payload?.role === 'ADMIN') {
        return next();
      }
    } catch {
      // Ignore invalid token and continue to maintenance response
    }
  }

  return res.status(503).json({
    success: false,
    error: 'MAINTENANCE_MODE',
    message: 'Service is temporarily unavailable due to maintenance',
  });
});

/**
 * API Routes
 */
app.use('/api', tokenBlacklistMiddleware, apiRateLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/signatures', signatureRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/config', masterDataRoutes);
app.use('/api/leave-records', leaveRecordsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/finance', financeRoutes);
// Phase 6: Compliance & Quality Routes
app.use('/api/audit', auditRoutes);
app.use('/api/sla', slaRoutes);
app.use('/api/access-review', accessReviewRoutes);
app.use('/api/snapshots', snapshotRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/navigation', navigationRoutes);

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
    await stopOcrPrecheckWorker();
    await closePool();
    console.log('Server shut down successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle process termination signals
if (process.env.NODE_ENV !== 'test') {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
}

// Start the server
if (process.env.NODE_ENV !== 'test' && process.env.START_SERVER !== 'false') {
  try {
    // Verify database connectivity
    console.log('[Server] Verifying database connection...');
    await testConnection();
    startOcrPrecheckWorker();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`[Server] PHTS Backend started on port ${PORT} (${process.env.NODE_ENV})`);
      console.log(`[Server] Database host: ${process.env.DB_HOST || 'localhost'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}
// Trigger reload
export default app;
