/**
 * Merchant Controller
 * Delega toda a lógica de negócio para merchant.service.js
 *
 * Uses Contract-First pattern:
 * - DTO for data transformation
 * - ResponseWrapper for standardization
 */

import * as merchantService from '../services/merchant.service.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { MerchantDTO } from '../utils/dto/index.js';
import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';

// =========================================================
// CRIAR COMERCIANTE
// =========================================================
export const createMerchant = async (req, res) => {
  try {
    const { name, category, schoolId, nif, password } = req.body;
    const result = await merchantService.createMerchant({
      name,
      category,
      schoolId,
      nif,
      password,
    });

    await writeAuditLog({
      userId: result.merchant._id,
      userModel: 'Merchant',
      action: 'MERCHANT_CREATED',
      entity: 'Merchant',
      entityId: result.merchant._id,
      status: 'success',
      schoolId: result.merchant.schoolId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    // Apply DTO transformation
    const dto = {
      merchant: MerchantDTO.fromDocument(result.merchant),
      wallet: result.wallet
        ? {
            id: result.wallet._id,
            balance: result.wallet.balance,
            currency: result.wallet.currency || 'AOA',
          }
        : null,
    };

    return res.status(201).json(ApiResponse.created(dto, 'Comerciante criado com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 400
        ? ErrorResponse.badRequest(error.message)
        : status === 409
          ? ErrorResponse.conflict(error.message)
          : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// OBTER COMERCIANTES POR ESCOLA
// =========================================================
export const getMerchantBySchool = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const merchants = await merchantService.getMerchantsBySchool(schoolId);

    // Apply DTO transformation
    const dto = MerchantDTO.fromArray(merchants || []);

    return res.status(200).json(ApiResponse.list(dto, dto.length, 'Comerciantes recuperados'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// =========================================================
// ATUALIZAR COMERCIANTE
// =========================================================
export const updateMerchant = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const result = await merchantService.updateMerchant(id, updates);

    const canUpdate = await merchantService.canUpdateMerchant(
      req.user._id.toString(),
      req.userModel,
      id,
    );

    if (!canUpdate) {
      return res
        .status(403)
        .json(ErrorResponse.forbidden('Não tem permissão para atualizar este perfil'));
    }

    await writeAuditLog({
      userId: req.user._id,
      userModel: req.userModel,
      action: 'MERCHANT_PROFILE_UPDATED',
      entity: 'Merchant',
      entityId: result.merchant._id,
      status: 'success',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      schoolId: result.merchant.schoolId,
      metadata: {
        updatedFields: result.updatedFields,
        fieldCount: result.updatedFields.length,
      },
    }).catch(() => {});

    // Apply DTO transformation
    const dto = {
      merchant: MerchantDTO.fromDocument(result.merchant),
      updatedFields: result.updatedFields,
    };

    return res
      .status(200)
      .json(
        ApiResponse.success(
          dto,
          `Perfil atualizado com sucesso (${result.updatedFields.length} campo(s))`,
        ),
      );
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404
        ? ErrorResponse.notFound('Comerciante')
        : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// DELETAR COMERCIANTE
// =========================================================
export const deleteMerchant = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await merchantService.deleteMerchant(id);

    await writeAuditLog({
      userId: deleted._id,
      userModel: 'Merchant',
      action: 'MERCHANT_DELETED',
      entity: 'Merchant',
      entityId: deleted._id,
      status: 'success',
      schoolId: deleted.schoolId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    return res
      .status(200)
      .json(ApiResponse.success({ deleted: true }, 'Comerciante removido com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404
        ? ErrorResponse.notFound('Comerciante')
        : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// ATUALIZAR STATUS DO COMERCIANTE
// =========================================================
export const updateMerchantStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const schoolId = req.user._id;
    console.log(schoolId);

    const merchant = await merchantService.updateMerchantStatus(id, isActive, schoolId);

    await writeAuditLog({
      userId: schoolId,
      userModel: 'School',
      action: isActive ? 'MERCHANT_ACTIVATED' : 'MERCHANT_DEACTIVATED',
      entity: 'Merchant',
      entityId: merchant._id,
      status: 'success',
      schoolId: merchant.schoolId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    // Apply DTO transformation
    const dto = MerchantDTO.fromDocument(merchant);

    return res
      .status(200)
      .json(ApiResponse.success(dto, isActive ? 'Comerciante ativado' : 'Comerciante desativado'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404
        ? ErrorResponse.notFound('Comerciante')
        : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// CATEGORIAS
// =========================================================
export const createCategory = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { name, description } = req.body;
    const category = await merchantService.createCategory(merchantId, { name, description });

    // Apply DTO transformation
    const dto = {
      id: category._id,
      name: category.name,
      description: category.description,
    };

    return res.status(201).json(ApiResponse.created(dto, 'Categoria criada com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

export const getCategories = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const categories = await merchantService.getCategories(merchantId);

    // Apply DTO transformation
    const dto = (categories || []).map((cat) => ({
      id: cat._id,
      name: cat.name,
      description: cat.description,
    }));

    return res.status(200).json(ApiResponse.list(dto, dto.length, 'Categorias recuperadas'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { merchantId, categoryId } = req.params;
    await merchantService.deleteCategory(merchantId, categoryId);

    return res
      .status(200)
      .json(
        ApiResponse.success(
          { deleted: true },
          'Categoria e todos os produtos removidos com sucesso',
        ),
      );
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// =========================================================
// PRODUTOS
// =========================================================
export const createProduct = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { schoolId, name, price, quantity, categoryName, img } = req.body;

    const product = await merchantService.createProduct(merchantId, {
      schoolId,
      name,
      price,
      quantity,
      categoryName,
      img,
    });

    // Apply DTO transformation
    const dto = {
      id: product._id,
      name: product.name,
      price: product.price,
      quantity: product.quantity,
      categoryName: product.categoryName,
    };

    return res.status(201).json(ApiResponse.created(dto, 'Produto criado com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

export const getProductByMerchant = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const products = await merchantService.getProductsByMerchant(merchantId);

    // Apply DTO transformation
    const dto = (products || []).map((p) => ({
      id: p._id,
      name: p.name,
      price: p.price,
      quantity: p.quantity,
      categoryName: p.categoryName,
    }));

    return res.status(200).json(ApiResponse.list(dto, dto.length, 'Produtos recuperados'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

export const updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const { name, price, quantity, categoryName, img, isActive } = req.body;

    const result = await merchantService.updateProduct(productId, {
      name,
      price,
      quantity,
      categoryName,
      img,
      isActive,
    });

    if (result.unchanged) {
      return res
        .status(200)
        .json(ApiResponse.success({ unchanged: true }, 'Nenhuma alteração detectada'));
    }

    // Apply DTO transformation
    const dto = {
      id: result.product._id,
      name: result.product.name,
      price: result.product.price,
      quantity: result.product.quantity,
      categoryName: result.product.categoryName,
    };

    return res.status(200).json(ApiResponse.success(dto, 'Produto atualizado com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    await merchantService.deleteProduct(productId);
    return res
      .status(200)
      .json(ApiResponse.success({ deleted: true }, 'Produto deletado com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// =========================================================
// ALTERAR SENHA
// =========================================================
export const changePassword = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (String(merchantId) !== String(req.user._id)) {
      return res.status(403).json(ErrorResponse.forbidden('Não autorizado'));
    }

    await merchantService.changeMerchantPassword(merchantId, { currentPassword, newPassword });

    await writeAuditLog({
      userId: merchantId,
      userModel: 'Merchant',
      action: 'MERCHANT_PASSWORD_CHANGED',
      entity: 'Merchant',
      entityId: merchantId,
      status: 'success',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    return res
      .status(200)
      .json(ApiResponse.success({ success: true }, 'Senha atualizada com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 400
        ? ErrorResponse.badRequest(error.message)
        : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};
