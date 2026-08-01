import express from 'express';
import {
  createMerchant,
  createCategory,
  getMerchantBySchool,
  updateMerchant,
  updateMerchantStatus,
  deleteMerchant,
  getCategories,
  deleteCategory,
  createProduct,
  getProductByMerchant,
  updateProduct,
  deleteProduct,
  changePassword,
} from '../controllers/merchant.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { validateUniqueness } from '../middlewares/validation.middleware.js';

const router = express.Router();

// ================== MERCHANTS CRUD ==================
// Criar comerciante — apenas escola autenticada pode registar um comerciante
router.post('/', validateUniqueness(['email', 'nif']), createMerchant);

// Listar comerciantes de uma escola — escola ou o próprio comerciante
router.get('/:schoolId', protect, getMerchantBySchool);

// Actualizar comerciante — apenas o próprio comerciante
router.put(
  '/:id',
  protect,
  authorize('merchant'),
  validateUniqueness(['email', 'nif']),
  updateMerchant,
);

// Alterar senha do comerciante
router.put('/change-password/:merchantId', protect, authorize('merchant'), changePassword);

// Atualizar status do comerciante — apenas escola pode ativar/desativar
router.patch('/:id/status', protect, authorize('school'), updateMerchantStatus);

// Apagar comerciante — apenas escola pode remover comerciantes
router.delete('/:id', protect, authorize('school'), deleteMerchant);

// ================== CATEGORIES CRUD ==================
// Criar categoria — apenas o próprio comerciante
router.post('/:merchantId/categories', protect, authorize('merchant'), createCategory);

// Listar categorias — comerciante autenticado
router.get('/:merchantId/categories', protect, authorize('merchant'), getCategories);

// Apagar categoria — apenas o próprio comerciante
router.delete(
  '/:merchantId/categories/:categoryId',
  protect,
  authorize('merchant'),
  deleteCategory,
);

// ================== PRODUCTS CRUD ==================
// Criar produto — apenas o próprio comerciante
router.post('/:merchantId/products', protect, authorize('merchant'), createProduct);

// Listar produtos — comerciante autenticado
router.get('/:merchantId/products', protect, authorize('merchant'), getProductByMerchant);

// Actualizar produto — apenas o próprio comerciante
router.put('/products/:id', protect, authorize('merchant'), updateProduct);

// Apagar produto — apenas o próprio comerciante
router.delete('/products/:id', protect, authorize('merchant'), deleteProduct);

export default router;
