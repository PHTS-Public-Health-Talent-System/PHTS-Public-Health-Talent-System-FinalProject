import { Request, Response } from "express";
import * as reportService from '@/modules/report/services/report.service.js';

function handleReportError(res: Response, error: unknown): void {
  const message = (error as Error)?.message || "Failed to generate report";

  if (message.includes("Period not found")) {
    res.status(404).json({ error: message });
    return;
  }

  if (
    message.includes("Report is available only for closed periods") ||
    message.includes("Report requires frozen snapshot") ||
    message.includes("Snapshot not found for frozen period") ||
    message.includes("Summary snapshot not found for frozen period")
  ) {
    res.status(409).json({ error: message });
    return;
  }

  console.error("Report Error:", error);
  res.status(500).json({ error: "Failed to generate report" });
}

export const downloadDetailReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const profession = req.query.profession as string | undefined;
    const format = String(req.query.format ?? "xlsx").toLowerCase();

    if (!year || !month) {
      res.status(400).json({ error: "Year and month are required" });
      return;
    }

    const isCsv = format === "csv";
    const buffer = isCsv
      ? await reportService.generateDetailReportCsv({
          year,
          month,
          professionCode: profession,
        })
      : await reportService.generateDetailReport({
          year,
          month,
          professionCode: profession,
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
    handleReportError(res, error);
  }
};

export const downloadSummaryReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const format = String(req.query.format ?? "xlsx").toLowerCase();

    if (!year || !month) {
      res.status(400).json({ error: "Year and month are required" });
      return;
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
    handleReportError(res, error);
  }
};
