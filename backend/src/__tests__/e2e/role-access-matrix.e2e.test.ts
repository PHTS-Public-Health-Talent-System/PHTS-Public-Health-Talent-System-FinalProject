import express from "express";
import request from "supertest";
import { UserRole } from "@/types/auth.js";

let currentRole: UserRole = UserRole.USER;

const ok = (_req: any, res: any) => res.status(200).json({ success: true });

jest.mock("@middlewares/authMiddleware.js", () => ({
  protect: (req: any, _res: any, next: any) => {
    req.user = {
      userId: 999,
      citizenId: "1000000000000",
      role: currentRole,
    };
    next();
  },
  restrictTo:
    (...allowedRoles: UserRole[]) =>
    (req: any, res: any, next: any) => {
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: "You do not have permission to access this resource",
        });
      }
      next();
    },
}));

jest.mock("@shared/validate.middleware.js", () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock("@middlewares/idempotency.js", () => ({
  idempotency: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock("@config/upload.js", () => ({
  requestUpload: {
    fields: () => (_req: any, _res: any, next: any) => next(),
  },
  upload: {
    array: () => (_req: any, _res: any, next: any) => next(),
  },
}));

jest.mock("@/modules/request/controllers/request.controller.js", () => ({
  requestController: new Proxy(
    {},
    {
      get: () => ok,
    },
  ),
}));

jest.mock("@/modules/payroll/payroll.controller.js", () => ({
  approveByDirector: ok,
  approveByHR: ok,
  approveByHeadFinance: ok,
  addPeriodItems: ok,
  calculateOnDemand: ok,
  calculatePeriod: ok,
  createPeriod: ok,
  getPeriodStatus: ok,
  getPeriodDetail: ok,
  getPeriodPayouts: ok,
  getPeriodLeaves: ok,
  getPeriodLeaveProfessionSummary: ok,
  getPayoutDetail: ok,
  getPeriodReviewProgress: ok,
  getPeriodSummaryByProfession: ok,
  listPeriods: ok,
  deletePeriod: ok,
  removePeriodItem: ok,
  rejectPeriod: ok,
  searchPayouts: ok,
  setPeriodProfessionReview: ok,
  submitToHR: ok,
  updatePayout: ok,
}));

jest.mock("@/modules/finance/finance.controller.js", () => ({
  getDashboard: ok,
  getSummary: ok,
  getYearlySummary: ok,
  getPayoutsByPeriod: ok,
  markAsPaid: ok,
  batchMarkAsPaid: ok,
  cancelPayout: ok,
}));

jest.mock("@/modules/snapshot/snapshot.controller.js", () => ({
  getPeriodWithSnapshot: ok,
  getSnapshotReadiness: ok,
  getSnapshotsForPeriod: ok,
  getSnapshot: ok,
  getReportData: ok,
  getSummaryData: ok,
  freezePeriod: ok,
  unfreezePeriod: ok,
}));

jest.mock("@/modules/dashboard/controllers/dashboard.controller.js", () => ({
  getUserDashboardSummary: ok,
  getApproverDashboardSummary: ok,
}));

jest.mock("@/modules/system/admin/admin.controller.js", () => ({
  searchUsers: ok,
  getUserById: ok,
  updateUserRole: ok,
  toggleMaintenanceMode: ok,
  getMaintenanceMode: ok,
  getJobStatus: ok,
  getVersionInfo: ok,
  getNotificationOutbox: ok,
  retryNotificationDeadLetters: ok,
  retryNotificationOutbox: ok,
  getSnapshotOutbox: ok,
  retrySnapshotDeadLetters: ok,
  retrySnapshotOutbox: ok,
}));

jest.mock("@/modules/leave-management/controllers/leave-management.controller.js", () => ({
  listLeaveManagement: ok,
  listLeavePersonnel: ok,
  createLeaveManagement: ok,
  getLeaveManagementStats: ok,
  getLeaveManagementQuotaStatus: ok,
  upsertLeaveManagementExtension: ok,
  listLeaveReturnReportEvents: ok,
  replaceLeaveReturnReportEvents: ok,
  listLeaveManagementDocuments: ok,
  addLeaveManagementDocuments: ok,
  deleteLeaveManagementDocument: ok,
  deleteLeaveManagementExtension: ok,
}));

jest.mock("@/modules/report/report.controller.js", () => ({
  downloadDetailReport: ok,
  downloadSummaryReport: ok,
}));

jest.mock("@/modules/notification/notification.controller.js", () => ({
  getMyNotifications: ok,
  markRead: ok,
  getUnreadCount: ok,
  deleteReadNotifications: ok,
  getNotificationSettings: ok,
  updateNotificationSettings: ok,
}));

jest.mock("@/modules/sync/sync.routes.js", () => {
  const { Router } = jest.requireActual("express");
  return { __esModule: true, default: Router() };
});

jest.mock("@/modules/backup/backup.routes.js", () => {
  const { Router } = jest.requireActual("express");
  return { __esModule: true, default: Router() };
});

describe("API role access matrix", () => {
  const allRoles: UserRole[] = [
    UserRole.USER,
    UserRole.HEAD_SCOPE,
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
    UserRole.FINANCE_OFFICER,
    UserRole.ADMIN,
    UserRole.WARD_SCOPE,
    UserRole.DEPT_SCOPE,
  ];

  type HttpMethod = "get" | "post" | "put" | "patch" | "delete";
  type AccessCase = {
    method: HttpMethod;
    path: string;
    allowed: UserRole[];
  };

  const setRole = (role: UserRole) => {
    currentRole = role;
  };

  const buildApp = async () => {
    const requestRoutes = (await import("@/modules/request/request.routes.js")).default;
    const payrollRoutes = (await import("@/modules/payroll/payroll.routes.js")).default;
    const financeRoutes = (await import("@/modules/finance/finance.routes.js")).default;
    const snapshotRoutes = (await import("@/modules/snapshot/snapshot.routes.js")).default;
    const dashboardRoutes = (await import("@/modules/dashboard/routes/dashboard.routes.js")).default;
    const systemRoutes = (await import("@/modules/system/admin/admin.routes.js")).default;
    const leaveRoutes = (await import("@/modules/leave-management/leave-management.routes.js")).default;
    const reportRoutes = (await import("@/modules/report/report.routes.js")).default;
    const notificationRoutes = (await import("@/modules/notification/notification.routes.js")).default;

    const app = express();
    app.disable("x-powered-by");
    app.use(express.json());
    app.use("/api/requests", requestRoutes);
    app.use("/api/payroll", payrollRoutes);
    app.use("/api/finance", financeRoutes);
    app.use("/api/snapshots", snapshotRoutes);
    app.use("/api/dashboard", dashboardRoutes);
    app.use("/api/system", systemRoutes);
    app.use("/api/leave-management", leaveRoutes);
    app.use("/api/reports", reportRoutes);
    app.use("/api/notifications", notificationRoutes);
    return app;
  };

  const assertAccessCases = async (app: express.Application, cases: AccessCase[]) => {
    for (const testCase of cases) {
      for (const role of allRoles) {
        setRole(role);
        const expectedStatus = testCase.allowed.includes(role) ? 200 : 403;
        await request(app)[testCase.method](testCase.path).expect(expectedStatus);
      }
    }
  };

  test("enforces access matrix for request routes", async () => {
    const app = await buildApp();
    await assertAccessCases(app, [
      {
        method: "get",
        path: "/api/requests/pending",
        allowed: [
          UserRole.HEAD_SCOPE,
          UserRole.PTS_OFFICER,
          UserRole.HEAD_HR,
          UserRole.HEAD_FINANCE,
          UserRole.DIRECTOR,
        ],
      },
      {
        method: "post",
        path: "/api/requests/batch-approve",
        allowed: [UserRole.DIRECTOR],
      },
      {
        method: "post",
        path: "/api/requests/100/approve",
        allowed: [
          UserRole.HEAD_SCOPE,
          UserRole.PTS_OFFICER,
          UserRole.HEAD_HR,
          UserRole.HEAD_FINANCE,
          UserRole.DIRECTOR,
        ],
      },
      {
        method: "post",
        path: "/api/requests/100/reassign",
        allowed: [UserRole.PTS_OFFICER],
      },
      {
        method: "post",
        path: "/api/requests/100/verification-snapshot",
        allowed: [UserRole.PTS_OFFICER, UserRole.HEAD_HR],
      },
      {
        method: "get",
        path: "/api/requests/eligibility",
        allowed: [UserRole.PTS_OFFICER],
      },
      {
        method: "get",
        path: "/api/requests/my-scopes",
        allowed: [UserRole.HEAD_SCOPE],
      },
      {
        method: "post",
        path: "/api/requests/100/attachments/ocr",
        allowed: [UserRole.PTS_OFFICER],
      },
    ]);
  });

  test("enforces access matrix for payroll routes", async () => {
    const app = await buildApp();
    await assertAccessCases(app, [
      {
        method: "get",
        path: "/api/payroll/period/status",
        allowed: [
          UserRole.PTS_OFFICER,
          UserRole.HEAD_HR,
          UserRole.HEAD_FINANCE,
          UserRole.FINANCE_OFFICER,
          UserRole.DIRECTOR,
        ],
      },
      {
        method: "post",
        path: "/api/payroll/period",
        allowed: [UserRole.PTS_OFFICER],
      },
      {
        method: "post",
        path: "/api/payroll/period/1/approve-hr",
        allowed: [UserRole.HEAD_HR],
      },
      {
        method: "post",
        path: "/api/payroll/period/1/approve-head-finance",
        allowed: [UserRole.HEAD_FINANCE],
      },
      {
        method: "post",
        path: "/api/payroll/period/1/approve-director",
        allowed: [UserRole.DIRECTOR],
      },
      {
        method: "post",
        path: "/api/payroll/period/1/reject",
        allowed: [UserRole.HEAD_HR, UserRole.DIRECTOR],
      },
    ]);
  });

  test("enforces access matrix for finance/snapshot/dashboard/system", async () => {
    const app = await buildApp();
    await assertAccessCases(app, [
      {
        method: "get",
        path: "/api/finance/dashboard",
        allowed: [UserRole.FINANCE_OFFICER],
      },
      {
        method: "post",
        path: "/api/finance/payouts/10/cancel",
        allowed: [UserRole.FINANCE_OFFICER, UserRole.HEAD_FINANCE],
      },
      {
        method: "post",
        path: "/api/snapshots/periods/1/freeze",
        allowed: [UserRole.PTS_OFFICER],
      },
      {
        method: "post",
        path: "/api/snapshots/periods/1/unfreeze",
        allowed: [UserRole.PTS_OFFICER, UserRole.ADMIN],
      },
      {
        method: "get",
        path: "/api/dashboard/user",
        allowed: allRoles,
      },
      {
        method: "get",
        path: "/api/dashboard/approver",
        allowed: [UserRole.HEAD_HR, UserRole.HEAD_FINANCE],
      },
      {
        method: "get",
        path: "/api/system/users",
        allowed: [UserRole.ADMIN],
      },
      {
        method: "post",
        path: "/api/system/maintenance",
        allowed: [UserRole.ADMIN],
      },
    ]);
  });

  test("enforces access matrix for leave-management/report/notification", async () => {
    const app = await buildApp();
    await assertAccessCases(app, [
      {
        method: "get",
        path: "/api/leave-management",
        allowed: [UserRole.PTS_OFFICER],
      },
      {
        method: "post",
        path: "/api/leave-management",
        allowed: [UserRole.PTS_OFFICER],
      },
      {
        method: "get",
        path: "/api/reports/summary",
        allowed: [
          UserRole.PTS_OFFICER,
          UserRole.HEAD_HR,
          UserRole.HEAD_FINANCE,
          UserRole.FINANCE_OFFICER,
          UserRole.DIRECTOR,
        ],
      },
      {
        method: "get",
        path: "/api/notifications",
        allowed: allRoles,
      },
      {
        method: "put",
        path: "/api/notifications/1/read",
        allowed: allRoles,
      },
    ]);
  });
});
