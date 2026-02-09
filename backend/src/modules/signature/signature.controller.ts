import { Request, Response } from "express";
import { ApiResponse } from '@/types/auth.js';
import * as signatureService from '@/modules/signature/services/signature.service.js';
import { SyncService } from '@/modules/system/services/syncService.js';

const refreshState = new Map<number, { lastAt: number; pending: boolean }>();

export const getMySignature = async (
  req: Request,
  res: Response<ApiResponse<{ data_url: string }>>,
) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    if (!req.user.citizenId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    const dataUrl = await signatureService.getSignatureBase64(req.user.citizenId);
    res.json({ success: true, data: { data_url: dataUrl ?? "" } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const checkSignature = async (
  req: Request,
  res: Response<ApiResponse<{ has_signature: boolean }>>,
) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    if (!req.user.citizenId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    const hasSig = await signatureService.hasSignature(req.user.citizenId);
    res.json({ success: true, data: { has_signature: hasSig } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const refreshMySignature = async (
  req: Request,
  res: Response<ApiResponse<{ queued: boolean; delay_ms: number }>>,
) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    const delayMs = Number(process.env.SIGNATURE_REFRESH_DELAY_MS ?? 1500);
    const cooldownMs = Number(process.env.SIGNATURE_REFRESH_COOLDOWN_MS ?? 5000);
    const userId = req.user.userId;
    const now = Date.now();
    const existing = refreshState.get(userId);
    if (existing && now - existing.lastAt < cooldownMs) {
      const retryAfterMs = Math.max(0, cooldownMs - (now - existing.lastAt));
      res.status(429).json({
        success: false,
        error: "กรุณารอสักครู่ก่อนรีเฟรชอีกครั้ง",
        data: { retry_after_ms: retryAfterMs },
      } as ApiResponse<any>);
      return;
    }

    refreshState.set(userId, { lastAt: now, pending: true });
    setTimeout(() => {
      SyncService.performUserSync(userId).catch((error) => {
        console.error('[Signature] User sync failed:', error);
      }).finally(() => {
        const state = refreshState.get(userId);
        if (state && state.lastAt === now) {
          refreshState.set(userId, { lastAt: state.lastAt, pending: false });
        }
      });
    }, delayMs);

    res.json({ success: true, data: { queued: true, delay_ms: delayMs } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
