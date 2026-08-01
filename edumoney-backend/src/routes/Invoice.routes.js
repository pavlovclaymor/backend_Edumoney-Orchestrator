import e from 'express';
import {
  getTodaySales,
  getWeeklySales,
  createInvoice,
  getAllSales,
  getInvoicePDF,
  confirmInvoicePayment,
  getInvoiceById,
} from '../controllers/Invoice.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = e.Router();

// Criar factura — apenas comerciante autenticado
router.post('/sales', protect, authorize('merchant'), createInvoice);

// Vendas do dia — apenas o próprio comerciante
router.get('/sales/today', protect, authorize('merchant'), getTodaySales);

// Vendas semanais — apenas o próprio comerciante
router.get('/sales/week', protect, authorize('merchant'), getWeeklySales);

// Todas as facturas — apenas o próprio comerciante
router.get('/sales', protect, authorize('merchant'), getAllSales);

// Download do PDF — apenas comerciante autenticado
router.get(
  '/pdf/:merchantId/:invoiceNumber/:invoiceId',
  protect,
  authorize('merchant'),
  getInvoicePDF,
);

router.patch(
  '/invoice/confirm-payment/:invoiceId',
  protect,
  authorize('merchant'),
  confirmInvoicePayment,
);

// Obter detalhes de fatura pública (Student/QR Flow)
router.get('/:invoiceId', protect, getInvoiceById);

export default router;
