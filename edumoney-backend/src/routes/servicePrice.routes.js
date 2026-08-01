import express from 'express';
import {
  getServicePricesBySchool,
  updateServicePrice,
} from '../controllers/servicePrice.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/:schoolId', protect, getServicePricesBySchool);
router.put('/:id', protect, authorize('school'), updateServicePrice);

export default router;
