import { Request, Response } from "express";
import { catchAsync } from "@shared/utils/errors.js";
import type { ApiResponse } from "@/types/auth.js";
import {
  ensureReady,
  getHealthPayload,
  getRootPayload,
  getSitemapXml,
} from "@/modules/health/services/health.service.js";

export const getRoot = (_req: Request, res: Response<ApiResponse>) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).json(getRootPayload());
};

export const getRobots = (_req: Request, res: Response) => {
  const body = "User-agent: *\nDisallow:";
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.status(200).send(body);
};

export const getHealth = (_req: Request, res: Response<ApiResponse>) =>
  res.status(200).json(getHealthPayload());

export const getReady = catchAsync(
  async (_req: Request, res: Response<ApiResponse>) => {
    try {
      const payload = await ensureReady();
      return res.status(200).json(payload);
    } catch (error: any) {
      return res.status(503).json({
        success: false,
        error: "DEPENDENCY_UNAVAILABLE",
        message: error?.message || "Service dependencies not ready",
      });
    }
  },
);

export const getSitemap = (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.status(200).send(getSitemapXml());
};
