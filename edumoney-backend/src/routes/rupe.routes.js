import e from 'express';
import { sendRupeCallback, PendingRupe } from '../controllers/rupe.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { requireFullyActivatedAccount } from '../middlewares/activation.middleware.js';
import { requireActiveStatus } from '../middlewares/status.middleware.js';

const router = e.Router();

// Rota para criar RUPE — requer conta totalmente ativada
router.post(
  '/create',
  protect,
  authorize('student', 'teacher'),
  requireActiveStatus,
  sendRupeCallback,
);

// Rota para pegar RUPEs pendentes da escola
router.get('/pending/:schoolId', protect, authorize('school'), PendingRupe);

export default router;
