import { Router, Response, Request } from "express";
import { query } from '@config/database.js';
import redisClient from '@config/redis.js';
import { ApiResponse } from '@/types/auth.js';

const router = Router();

router.get("/", (_req: Request, res: Response<ApiResponse>) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).json({
    success: true,
    message: "PHTS API root",
    data: {
      timestamp: new Date().toISOString(),
    },
  });
});

router.get("/robots.txt", (_req: Request, res: Response) => {
  const body = "User-agent: *\nDisallow:";
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).send(body);
});

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

router.get("/sitemap.xml", (_req: Request, res: Response) => {
  const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || "3001"}`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/health</loc>
  </url>
  <url>
    <loc>${baseUrl}/ready</loc>
  </url>
</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).send(xml);
});

export default router;
