import { describe, expect, jest, test } from "@jest/globals";
import { AuthenticationError, NotFoundError } from "@/shared/utils/errors.js";

jest.mock("@/modules/snapshot/services/snapshot.service.js", () => ({
  getPeriodWithSnapshot: jest.fn(),
  freezePeriod: jest.fn(),
  unfreezePeriod: jest.fn(),
  getSnapshot: jest.fn(),
  getSnapshotsForPeriod: jest.fn(),
  getPayoutDataForReport: jest.fn(),
  getSummaryDataForReport: jest.fn(),
  SnapshotType: {
    PAYROLL: "PAYROLL",
  },
}));

import * as snapshotService from "@/modules/snapshot/services/snapshot.service.js";
import {
  freezePeriod,
  getPeriodWithSnapshot,
  getReportData,
} from "@/modules/snapshot/snapshot.controller.js";

describe("snapshot controller", () => {
  test("freezePeriod forwards AuthenticationError when user missing", async () => {
    const req: any = { params: { id: "1" }, user: undefined };
    const res: any = { json: jest.fn() };
    const next = jest.fn();

    await freezePeriod(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
  });

  test("getPeriodWithSnapshot forwards NotFoundError when period missing", async () => {
    const req: any = { params: { id: "1" } };
    const res: any = { json: jest.fn() };
    const next = jest.fn();

    (snapshotService.getPeriodWithSnapshot as jest.Mock).mockResolvedValue(null);

    await getPeriodWithSnapshot(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  test("getReportData keeps SNAPSHOT_NOT_READY as 409 response", async () => {
    const req: any = { params: { id: "2" } };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    (snapshotService.getPayoutDataForReport as jest.Mock).mockRejectedValue(
      new Error("SNAPSHOT_NOT_READY"),
    );

    await getReportData(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "Snapshot is not ready for this period",
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});
