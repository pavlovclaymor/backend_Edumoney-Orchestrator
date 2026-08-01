import e from 'express';
import { createCashout } from '../controllers/cashout.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = e.Router();

router.post('/', protect, authorize('merchant'), createCashout);

export default router;
