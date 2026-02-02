import { Request, Response } from "express";
import * as reportService from "./services/report.service.js";

export const downloadDetailReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const profession = req.query.profession as string | undefined;

    if (!year || !month) {
      res.status(400).json({ error: "Year and month are required" });
      return;
    }

    const buffer = await reportService.generateDetailReport({
      year,
      month,
      professionCode: profession,
    });
    const filename = `PTS_Detail_${profession || "ALL"}_${year}_${month}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.send(buffer);
  } catch (error) {
    const message = (error as Error)?.message || "Failed to generate report";
    if (
      message.includes("Report requires frozen snapshot") ||
      message.includes("Summary snapshot not found for frozen period")
    ) {
      res.status(409).json({ error: message });
      return;
    }
    console.error("Report Error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
};

export const downloadSummaryReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (!year || !month) {
      res.status(400).json({ error: "Year and month are required" });
      return;
    }

    const buffer = await reportService.generateSummaryReport(year, month);
    const filename = `PTS_Summary_${year}_${month}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.send(buffer);
  } catch (error) {
    const message = (error as Error)?.message || "Failed to generate report";
    if (
      message.includes("Report requires frozen snapshot") ||
      message.includes("Summary snapshot not found for frozen period")
    ) {
      res.status(409).json({ error: message });
      return;
    }
    console.error("Report Error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
};
