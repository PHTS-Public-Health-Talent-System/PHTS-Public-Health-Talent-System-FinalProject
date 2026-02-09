import { Router } from "express";
import { protect } from '@middlewares/authMiddleware.js';
import * as signatureController from '@/modules/signature/signature.controller.js';

const router = Router();

router.use(protect);

// Read-only signature endpoints (sourced from HRMS/sig_images)
router.get("/my-signature", signatureController.getMySignature);
router.get("/check", signatureController.checkSignature);
router.post("/refresh", signatureController.refreshMySignature);

export default router;
