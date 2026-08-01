import e from 'express';
import {
  getSchoolWallet,
  getAllSchools,
  createSchool,
  getOneSchool,
  getAllClasses,
  getAllMerchantForSchool,
  addSheetsPrint,
  getSheetsPrinted,
  UpdateSchool,
  changePassword,
  updateFeeRate,
  getFeeRate,
} from '../controllers/school.controller.js';
import { authorize, protect } from '../middlewares/auth.middleware.js';
import { validateUniqueness } from '../middlewares/validation.middleware.js';

const router = e.Router();

// ================== PUBLIC ==================
// Criar escola — registo público
router.post('/', validateUniqueness(['email', 'nif']), createSchool);

// Listar todas as escolas — público (necessário para registo de estudantes/comerciantes)
router.get('/', getAllSchools);

// ================== PROTECTED — ESCOLA ==================
// Actualizar dados da escola — apenas a própria escola
router.post(
  '/update/:schoolId',
  protect,
  authorize('school'),
  validateUniqueness(['email', 'nif']),
  UpdateSchool,
);

// Adicionar folhas impressas — apenas a própria escola
router.post('/printend/:schoolId', protect, authorize('school'), addSheetsPrint);

// Obter wallet da escola — apenas a própria escola
router.get('/wallet/:schoolId', protect, authorize('school'), getSchoolWallet);

// Obter folhas impressas/vendidas — apenas a própria escola
router.get('/sheets/:schoolId', protect, authorize('school'), getSheetsPrinted);

// Obter taxa de saque — apenas a própria escola
router.get('/fee-rate/:schoolId', protect, getFeeRate);

// Atualizar taxa de saque — apenas a própria escola
router.put('/fee-rate/:schoolId', protect, authorize('school'), updateFeeRate);

// ================== PROTECTED — QUALQUER AUTENTICADO ==================
// Listar comerciantes de uma escola — escola ou comerciante autenticado
router.get('/merchant/:schoolId', protect, getAllMerchantForSchool);

// Listar turmas de uma escola — qualquer autenticado (necessário no registo de alunos)
router.get('/classes/:schoolId', protect, getAllClasses);

// Obter dados de uma escola — qualquer autenticado
router.get('/:schoolId', protect, getOneSchool);

//Change-Password da escola — apenas a própria escola
router.put('/change-password/:schoolId', protect, authorize('school'), changePassword);

export default router;
