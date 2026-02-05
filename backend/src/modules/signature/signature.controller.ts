import { Request, Response } from "express";
import { ApiResponse } from '@types/auth.js';
import * as signatureService from '@/modules/signature/services/signature.service.js';

export const getMySignature = async (
  req: Request,
  res: Response<ApiResponse<{ data_url: string }>>,
) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    const dataUrl = await signatureService.getSignatureBase64(req.user.userId);
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
    const hasSig = await signatureService.hasSignature(req.user.userId);
    res.json({ success: true, data: { has_signature: hasSig } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
