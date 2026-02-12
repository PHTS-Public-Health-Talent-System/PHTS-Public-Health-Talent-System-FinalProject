import { Request, Response } from "express";
import { ApiResponse } from '@/types/auth.js';
import {
  AlertBucket,
  getLicenseAlertList,
  notifyLicenseAlerts,
  getLicenseAlertSummary,
} from '@/modules/alerts/services/license-alerts.service.js';

const VALID_BUCKETS: AlertBucket[] = ["expired", "30", "60", "90"];

export const getLicenseSummary = async (
  _req: Request,
  res: Response<ApiResponse>,
) => {
  const data = await getLicenseAlertSummary();
  res.json({ success: true, data });
};

export const getLicenseList = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  const bucket = req.query.bucket as AlertBucket | undefined;
  if (!bucket || !VALID_BUCKETS.includes(bucket)) {
    res.status(400).json({ success: false, error: "Invalid bucket parameter" });
    return;
  }
  const data = await getLicenseAlertList(bucket);
  res.json({ success: true, data });
};

export const postLicenseNotify = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  const body = req.body as { items: Array<{ citizen_id: string; bucket: AlertBucket }> };
  const data = await notifyLicenseAlerts(body.items ?? []);
  res.json({ success: true, data });
};
