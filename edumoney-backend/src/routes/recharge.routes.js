import express from 'express';
import {
  requestRecharge,
  confirmRecharge,
  cancelRupe,
  getPendingRecharge,
} from '../controllers/recharge.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { requireActiveStatus } from '../middlewares/status.middleware.js';
import { requireFullyActivatedAccount } from '../middlewares/activation.middleware.js';

const router = express.Router();

router.post(
  '/request',
  protect,
  authorize('student', 'teacher'),
  requireActiveStatus,
  requestRecharge,
);
router.post('/callback', protect, confirmRecharge);
router.get(
  '/pending',
  protect,
  authorize('student', 'teacher'),
  requireActiveStatus,
  getPendingRecharge,
);
router.post('/cancel', protect, authorize('student', 'teacher'), requireActiveStatus, cancelRupe);

export default router;
