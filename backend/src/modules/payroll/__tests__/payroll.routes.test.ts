import express from "express";
import request from "supertest";

import { UserRole } from "@/types/auth.js";

jest.mock("@middlewares/authMiddleware.js", () => ({
  protect: (req: any, _res: any, next: any) => {
    req.user = {
      userId: 1,
      citizenId: "1234567890123",
      role: UserRole.FINANCE_OFFICER,
    };
    next();
  },
  restrictTo:
    (...allowedRoles: string[]) =>
    (req: any, res: any, next: any) => {
      if (!allowedRoles.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          error: "You do not have permission to access this resource",
        });
        return;
      }
      next();
    },
}));

jest.mock("@shared/validate.middleware.js", () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock("@/modules/payroll/payroll.controller.js", () => ({
  getPeriodDetail: (_req: any, res: any) => res.json({ success: true, data: { period: {} } }),
  getPeriodPayouts: (_req: any, res: any) => res.json({ success: true, data: [] }),
  getPayoutDetail: (_req: any, res: any) => res.json({ success: true, data: {} }),
  getPeriodStatus: jest.fn(),
  getPeriodLeaves: jest.fn(),
  getPeriodLeaveProfessionSummary: jest.fn(),
  getPeriodReviewProgress: jest.fn(),
  getPeriodSummaryByProfession: jest.fn(),
  listPeriods: (_req: any, res: any) => res.json({ success: true, data: [] }),
  approveByDirector: jest.fn(),
  approveByHR: jest.fn(),
  approveByHeadFinance: jest.fn(),
  addPeriodItems: jest.fn(),
  calculateOnDemand: jest.fn(),
  calculatePeriod: jest.fn(),
  createPeriod: jest.fn(),
  deletePeriod: jest.fn(),
  removePeriodItem: jest.fn(),
  rejectPeriod: jest.fn(),
  searchPayouts: (_req: any, res: any) => res.json({ success: true, data: [] }),
  setPeriodProfessionReview: jest.fn(),
  submitToHR: jest.fn(),
  updatePayout: jest.fn(),
}));

describe("payroll routes", () => {
  const buildApp = async () => {
    const payrollRouter = (await import("../payroll.routes.js")).default;
    const app = express();
    app.disable("x-powered-by");
    app.use(express.json());
    app.use("/api/payroll", payrollRouter);
    return app;
  };

  test("allows FINANCE_OFFICER to access read-only payroll endpoints", async () => {
    const app = await buildApp();

    await request(app).get("/api/payroll/period").expect(200);
    await request(app).get("/api/payroll/period/38").expect(200);
    await request(app).get("/api/payroll/period/38/payouts").expect(200);
    await request(app).get("/api/payroll/payout/1/detail").expect(200);
  });
});
