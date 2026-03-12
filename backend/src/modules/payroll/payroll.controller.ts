/**
 * payroll module - request orchestration
 *
 */
import { Request, Response } from "express";
import { LeaveManagementPeriodQuery } from "@/modules/leave-management/repositories/leave-management.repository.js";
import { PayrollService } from "@/modules/payroll/services/facade/payroll.service.js";
import { emitAuditEventWithRequest } from "@/modules/audit/services/audit.service.js";
import { AuditEventType } from "@/modules/audit/entities/audit.entity.js";
import { ApiResponse } from "@/types/auth.js";
import type {
  CreatePeriodDto,
  CalculatePeriodDto,
} from "@/modules/payroll/dto/index.js";

const INTERNAL_ERROR_MESSAGE = "เกิดข้อผิดพลาดภายในระบบ";

const getCurrentRole = (req: Request): string | null => {
  return ((req.user as any)?.role as string | undefined) ?? null;
};

export const getPeriodStatus = async (req: Request, res: Response) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      res.status(400).json({ message: "Year and month are required" });
      return;
    }

    const yearNum = Number(year);
    const monthNum = Number(month);
    const existing = await PayrollService.getPeriodByMonthYear(
      yearNum,
      monthNum,
    );
    if (!existing) {
      res.status(404).json({ message: "Period not found" });
      return;
    }
    res.json(existing);
  } catch (error: any) {
    res.status(500).json({ message: INTERNAL_ERROR_MESSAGE });
  }
};

export const listPeriods = async (req: Request, res: Response) => {
  try {
    const periods = await PayrollService.getAllPeriods(getCurrentRole(req));
    res.json({ success: true, data: periods });
  } catch (_error: any) {
    res.status(500).json({ success: false, error: INTERNAL_ERROR_MESSAGE });
  }
};

export const getPeriodDetail = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const { periodId } = req.params;
    const detail = await PayrollService.getPeriodDetail(
      Number(periodId),
      getCurrentRole(req),
    );
    res.json({ success: true, data: detail });
  } catch (error: any) {
    const message = error.message || "เกิดข้อผิดพลาดในการโหลดงวด";
    if (message === "Period not found") {
      res.status(404).json({ success: false, error: message });
      return;
    }
    if (message === "Forbidden period access") {
      res
        .status(403)
        .json({
          success: false,
          error: "You do not have permission to view this period",
        });
      return;
    }
    res.status(500).json({ success: false, error: INTERNAL_ERROR_MESSAGE });
  }
};

export const addPeriodItems = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const { periodId } = req.params;
    const { request_ids } = req.body as { request_ids: number[] };
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
    await PayrollService.addPeriodItems(Number(periodId), request_ids, actorId);
    res.json({ success: true });
  } catch (error: any) {
    const message = error.message || "เกิดข้อผิดพลาดในการเพิ่มรายการงวด";
    if (error?.missingRequestIds) {
      res.status(400).json({
        success: false,
        error: "มีคำขอที่ยังไม่ผ่านการยืนยันผลตรวจ",
        data: { missing_request_ids: error.missingRequestIds },
      });
      return;
    }
    if (message === "Period not found") {
      res.status(404).json({ success: false, error: message });
      return;
    }
    res.status(400).json({ success: false, error: message });
  }
};

export const removePeriodItem = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const { periodId, itemId } = req.params;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
    await PayrollService.removePeriodItem(
      Number(periodId),
      Number(itemId),
      actorId,
    );
    res.json({ success: true });
  } catch (error: any) {
    const message = error.message || "เกิดข้อผิดพลาดในการลบรายการงวด";
    if (message === "Period not found") {
      res.status(404).json({ success: false, error: message });
      return;
    }
    res.status(400).json({ success: false, error: message });
  }
};

/**
 * Create a new period (or return existing one)
 *
 * @route POST /api/payroll/period
 * @access Protected (PTS_OFFICER, ADMIN)
 */
export const createPeriod = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const { year, month } = req.body as CreatePeriodDto;

    // Validation handled by Zod middleware

    const yearNum = Number(year);
    const monthNum = Number(month);

    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    const period = await PayrollService.getOrCreatePeriod(
      yearNum,
      monthNum,
      actorId,
    );

    res.status(201).json({
      success: true,
      data: period,
      message: `งวดเดือน ${monthNum}/${yearNum} พร้อมใช้งาน`,
    });
  } catch (error: any) {
    console.error("Create period error:", error);
    res.status(500).json({
      success: false,
      error: INTERNAL_ERROR_MESSAGE,
    });
  }
};

export const getPeriodPayouts = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    if (!periodId) {
      res.status(400).json({ message: "periodId is required" });
      return;
    }
    await PayrollService.ensurePeriodVisibleForRole(
      Number(periodId),
      getCurrentRole(req),
    );
    const payouts = await PayrollService.getPeriodPayouts(Number(periodId));
    res.json({ success: true, data: payouts });
  } catch (error: any) {
    if (error?.message === "Period not found") {
      res.status(404).json({ success: false, error: "Period not found" });
      return;
    }
    if (error?.message === "Forbidden period access") {
      res
        .status(403)
        .json({
          success: false,
          error: "You do not have permission to view this period",
        });
      return;
    }
    res.status(500).json({ success: false, error: INTERNAL_ERROR_MESSAGE });
  }
};

export const getPeriodLeaves = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    if (!periodId) {
      res.status(400).json({ success: false, error: "periodId is required" });
      return;
    }
    await PayrollService.ensurePeriodVisibleForRole(
      Number(periodId),
      getCurrentRole(req),
    );
    const params = req.query as {
      leave_type?: LeaveManagementPeriodQuery["leave_type"];
      profession_code?: string;
      pending_report?: boolean;
      search?: string;
      limit?: number;
      offset?: number;
      sort_by?: "start_date" | "name";
      sort_dir?: "asc" | "desc";
    };
    const result = await PayrollService.getPeriodLeaves(Number(periodId), params);
    res.json({ success: true, data: result.items, meta: result });
  } catch (error: any) {
    if (error?.message === "Period not found") {
      res.status(404).json({ success: false, error: "Period not found" });
      return;
    }
    if (error?.message === "Forbidden period access") {
      res.status(403).json({
        success: false,
        error: "You do not have permission to view this period",
      });
      return;
    }
    res.status(500).json({ success: false, error: INTERNAL_ERROR_MESSAGE });
  }
};

export const getPeriodLeaveProfessionSummary = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    if (!periodId) {
      res.status(400).json({ success: false, error: "periodId is required" });
      return;
    }
    await PayrollService.ensurePeriodVisibleForRole(
      Number(periodId),
      getCurrentRole(req),
    );
    const params = req.query as {
      leave_type?: LeaveManagementPeriodQuery["leave_type"];
      pending_report?: boolean;
      search?: string;
    };
    const rows = await PayrollService.getPeriodLeaveProfessionSummary(Number(periodId), params);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    if (error?.message === "Period not found") {
      res.status(404).json({ success: false, error: "Period not found" });
      return;
    }
    if (error?.message === "Forbidden period access") {
      res.status(403).json({
        success: false,
        error: "You do not have permission to view this period",
      });
      return;
    }
    res.status(500).json({ success: false, error: INTERNAL_ERROR_MESSAGE });
  }
};

export const getPayoutDetail = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const { payoutId } = req.params as { payoutId?: string };
    if (!payoutId) {
      res.status(400).json({ success: false, error: "payoutId is required" });
      return;
    }
    const data = await PayrollService.getPayoutDetail(
      Number(payoutId),
      getCurrentRole(req),
    );
    res.json({ success: true, data });
  } catch (error: any) {
    const message =
      error?.message || "เกิดข้อผิดพลาดในการโหลดรายละเอียดรายการจ่าย";
    if (message === "Payout not found") {
      res.status(404).json({ success: false, error: message });
      return;
    }
    if (message === "Forbidden period access") {
      res.status(403).json({
        success: false,
        error: "You do not have permission to view this period",
      });
      return;
    }
    res.status(500).json({ success: false, error: INTERNAL_ERROR_MESSAGE });
  }
};

export const updatePayout = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const { payoutId } = req.params as { payoutId?: string };
    if (!payoutId) {
      res.status(400).json({ success: false, error: "payoutId is required" });
      return;
    }

    const reqWithUser = req as Request & {
      user?: { id?: number | string; userId?: number | string };
    };
    const actorId =
      reqWithUser.user?.id ?? reqWithUser.user?.userId ?? null;

    const payload = req.body as {
      eligible_days?: number;
      deducted_days?: number;
      retroactive_amount?: number;
      remark?: string | null;
    };

    const data = await PayrollService.updatePayout(Number(payoutId), payload, {
      actorId: actorId ? Number(actorId) : null,
    });

    await emitAuditEventWithRequest(req, {
      eventType: AuditEventType.PAYOUT_UPDATE,
      entityType: "payout",
      entityId: Number(payoutId),
      actionDetail: {
        eligible_days: payload.eligible_days ?? null,
        deducted_days: payload.deducted_days ?? null,
        retroactive_amount: payload.retroactive_amount ?? null,
        remark: payload.remark ?? null,
        period_id: data?.period_id ?? null,
      },
    });

    res.json({ success: true, data });
  } catch (error: any) {
    const message = error?.message || "เกิดข้อผิดพลาดในการแก้ไขรายการจ่าย";
    if (message === "Payout not found") {
      res.status(404).json({ success: false, error: message });
      return;
    }
    res.status(400).json({ success: false, error: message });
  }
};

export const getPeriodSummaryByProfession = async (
  req: Request,
  res: Response,
) => {
  try {
    const { periodId } = req.params;
    if (!periodId) {
      res.status(400).json({ message: "periodId is required" });
      return;
    }

    await PayrollService.ensurePeriodVisibleForRole(
      Number(periodId),
      getCurrentRole(req),
    );
    const summary = await PayrollService.getPeriodSummaryByProfession(
      Number(periodId),
    );
    res.json({ success: true, data: summary });
  } catch (error: any) {
    const message = error.message || "เกิดข้อผิดพลาดในการสรุปข้อมูล";
    if (message === "Period not found") {
      res.status(404).json({ success: false, error: message });
      return;
    }
    if (message === "Forbidden period access") {
      res
        .status(403)
        .json({
          success: false,
          error: "You do not have permission to view this period",
        });
      return;
    }
    if (message === "Period not calculated") {
      res.status(400).json({ success: false, error: message });
      return;
    }
    res.status(500).json({ success: false, error: INTERNAL_ERROR_MESSAGE });
  }
};

export const calculatePeriod = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const result = await PayrollService.processPeriodCalculation(
      Number(periodId),
    );
    res.json({ message: "Calculation completed successfully", data: result });
  } catch (error: any) {
    res.status(500).json({ message: INTERNAL_ERROR_MESSAGE });
  }
};

export const calculatePayroll = async (req: Request, res: Response) => {
  try {
    const { year, month, citizen_id } = req.body;
    // Logic for payroll calculation (similar to onDemand or period based)
    // For now, reuse onDemand logic or period logic based on inputs
    if (citizen_id) {
      const data = await PayrollService.calculateOnDemand(
        Number(year),
        Number(month),
        String(citizen_id),
      );
      res.json({ success: true, data });
    } else {
      const actorId =
        (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
      const period = await PayrollService.getOrCreatePeriod(
        Number(year),
        Number(month),
        actorId,
      );
      const result = await PayrollService.processPeriodCalculation(
        Number(period.period_id),
      );
      res.json({ success: true, data: result });
    }
  } catch (_error: any) {
    res.status(500).json({ success: false, error: INTERNAL_ERROR_MESSAGE });
  }
};

export const calculateOnDemand = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const { year, month, citizen_id } = req.body as CalculatePeriodDto;

    // Validation handled by Zod

    if (citizen_id) {
      const data = await PayrollService.calculateOnDemand(
        Number(year),
        Number(month),
        String(citizen_id),
      );
      res.json({ success: true, data });
      return;
    }

    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    const period = await PayrollService.getOrCreatePeriod(
      Number(year),
      Number(month),
      actorId,
    );
    const result = await PayrollService.processPeriodCalculation(
      Number(period.period_id),
    );
    res.json({
      success: true,
      data: {
        period_id: period.period_id,
        ...result,
      },
    });
  } catch (_error: any) {
    res.status(500).json({ success: false, error: INTERNAL_ERROR_MESSAGE });
  }
};

export const submitToHR = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;

    const result = await PayrollService.updatePeriodStatus(
      Number(periodId),
      "SUBMIT",
      actorId,
    );
    res.json(result);
  } catch (error: any) {
    if (error?.missingProfessionCodes) {
      res.status(400).json({
        success: false,
        error: error.message || "ยังตรวจไม่ครบทุกวิชาชีพก่อนส่งให้ HR",
        data: {
          missing_profession_codes: error.missingProfessionCodes,
        },
      });
      return;
    }
    const message = error?.message || "เกิดข้อผิดพลาดในการส่งให้ HR";
    if (
      message === "ยังไม่มีข้อมูลการคำนวณสำหรับรอบนี้" ||
      message.startsWith("Invalid action")
    ) {
      res.status(400).json({ success: false, error: message });
      return;
    }
    res.status(500).json({ success: false, error: INTERNAL_ERROR_MESSAGE });
  }
};

export const getPeriodReviewProgress = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const { periodId } = req.params;
    const data = await PayrollService.getPeriodReviewProgress(
      Number(periodId),
      getCurrentRole(req),
    );
    res.json({ success: true, data });
  } catch (error: any) {
    const message = error?.message || "เกิดข้อผิดพลาดในการโหลดความคืบหน้า";
    if (message === "Period not found") {
      res.status(404).json({ success: false, error: message });
      return;
    }
    if (message === "Forbidden period access") {
      res.status(403).json({ success: false, error: message });
      return;
    }
    res.status(500).json({ success: false, error: INTERNAL_ERROR_MESSAGE });
  }
};

export const setPeriodProfessionReview = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const { periodId } = req.params;
    const { profession_code, reviewed } = req.body as {
      profession_code: string;
      reviewed: boolean;
    };
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
    const data = await PayrollService.setPeriodProfessionReview(
      Number(periodId),
      profession_code,
      reviewed,
      actorId,
    );
    res.json({ success: true, data });
  } catch (error: any) {
    const message = error?.message || "เกิดข้อผิดพลาดในการบันทึกการยืนยันตรวจ";
    if (message === "Period not found") {
      res.status(404).json({ success: false, error: message });
      return;
    }
    if (
      message === "สามารถยืนยันตรวจได้เฉพาะรอบที่ยังเปิดอยู่" ||
      message === "profession_code is required" ||
      message === "วิชาชีพนี้ไม่มีในรอบการคำนวณปัจจุบัน"
    ) {
      res.status(400).json({ success: false, error: message });
      return;
    }
    res.status(500).json({ success: false, error: INTERNAL_ERROR_MESSAGE });
  }
};

export const approveByHR = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;

    const result = await PayrollService.updatePeriodStatus(
      Number(periodId),
      "APPROVE_HR",
      actorId,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: INTERNAL_ERROR_MESSAGE });
  }
};

export const approveByDirector = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;

    const result = await PayrollService.updatePeriodStatus(
      Number(periodId),
      "APPROVE_DIRECTOR",
      actorId,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: INTERNAL_ERROR_MESSAGE });
  }
};

export const approveByHeadFinance = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;

    const result = await PayrollService.updatePeriodStatus(
      Number(periodId),
      "APPROVE_HEAD_FINANCE",
      actorId,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: INTERNAL_ERROR_MESSAGE });
  }
};

export const rejectPeriod = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
    const { reason } = req.body as { reason: string };

    const result = await PayrollService.updatePeriodStatus(
      Number(periodId),
      "REJECT",
      actorId,
      reason,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: INTERNAL_ERROR_MESSAGE });
  }
};

export const searchPayouts = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      res.status(400).json({ success: false, error: "q is required" });
      return;
    }
    const periodYear = req.query.year ? Number(req.query.year) : undefined;
    const periodMonth = req.query.month ? Number(req.query.month) : undefined;
    const rows = await PayrollService.searchPayouts({
      q,
      periodYear,
      periodMonth,
      role: getCurrentRole(req),
    });
    res.json({ success: true, data: rows });
  } catch (_error: any) {
    res.status(500).json({ success: false, error: INTERNAL_ERROR_MESSAGE });
  }
};

export const deletePeriod = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const { periodId } = req.params;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
    if (!actorId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const data = await PayrollService.hardDeletePeriod(
      Number(periodId),
      Number(actorId),
    );
    res.json({ success: true, data });
  } catch (error: any) {
    const message = error?.message || "เกิดข้อผิดพลาดในการลบรอบ";
    if (message === "Period not found") {
      res.status(404).json({ success: false, error: message });
      return;
    }
    if (
      message.includes("สามารถลบรอบได้เฉพาะรอบที่ยังเปิดอยู่") ||
      message.includes("ไม่สามารถลบรอบได้:")
    ) {
      res.status(400).json({ success: false, error: message });
      return;
    }
    res.status(500).json({ success: false, error: INTERNAL_ERROR_MESSAGE });
  }
};
