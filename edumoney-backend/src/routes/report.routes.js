import express from 'express';
import {
  getUserTransactions,
  getMerchantTransactions,
  getSchoolReport,
} from '../controllers/report.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

//hist do user
router.get('/user/:userId', protect, getUserTransactions);

//hist merchant
router.get('/merchant/:merchantId', protect, getMerchantTransactions);

//hist school
router.get('/school/:schoolId', protect, getSchoolReport);

export default router;
