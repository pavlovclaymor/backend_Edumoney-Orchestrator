import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { getSettings, updateSettings, changePassword } from '../controllers/settings.controller.js';

const router = express.Router();

/**
 * Settings Routes
 * All endpoints are protected and require authentication
 */

// Get settings (merchant or school)
router.get('/:type/:id', protect, getSettings);

// Update settings (merchant or school)
router.patch('/:type/:id', protect, updateSettings);

// Change password (merchant or school)
router.post('/:type/:id/change-password', protect, changePassword);

export default router;
