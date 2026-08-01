/**
 * Admin Routes
 * Routes for administrative operations
 * Following AUTH_ARCHITECTURE_PATTERN_GUIDE.md pattern
 */

import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import * as adminController from '../controllers/admin.controller.js';

const router = express.Router();

// WALLET ADMIN ROUTES
router.get('/wallet/:userId/status', protect, authorize('admin'), adminController.getWalletStatus);
router.post('/wallet/:userId/freeze', protect, authorize('admin'), adminController.freezeWallet);
router.post(
  '/wallet/:userId/unfreeze',
  protect,
  authorize('admin'),
  adminController.unfreezeWallet,
);
router.get('/wallet/frozen', protect, authorize('admin'), adminController.getFrozenWallets);

// FRAUD ROUTES
router.get('/fraud/stats', protect, authorize('admin'), adminController.getFraudStats);
router.get('/fraud/alerts', protect, authorize('admin'), adminController.getFraudAlerts);
router.get('/fraud/high-risk', protect, authorize('admin'), adminController.getHighRiskUsers);

// USER MANAGEMENT ROUTES
router.post(
  '/user/:userId/set-risk-score',
  protect,
  authorize('admin'),
  adminController.setUserRiskScore,
);
router.post('/user/:userId/suspend', protect, authorize('admin'), adminController.suspendUser);
router.post(
  '/user/:userId/reactivate',
  protect,
  authorize('admin'),
  adminController.reactivateUser,
);
router.get('/user/:userId/status', protect, authorize('admin'), adminController.getUserStatus);
router.get('/users', protect, authorize('admin'), adminController.getUsers);

// SECURITY DASHBOARD
router.get(
  '/security/dashboard',
  protect,
  authorize('admin'),
  adminController.getSecurityDashboard,
);

export default router;
