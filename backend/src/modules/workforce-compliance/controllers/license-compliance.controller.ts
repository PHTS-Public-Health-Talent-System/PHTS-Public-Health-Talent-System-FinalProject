/**
 * license-compliance module - request orchestration
 *
 */
import { Request, Response } from "express";
import { ApiResponse } from "@/types/auth.js";
import { asyncHandler } from "@middlewares/errorHandler.js";
import {
  AlertBucket,
  getLicenseComplianceList,
  notifyLicenseCompliance,
  getLicenseComplianceSummary,
} from "@/modules/workforce-compliance/services/license-compliance.service.js";

const VALID_BUCKETS: AlertBucket[] = ["expired", "30", "60", "90"];

export const getLicenseSummary = asyncHandler(async (
  _req: Request,
  res: Response<ApiResponse>,
) => {
  const data = await getLicenseComplianceSummary();
  res.json({ success: true, data });
});

export const getLicenseList = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  const bucket = req.query.bucket as AlertBucket | undefined;
  if (!bucket || !VALID_BUCKETS.includes(bucket)) {
    res.status(400).json({ success: false, error: "Invalid bucket parameter" });
    return;
  }
  const data = await getLicenseComplianceList(bucket);
  res.json({ success: true, data });
});

export const postLicenseNotify = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  const body = req.body as {
    items: Array<{ citizen_id: string; bucket: AlertBucket }>;
  };
  const data = await notifyLicenseCompliance(body.items ?? []);
  res.json({ success: true, data });
});
