// src/routes/certificate.routes.js
import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import {
  getConfig,
  upsertConfig,
  getHistory,
  submitCertificateRequest,
  updateCertificateRequestStatus,
  getCertificateRequests,
  getCertificateStats,
} from '../controllers/certificate.controller.js';

const router = express.Router();

// Get / set template configuration (school only)
router.get('/:schoolId/config', protect, authorize('school'), getConfig);
router.post('/:schoolId/config', protect, authorize('school'), upsertConfig);

// Get emission history for a school
router.get('/:schoolId/history', protect, authorize('school'), getHistory);

// Certificate request tracking endpoints
router.post('/:schoolId/request', protect, authorize('school'), submitCertificateRequest);
router.patch(
  '/:schoolId/request/:logId/status',
  protect,
  authorize('school'),
  updateCertificateRequestStatus,
);
router.get('/:schoolId/requests', protect, authorize('school'), getCertificateRequests);
router.get('/:schoolId/stats', protect, authorize('school'), getCertificateStats);

export default router;
