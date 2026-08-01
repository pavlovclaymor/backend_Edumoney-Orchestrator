// src/routes/audit.routes.js
import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { getAuditLogs, getAuditActions } from '../controllers/audit.controller.js';

const router = express.Router();

// Get paginated audit logs for a school (only the school itself can access)
router.get('/:schoolId', protect, authorize('school'), getAuditLogs);

// Get distinct actions for filter dropdown
router.get('/:schoolId/actions', protect, authorize('school'), getAuditActions);

// Get distinct entities for filter dropdown
// router.get('/:schoolId/entities', protect, authorize('school'), getAuditEntities);

// // Get details of a single audit log entry
// router.get('/:schoolId/:logId', protect, authorize('school'), getAuditLogDetails);

export default router;
