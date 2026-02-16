import { Router } from 'express';
import { protect } from '@middlewares/authMiddleware.js';
import { getUserDashboardSummary, getHeadHrDashboardSummary } from '@/modules/dashboard/dashboard.controller.js';

const router = Router();

router.use(protect);

router.get('/user', getUserDashboardSummary);
router.get('/head-hr', getHeadHrDashboardSummary);

export default router;
