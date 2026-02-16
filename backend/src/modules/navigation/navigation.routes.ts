import express from 'express';
import { protect } from '@middlewares/authMiddleware.js';
import { getNavigation } from '@/modules/navigation/navigation.controller.js';

const router = express.Router();

router.get('/', protect, getNavigation);

export default router;
