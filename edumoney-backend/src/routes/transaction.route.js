import e from 'express';
import { createTransaction, getTransactionByUser } from '../controllers/transaction.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { requireFullyActivatedAccount } from '../middlewares/activation.middleware.js';
import { requireActiveStatus } from '../middlewares/status.middleware.js';

const router = e.Router();

router.post(
  '/create',
  protect,
  authorize('student', 'teacher'),
  requireActiveStatus,
  createTransaction,
);
router.get('/my', protect, requireActiveStatus, getTransactionByUser);

export default router;
