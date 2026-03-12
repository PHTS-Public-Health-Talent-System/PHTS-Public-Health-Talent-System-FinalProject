/**
 * report module - request orchestration
 *
 */
import { Request, Response } from "express";
import { asyncHandler } from "@middlewares/errorHandler.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@shared/utils/errors.js";
import * as reportService from "@/modules/report/services/report.service.js";

function mapReportError(error: unknown): Error {
  const message = (error as Error)?.message || "Failed to generate report";

  if (message.includes("Period not found")) {
    return new NotFoundError("period");
  }

  if (
    message.includes("SNAPSHOT_NOT_READY") ||
    message.includes("Report is available only for closed periods") ||
    message.includes("Report requires frozen snapshot") ||
    message.includes("Snapshot not found for frozen period") ||
    message.includes("Summary snapshot not found for frozen period")
  ) {
    return new ConflictError(message);
  }

  return error instanceof Error ? error : new Error(message);
}

export const downloadDetailReport = asyncHandler(async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const profession = req.query.profession as string | undefined;
    const groupNo = req.query.groupNo ? Number(req.query.groupNo) : undefined;
    const format = String(req.query.format ?? "xlsx").toLowerCase();

    if (!year || !month) {
      throw new ValidationError("Year and month are required");
    }

    const isCsv = format === "csv";
    const buffer = isCsv
      ? await reportService.generateDetailReportCsv({
          year,
          month,
          professionCode: profession,
          groupNo,
        })
      : await reportService.generateDetailReport({
          year,
          month,
          professionCode: profession,
          groupNo,
        });
    const filename = `PTS_Detail_${profession || "ALL"}_${year}_${month}.${isCsv ? "csv" : "xlsx"}`;

    res.setHeader(
      "Content-Type",
      isCsv
        ? "text/csv; charset=utf-8"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.send(buffer);
  } catch (error) {
    throw mapReportError(error);
  }
});

export const downloadSummaryReport = asyncHandler(async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const format = String(req.query.format ?? "xlsx").toLowerCase();

    if (!year || !month) {
      throw new ValidationError("Year and month are required");
    }

    const isCsv = format === "csv";
    const buffer = isCsv
      ? await reportService.generateSummaryReportCsv(year, month)
      : await reportService.generateSummaryReport(year, month);
    const filename = `PTS_Summary_${year}_${month}.${isCsv ? "csv" : "xlsx"}`;

    res.setHeader(
      "Content-Type",
      isCsv
        ? "text/csv; charset=utf-8"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.send(buffer);
  } catch (error) {
    throw mapReportError(error);
  }
});
