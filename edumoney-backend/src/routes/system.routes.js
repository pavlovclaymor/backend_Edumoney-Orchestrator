/**
 * System Routes
 * Routes for system monitoring and operations
 * Following AUTH_ARCHITECTURE_PATTERN_GUIDE.md pattern
 */

import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import * as systemController from '../controllers/system.controller.js';

const router = express.Router();

// HEALTH CHECK
router.get('/health', protect, authorize('admin'), systemController.getHealth);

// REDIS STATUS
router.get('/redis', protect, authorize('admin'), systemController.getRedisStatus);

// SYSTEM STATS
router.get('/stats', protect, authorize('admin'), systemController.getStats);

// SYSTEM EVENTS
router.get('/events', protect, authorize('admin'), systemController.getEvents);

// WORKERS STATUS
router.get('/workers', protect, authorize('admin'), systemController.getWorkersStatus);

export default router;
