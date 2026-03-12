import { describe, expect, jest, test } from "@jest/globals";
import { ConflictError, ValidationError } from "@/shared/utils/errors.js";

jest.mock("@/modules/report/services/report.service.js", () => ({
  generateDetailReport: jest.fn(),
  generateDetailReportCsv: jest.fn(),
  generateSummaryReport: jest.fn(),
  generateSummaryReportCsv: jest.fn(),
}));

import * as reportService from "@/modules/report/services/report.service.js";
import { downloadDetailReport } from "@/modules/report/report.controller.js";

describe("report controller", () => {
  test("forwards ValidationError when year/month missing", async () => {
    const req: any = { query: {} };
    const res: any = { setHeader: jest.fn(), send: jest.fn() };
    const next = jest.fn();

    await downloadDetailReport(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  test("maps snapshot-not-ready errors to ConflictError", async () => {
    const req: any = { query: { year: "2026", month: "1" } };
    const res: any = { setHeader: jest.fn(), send: jest.fn() };
    const next = jest.fn();

    (reportService.generateDetailReport as jest.Mock).mockRejectedValue(
      new Error("SNAPSHOT_NOT_READY"),
    );

    await downloadDetailReport(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(ConflictError));
  });
});
