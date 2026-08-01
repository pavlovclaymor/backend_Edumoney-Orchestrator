import express from 'express';
import { createPaymentQR } from '../controllers/qr.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Gerar QR Code de pagamento — apenas comerciante autenticado
router.post('/generate', protect, authorize('merchant'), createPaymentQR);

// Pagar via QR Code — apenas estudante autenticado
// router.post("/pay", protect, authorize("user"), payWithQrCode);

export default router;
