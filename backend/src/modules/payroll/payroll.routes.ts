import { Router } from "express";
import {
  approveByDirector,
  approveByHR,
  approveByHeadFinance,
  addPeriodItems,
  calculateOnDemand,
  calculatePeriod,
  createPeriod,
  getPeriodDetail,
  getPeriodPayouts,
  getPayoutDetail,
  getPeriodReviewProgress,
  getPeriodSummaryByProfession,
  getPeriodReport,
  listPeriods,
  deletePeriod,
  removePeriodItem,
  rejectPeriod,
  searchPayouts,
  setPeriodProfessionReview,
  submitToHR,
  updatePayout,
} from '@/modules/payroll/payroll.controller.js';
import { protect, restrictTo } from '@middlewares/authMiddleware.js';
import { validate } from '@shared/validate.middleware.js';
import {
  createPeriodSchema,
  calculateOnDemandSchema,
  addPeriodItemsSchema,
  rejectPeriodSchema,
  professionReviewSchema,
  periodIdParamSchema,
  periodItemParamSchema,
  payoutIdParamSchema,
  updatePayoutSchema,
} from '@/modules/payroll/payroll.schema.js';
import { UserRole } from '@/types/auth.js';

const router = Router();

// View period status (authenticated dashboard users)
router.get(
  "/period/:periodId/payouts",
  protect,
  validate(periodIdParamSchema),
  getPeriodPayouts,
);
router.get(
  "/payout/:payoutId/detail",
  protect,
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
  ),
  validate(payoutIdParamSchema),
  getPayoutDetail,
);

router.patch(
  "/payout/:payoutId",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(updatePayoutSchema),
  updatePayout,
);
router.get(
  "/payouts/search",
  protect,
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
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
  ),
  validate(periodIdParamSchema),
  getPeriodDetail,
);
router.delete(
  "/period/:periodId",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(periodIdParamSchema),
  deletePeriod,
);
router.get(
  "/period/:periodId/report",
  protect,
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
  ),
  validate(periodIdParamSchema),
  getPeriodReport,
);
router.get(
  "/period/:periodId/summary-by-profession",
  protect,
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
  ),
  validate(periodIdParamSchema),
  getPeriodSummaryByProfession,
);
router.get(
  "/period/:periodId/review-progress",
  protect,
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
  ),
  validate(periodIdParamSchema),
  getPeriodReviewProgress,
);

// Create a new period (PTS_OFFICER)
router.post(
  "/period",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(createPeriodSchema),
  createPeriod,
);
router.post(
  "/period/:periodId/items",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(periodIdParamSchema),
  validate(addPeriodItemsSchema),
  addPeriodItems,
);
router.delete(
  "/period/:periodId/items/:itemId",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(periodItemParamSchema),
  removePeriodItem,
);

// Ad-hoc calculation for a single employee (integration tests/tools)
router.post(
  "/calculate",
  protect,
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
    UserRole.HEAD_HR,
  ),
  validate(calculateOnDemandSchema),
  calculateOnDemand,
);

// Calculate (OFFICER)
router.post(
  "/period/:periodId/review-progress",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(periodIdParamSchema),
  validate(professionReviewSchema),
  setPeriodProfessionReview,
);

router.post(
  "/period/:periodId/calculate",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(periodIdParamSchema),
  calculatePeriod,
);

// Submit to HR (OFFICER)
router.post(
  "/period/:periodId/submit",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(periodIdParamSchema),
  submitToHR,
);

// Approve by HR
router.post(
  "/period/:periodId/approve-hr",
  protect,
  restrictTo(UserRole.HEAD_HR),
  validate(periodIdParamSchema),
  approveByHR,
);

// Approve by Director
router.post(
  "/period/:periodId/approve-director",
  protect,
  restrictTo(UserRole.DIRECTOR),
  validate(periodIdParamSchema),
  approveByDirector,
);

// Approve by Head Finance
router.post(
  "/period/:periodId/approve-head-finance",
  protect,
  restrictTo(UserRole.HEAD_FINANCE),
  validate(periodIdParamSchema),
  approveByHeadFinance,
);

// Reject (HR/Director)
router.post(
  "/period/:periodId/reject",
  protect,
  restrictTo(UserRole.HEAD_HR, UserRole.DIRECTOR),
  validate(periodIdParamSchema),
  validate(rejectPeriodSchema),
  rejectPeriod,
);

export default router;
