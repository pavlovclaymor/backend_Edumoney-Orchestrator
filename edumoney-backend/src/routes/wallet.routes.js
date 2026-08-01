import e from 'express';
import { getWallet, addBalance } from '../controllers/wallet.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { requireActiveStatus } from '../middlewares/status.middleware.js';
import { requireFullyActivatedAccount } from '../middlewares/activation.middleware.js';

const router = e.Router();

// router.post('/create', createWallet)
router.get('/:userId/:model', protect, requireFullyActivatedAccount, getWallet);
router.post(
  '/add-balance',
  protect,
  authorize('student', 'teacher'),
  requireFullyActivatedAccount,
  addBalance,
);

export default router;
