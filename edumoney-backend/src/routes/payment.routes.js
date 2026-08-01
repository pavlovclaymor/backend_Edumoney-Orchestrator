import e from 'express';
import {
  makePayment,
  payToSchool,
  // getPaymentByMerchant,
  // confirmQrPayment
  executePayment,
} from '../controllers/payment.controller.js';

import { protect, authorize } from '../middlewares/auth.middleware.js';
import { requireActiveStatus } from '../middlewares/status.middleware.js';

const router = e.Router();

router.post('/pay', protect, authorize('student', 'teacher'), requireActiveStatus, makePayment);

router.post(
  '/pay/services',
  protect,
  authorize('student', 'teacher'),
  requireActiveStatus,
  payToSchool,
);

// router.get("/extrato/me", protect, requireActiveStatus, getPaymentByUser);

// router.get("/extrato/:userId", protect, requireActiveStatus, getPaymentByUser);
//  router.get('/merchant/extrato/:merchantId', getPaymentByMerchant)

router.post(
  '/execute',
  protect,
  authorize('student', 'teacher'),
  requireActiveStatus,
  executePayment,
);

export default router;
