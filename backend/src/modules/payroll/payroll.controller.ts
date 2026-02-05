import { Request, Response } from "express";
import { PayrollService } from '@/modules/payroll/payroll.service.js';
import { ApiResponse } from '@/types/auth.js';
import type {
  CreatePeriodDto,
  CalculatePeriodDto,
  CreateLeavePayExceptionDto,
  CreateLeaveReturnReportDto,
} from '@/modules/payroll/dto/index.js';
import { buildPeriodReport } from '@/modules/payroll/report/payroll-report.service.js';

export const getPeriodStatus = async (req: Request, res: Response) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      res.status(400).json({ message: "Year and month are required" });
      return;
    }

    const period = await PayrollService.getOrCreatePeriod(
      Number(year),
      Number(month),
    );
    res.json(period);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const listPeriods = async (_req: Request, res: Response) => {
  try {
    const periods = await PayrollService.getAllPeriods();
    res.json({ success: true, data: periods });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getPeriodDetail = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const { periodId } = req.params;
    const detail = await PayrollService.getPeriodDetail(Number(periodId));
    res.json({ success: true, data: detail });
  } catch (error: any) {
    const message = error.message || "เกิดข้อผิดพลาดในการโหลดงวด";
    if (message === "Period not found") {
      res.status(404).json({ success: false, error: message });
      return;
    }
    res.status(500).json({ success: false, error: message });
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

    const period = await PayrollService.getOrCreatePeriod(yearNum, monthNum);

    res.status(201).json({
      success: true,
      data: period,
      message: `งวดเดือน ${monthNum}/${yearNum} พร้อมใช้งาน`,
    });
  } catch (error: any) {
    console.error("Create period error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "เกิดข้อผิดพลาดในการสร้างงวดเดือน",
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
    const payouts = await PayrollService.getPeriodPayouts(Number(periodId));
    res.json({ success: true, data: payouts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    if (message === "Period not calculated") {
      res.status(400).json({ success: false, error: message });
      return;
    }
    res.status(500).json({ success: false, error: message });
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
    res.status(500).json({ message: error.message });
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
      const period = await PayrollService.getOrCreatePeriod(
        Number(year),
        Number(month),
      );
      const result = await PayrollService.processPeriodCalculation(
        Number(period.period_id),
      );
      res.json({ success: true, data: result });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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

    const period = await PayrollService.getOrCreatePeriod(
      Number(year),
      Number(month),
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
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
    });
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getPeriodReport = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const buffer = await buildPeriodReport(Number(periodId));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="period-${periodId}-report.pdf"`,
    );
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================================
// Leave Pay Exceptions & Return Reports (PTS_OFFICER)
// ============================================================================

export const createLeavePayException = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
    const { citizen_id, start_date, end_date, reason } =
      req.body as CreateLeavePayExceptionDto;

    const result = await PayrollService.createLeavePayException(
      citizen_id,
      start_date,
      end_date,
      reason ?? null,
      actorId,
    );

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const listLeavePayExceptions = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const citizenId =
      typeof req.query.citizen_id === "string"
        ? req.query.citizen_id
        : undefined;
    const rows = await PayrollService.listLeavePayExceptions(citizenId);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteLeavePayException = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const id = Number(req.params.id);
    const deleted = await PayrollService.deleteLeavePayException(id);
    res.json({ success: true, data: { deleted } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createLeaveReturnReport = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;
    const { leave_record_id, return_date, remark } =
      req.body as CreateLeaveReturnReportDto;

    const result = await PayrollService.createLeaveReturnReport(
      leave_record_id,
      return_date,
      remark ?? null,
      actorId,
    );

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const listLeaveReturnReports = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const citizenId =
      typeof req.query.citizen_id === "string"
        ? req.query.citizen_id
        : undefined;
    const leaveRecordId = req.query.leave_record_id
      ? Number(req.query.leave_record_id)
      : undefined;

    const rows = await PayrollService.listLeaveReturnReports({
      citizenId,
      leaveRecordId,
    });
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteLeaveReturnReport = async (
  req: Request,
  res: Response<ApiResponse>,
) => {
  try {
    const id = Number(req.params.id);
    const deleted = await PayrollService.deleteLeaveReturnReport(id);
    res.json({ success: true, data: { deleted } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
