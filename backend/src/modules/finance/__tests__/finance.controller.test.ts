import { describe, expect, jest, test } from "@jest/globals";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from "@/shared/utils/errors.js";

jest.mock("@/modules/finance/services/summary.service.js", () => ({
  getFinanceDashboard: jest.fn(),
  getFinanceSummary: jest.fn(),
  getYearlySummary: jest.fn(),
}));

jest.mock("@/modules/finance/services/payment.service.js", () => ({
  getPayoutsByPeriod: jest.fn(),
  markPayoutAsPaid: jest.fn(),
  batchMarkAsPaid: jest.fn(),
  cancelPayout: jest.fn(),
}));

import * as paymentService from "@/modules/finance/services/payment.service.js";
import {
  getPayoutsByPeriod,
  markAsPaid,
} from "@/modules/finance/finance.controller.js";

describe("finance controller", () => {
  test("markAsPaid forwards AuthenticationError when user missing", async () => {
    const req: any = {
      params: { payoutId: "2" },
      body: {},
      user: undefined,
    };
    const res: any = { json: jest.fn() };
    const next = jest.fn();

    await markAsPaid(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
  });

  test("getPayoutsByPeriod maps period not found to NotFoundError", async () => {
    const req: any = {
      params: { periodId: "9" },
      query: {},
    };
    const res: any = { json: jest.fn() };
    const next = jest.fn();

    (paymentService.getPayoutsByPeriod as jest.Mock).mockRejectedValue(
      new Error("Period 9 not found"),
    );

    await getPayoutsByPeriod(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  test("getPayoutsByPeriod maps unpublished period error to AuthorizationError", async () => {
    const req: any = {
      params: { periodId: "9" },
      query: {},
    };
    const res: any = { json: jest.fn() };
    const next = jest.fn();

    (paymentService.getPayoutsByPeriod as jest.Mock).mockRejectedValue(
      new Error("งวดนี้ยังไม่ผ่านการอนุมัติปิดรอบจากผู้บริหาร"),
    );

    await getPayoutsByPeriod(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });
});
