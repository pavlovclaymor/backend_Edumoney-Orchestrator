import e from 'express';
import {
  register,
  login,
  getSudentsBySchool,
  getStudentProfile,
  updateStudent,
  changePassword,
  setPin,
  requestEmailVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { validateUniqueness } from '../middlewares/validation.middleware.js';
import { bulkUploadStudents } from '../utils/bulk.js';
import bulkImportOrchestrator from '../imports/core/BulkImportOrchestrator.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

const router = e.Router();

// ================== PUBLIC ==================
// Registo de aluno — público (feito pela escola via bulk ou formulário)
router.post('/register', protect, authorize('school'), register);

// Login — público
router.post('/login', login);

// ================== PASSWORD RECOVERY (PUBLIC) ==================
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// ================== PROTECTED — ESCOLA ==================
// Bulk upload de alunos — apenas escola autenticada
router.post(
  '/bulk-upload',
  protect,
  authorize('school'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Arquivo não enviado',
        });
      }

      const result = await bulkImportOrchestrator.importStudents({
        fileBuffer: req.file.buffer,
        schoolId: req.user.id,
      });

      const { success, createdCount, skippedCount, errors } = result;
      const data = {
        success,
        imported: createdCount,
        failed: skippedCount,
        total: createdCount + skippedCount,
        errors,
      };
      return res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  },
);

// Listar alunos de uma escola — apenas a própria escola autenticada
router.get('/school/:schoolId', protect, authorize('school'), getSudentsBySchool);

// ================== PROTECTED — QUALQUER AUTENTICADO ==================
// Actualizar perfil de estudante — qualquer autenticado (alunos podem alterar os dados)
router.get('/:id/profile', protect, authorize('student', 'teacher'), getStudentProfile);
router.put(
  '/:id/profile',
  protect,
  authorize('student', 'teacher'),
  validateUniqueness(['email']),
  updateStudent,
);
router.put('/:id/change-password', protect, authorize('student', 'teacher'), changePassword);
router.put('/:id/set-pin', protect, authorize('student', 'teacher'), setPin);

// ================== EMAIL VERIFICATION (PROTECTED) ==================
router.post(
  '/request-email-verification',
  protect,
  authorize('school'),
  validateUniqueness(['email']),
  requestEmailVerification,
);
router.post('/verify-email', protect, authorize('student', 'teacher'), verifyEmail);

export default router;
