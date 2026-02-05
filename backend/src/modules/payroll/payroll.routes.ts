import { Router } from "express";
import {
  approveByDirector,
  approveByHR,
  approveByHeadFinance,
  addPeriodItems,
  calculateOnDemand,
  calculatePeriod,
  createPeriod,
  createLeavePayException,
  createLeaveReturnReport,
  deleteLeavePayException,
  deleteLeaveReturnReport,
  getPeriodDetail,
  getPeriodPayouts,
  getPeriodSummaryByProfession,
  getPeriodReport,
  listPeriods,
  listLeavePayExceptions,
  listLeaveReturnReports,
  removePeriodItem,
  rejectPeriod,
  searchPayouts,
  submitToHR,
} from '@/modules/payroll/payroll.controller.js';
import { protect, restrictTo } from '@middlewares/authMiddleware.js';
import { validate } from '@shared/validate.middleware.js';
import {
  createPeriodSchema,
  calculateOnDemandSchema,
  addPeriodItemsSchema,
  rejectPeriodSchema,
  leavePayExceptionSchema,
  leaveReturnReportSchema,
  periodIdParamSchema,
  periodItemParamSchema,
  leavePayExceptionIdSchema,
  leaveReturnReportIdSchema,
} from '@/modules/payroll/payroll.schema.js';
import { UserRole } from '@types/auth.js';

const router = Router();

// View period status (authenticated dashboard users)
router.get(
  "/period/:periodId/payouts",
  protect,
  validate(periodIdParamSchema),
  getPeriodPayouts,
);
router.get(
  "/payouts/search",
  protect,
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  searchPayouts,
);
router.get(
  "/period",
  protect,
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  listPeriods,
);
router.get(
  "/period/:periodId",
  protect,
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  validate(periodIdParamSchema),
  getPeriodDetail,
);
router.get(
  "/period/:periodId/report",
  protect,
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  validate(periodIdParamSchema),
  getPeriodReport,
);
router.get(
  "/period/:periodId/summary-by-profession",
  protect,
  restrictTo(UserRole.PTS_OFFICER, UserRole.ADMIN),
  validate(periodIdParamSchema),
  getPeriodSummaryByProfession,
);

// Create a new period (PTS_OFFICER/ADMIN)
router.post(
  "/period",
  protect,
  restrictTo(UserRole.PTS_OFFICER, UserRole.ADMIN),
  validate(createPeriodSchema),
  createPeriod,
);
router.post(
  "/period/:periodId/items",
  protect,
  restrictTo(UserRole.PTS_OFFICER, UserRole.ADMIN),
  validate(periodIdParamSchema),
  validate(addPeriodItemsSchema),
  addPeriodItems,
);
router.delete(
  "/period/:periodId/items/:itemId",
  protect,
  restrictTo(UserRole.PTS_OFFICER, UserRole.ADMIN),
  validate(periodItemParamSchema),
  removePeriodItem,
);

// Ad-hoc calculation for a single employee (integration tests/tools)
router.post(
  "/calculate",
  protect,
  restrictTo(
    UserRole.ADMIN,
    UserRole.PTS_OFFICER,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
    UserRole.HEAD_HR,
  ),
  validate(calculateOnDemandSchema),
  calculateOnDemand,
);

// Calculate (OFFICER/ADMIN)
router.post(
  "/period/:periodId/calculate",
  protect,
  restrictTo(UserRole.PTS_OFFICER, UserRole.ADMIN),
  validate(periodIdParamSchema),
  calculatePeriod,
);

// Submit to HR (OFFICER/ADMIN)
router.post(
  "/period/:periodId/submit",
  protect,
  restrictTo(UserRole.PTS_OFFICER, UserRole.ADMIN),
  validate(periodIdParamSchema),
  submitToHR,
);

// Approve by HR
router.post(
  "/period/:periodId/approve-hr",
  protect,
  restrictTo(UserRole.HEAD_HR, UserRole.ADMIN),
  validate(periodIdParamSchema),
  approveByHR,
);

// Approve by Director
router.post(
  "/period/:periodId/approve-director",
  protect,
  restrictTo(UserRole.DIRECTOR, UserRole.ADMIN),
  validate(periodIdParamSchema),
  approveByDirector,
);

// Approve by Head Finance
router.post(
  "/period/:periodId/approve-head-finance",
  protect,
  restrictTo(UserRole.HEAD_FINANCE, UserRole.ADMIN),
  validate(periodIdParamSchema),
  approveByHeadFinance,
);

// Reject (HR/Director/Admin)
router.post(
  "/period/:periodId/reject",
  protect,
  restrictTo(UserRole.HEAD_HR, UserRole.DIRECTOR, UserRole.ADMIN),
  validate(periodIdParamSchema),
  validate(rejectPeriodSchema),
  rejectPeriod,
);

// Leave pay exceptions (PTS_OFFICER only)
router.post(
  "/leave-pay-exceptions",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(leavePayExceptionSchema),
  createLeavePayException,
);
router.get(
  "/leave-pay-exceptions",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  listLeavePayExceptions,
);
router.delete(
  "/leave-pay-exceptions/:id",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(leavePayExceptionIdSchema),
  deleteLeavePayException,
);

// Leave return reports (education/ordain/military) (PTS_OFFICER only)
router.post(
  "/leave-return-reports",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(leaveReturnReportSchema),
  createLeaveReturnReport,
);
router.get(
  "/leave-return-reports",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  listLeaveReturnReports,
);
router.delete(
  "/leave-return-reports/:id",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(leaveReturnReportIdSchema),
  deleteLeaveReturnReport,
);

export default router;
