import { Router } from "express";
import { protect, restrictTo } from '@middlewares/authMiddleware.js';
import { validate } from '@shared/validate.middleware.js';
import {
  createHolidaySchema,
  createRateSchema,
  deleteHolidaySchema,
  deleteRateSchema,
  getHolidaysSchema,
  updateHolidaySchema,
  updateRateSchema,
} from '@/modules/master-data/master-data.schema.js';
import { UserRole } from '@/types/auth.js';
import * as masterDataController from '@/modules/master-data/master-data.controller.js';

const router = Router();

// All routes require authentication
router.use(protect);

// Officer only access
const officerAuth = restrictTo(UserRole.PTS_OFFICER);

router.get(
  "/holidays",
  officerAuth,
  validate(getHolidaysSchema),
  masterDataController.getHolidays,
);

router.post(
  "/holidays",
  officerAuth,
  validate(createHolidaySchema),
  masterDataController.addHoliday,
);

router.put(
  "/holidays/:date",
  officerAuth,
  validate(updateHolidaySchema),
  masterDataController.updateHoliday,
);

router.delete(
  "/holidays/:date",
  officerAuth,
  validate(deleteHolidaySchema),
  masterDataController.deleteHoliday,
);

router.get("/rates", officerAuth, masterDataController.getMasterRates);

router.post(
  "/rates",
  officerAuth,
  validate(createRateSchema),
  masterDataController.createMasterRate,
);

router.put(
  "/rates/:rateId",
  officerAuth,
  validate(updateRateSchema),
  masterDataController.updateMasterRate,
);

router.delete(
  "/rates/:rateId",
  officerAuth,
  validate(deleteRateSchema),
  masterDataController.deleteMasterRate,
);

// Public rates endpoints (all authenticated users can access for dropdown selection)
router.get("/professions", masterDataController.getProfessions);
router.get("/rate-hierarchy", masterDataController.getRateHierarchy);
router.get("/rates/:professionCode", masterDataController.getRatesByProfession);

export default router;
