// src/routes/index.js
import e from 'express';

const router = e.Router();

// Importar e usar outros modulos de rotas
import userRoutes from './auth.routes.js';
import walletRoutes from './wallet.routes.js';
import transactionRoutes from './transaction.route.js';
import schollRoutes from './school.rooutes.js';
import merchantRoutes from './merchant.routes.js';
import paymentRoutes from './payment.routes.js';
import cashoutRoutes from './cashout.routes.js';
import rechargeRoutes from './recharge.routes.js';
import reportRoutes from './report.routes.js';
import qrRoutes from './qr.routes.js';
import invoiceRoutes from './Invoice.routes.js';
import rupeRoutes from './rupe.routes.js';
import servicePriceRoutes from './servicePrice.routes.js';
import notificationRoutes from './notification.routes.js';
import schoolRegistryRoutes from './schoolRegistry.routes.js';
import uploadRoutes from './upload.routes.js';
import termsRoutes from './terms.routes.js';

// New routes
import auditRoutes from './audit.routes.js';
import certificateRoutes from './certificate.routes.js';
import settingsRoutes from './settings.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import adminRoutes from './admin.routes.js';
import systemRoutes from './system.routes.js';
import ledgerRoutes from './ledger.routes.js';

router.use('/users', userRoutes);
router.use('/wallet', walletRoutes);
router.use('/transaction', transactionRoutes);
router.use('/school', schollRoutes);
router.use('/merchant', merchantRoutes);
router.use('/payment', paymentRoutes);
router.use('/cashout', cashoutRoutes);
router.use('/recharge', rechargeRoutes);
router.use('/reports', reportRoutes);
router.use('/qr', qrRoutes);
router.use('/invoice', invoiceRoutes);
router.use('/rupe', rupeRoutes);
router.use('/servicePrices', servicePriceRoutes);
router.use('/notifications', notificationRoutes);
router.use('/registry', schoolRegistryRoutes);
router.use('/uploads', uploadRoutes);
router.use('/terms', termsRoutes);

// New mounts
router.use('/audit', auditRoutes);
router.use('/certificate', certificateRoutes);
router.use('/settings', settingsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/admin', adminRoutes);
router.use('/system', systemRoutes);
router.use('/ledger', ledgerRoutes);

export default router;
