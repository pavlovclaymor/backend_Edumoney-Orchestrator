import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import {
  getFinancialMetrics,
  getRevenueData,
  getMerchantStats,
  getCertificateStats,
  getRecentTransactions,
  getTopMerchants,
} from '../controllers/dashboard.controller.js';

const router = express.Router();

/**
 * Dashboard Routes
 * All endpoints are protected and require school authorization
 */

// Financial metrics
router.get('/:schoolId/financial', protect, authorize('school'), getFinancialMetrics);

// Revenue data for charts
router.get('/:schoolId/revenue', protect, authorize('school'), getRevenueData);

// Merchant statistics
router.get('/:schoolId/merchants', protect, authorize('school'), getMerchantStats);

// Certificate statistics
router.get('/:schoolId/certificates', protect, authorize('school'), getCertificateStats);

// Recent transactions
router.get('/:schoolId/recent-transactions', protect, authorize('school'), getRecentTransactions);

// Top merchants
router.get('/:schoolId/top-merchants', protect, authorize('school'), getTopMerchants);

export default router;
