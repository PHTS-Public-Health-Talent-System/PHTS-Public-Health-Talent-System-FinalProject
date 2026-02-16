import { Router, Response, Request } from "express";
import { query } from '@config/database.js';
import redisClient from '@config/redis.js';
import { ApiResponse } from '@/types/auth.js';

const router = Router();

router.get("/health", (_req: Request, res: Response<ApiResponse>) => {
  res.status(200).json({
    success: true,
    message: "PHTS API is running",
    data: {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || null,
    },
  });
});

router.get("/ready", async (_req: Request, res: Response<ApiResponse>) => {
  try {
    await query("SELECT 1");
    await redisClient.set("health:ping", "1", "EX", 5);
    res.status(200).json({
      success: true,
      message: "PHTS API is ready",
      data: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    res.status(503).json({
      success: false,
      error: "DEPENDENCY_UNAVAILABLE",
      message: error?.message || "Service dependencies not ready",
    });
  }
});

export default router;
