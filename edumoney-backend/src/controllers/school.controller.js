/**
 * School Controller
 * Delega toda a lógica de negócio para school.service.js
 *
 * Uses Contract-First pattern:
 * - DTO for data transformation
 * - ResponseWrapper for standardization
 */

import * as schoolService from '../services/school.service.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { WalletDTO, SchoolDTO, MerchantDTO } from '../utils/dto/index.js';
import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';

// =========================================================
// CRIAR ESCOLA
// =========================================================
export const createSchool = async (req, res) => {
  try {
    const { name, nif, address, password } = req.body;

    if (!name || !nif || !address || !password) {
      return res
        .status(400)
        .json(ErrorResponse.badRequest('Preencha todos os campos obrigatórios'));
    }
    const data = await schoolService.createSchool({ name, nif, address, password });
    // Apply DTO transformation
    const dto = SchoolDTO.fromDocument(data.school);

    await writeAuditLog({
      userId: dto.id,
      userModel: 'School',
      action: 'SCHOOL_CREATED',
      entity: 'School',
      entityId: dto.id,
      status: 'success',
      schoolId: dto.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { name: dto.name },
    }).catch(() => {});

    return res.status(201).json(ApiResponse.created(dto, 'Escola Criada com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 409
        ? ErrorResponse.conflict('Criar Escola')
        : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// ATUALIZAR ESCOLA
// =========================================================
export const UpdateSchool = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const userId = req.user?._id;

    if (!schoolId) {
      return res.status(400).json(ErrorResponse.badRequest('Id da escola não digitado'));
    }

    if (String(schoolId) !== String(userId)) {
      return res.status(403).json(ErrorResponse.forbidden('Não autorizado'));
    }

    const result = await schoolService.updateSchool(schoolId, req.body);
    // Apply DTO transformation
    const dto = SchoolDTO.fromDocument(result);
    await writeAuditLog({
      userId: dto.id,
      userModel: 'School',
      action: 'SCHOOL_UPDATED',
      entity: 'School',
      entityId: dto.id,
      status: 'success',
      schoolId: dto.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { name: dto.name },
    }).catch(() => {});

    return res.status(200).json(ApiResponse.success(dto, 'Escola actualizada com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404 ? ErrorResponse.notFound('SCHOOL') : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// OBTER UMA ESCOLA
// =========================================================
export const getOneSchool = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const school = await schoolService.getOneSchool(schoolId);
    // Apply DTO transformation
    const dto = SchoolDTO.fromDocument(school);

    return res.status(200).json(ApiResponse.ok(dto));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404 ? ErrorResponse.notFound('School') : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// LISTAR TODAS AS ESCOLAS
// =========================================================
export const getAllSchools = async (req, res) => {
  try {
    const schools = await schoolService.getAllSchools();
    // Apply DTO transformation
    const dto = SchoolDTO.fromArray(schools);
    return res.status(200).json(ApiResponse.ok(dto));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404 ? ErrorResponse.conflict('Schools') : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// OBTER WALLET DA ESCOLA
// =========================================================
export const getSchoolWallet = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const wallet = await schoolService.getSchoolWallet(schoolId);

    // Apply DTO transformation
    const dto = WalletDTO.fromDocument(wallet);

    return res.status(200).json(ApiResponse.success(dto, 'Carteira acessada com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404 ? ErrorResponse.notFound('Wallet') : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// LISTAR TURMAS DA ESCOLA
// =========================================================
export const getAllClasses = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const classes = await schoolService.getAllClasses(schoolId);

    return res.status(200).json(ApiResponse.ok(classes));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404 ? ErrorResponse.notFound('Turmas') : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// LISTAR COMERCIANTES DA ESCOLA
// =========================================================
export const getAllMerchantForSchool = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const merchants = await schoolService.getAllMerchantsForSchool(schoolId);
    const dto = MerchantDTO.fromArrayForList(merchants);

    return res.status(200).json(ApiResponse.success(dto, 'Comerciantes encontrados'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404
        ? ErrorResponse.notFound('Merchants for th school')
        : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// ADICIONAR FOLHAS IMPRESSAS
// =========================================================
export const addSheetsPrint = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity <= 0) {
      return res
        .status(400)
        .json(ErrorResponse.badRequest('Informe uma quantidade válida de folhas para adicionar'));
    }

    const result = await schoolService.addSheetsPrinted(schoolId, quantity);

    return res
      .status(200)
      .json(
        ApiResponse.created(result, `Foram adicionadas ${quantity} folhas de Prova no estoque.`),
      );
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 400
        ? ErrorResponse.badRequest('Folhas nao foram adicionadas')
        : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// OBTER FOLHAS IMPRESSAS
// =========================================================
export const getSheetsPrinted = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const result = await schoolService.getSheetsPrinted(schoolId);

    return res
      .status(200)
      .json(ApiResponse.success(result, 'Folhas impressas(Vendidas) Encontradas'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404
        ? ErrorResponse.notFound('Folhas Impressas')
        : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// ATUALIZAR TAXA DE SAQUE
// =========================================================
export const updateFeeRate = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { feeRate } = req.body;
    const userId = req.user?._id;

    if (String(schoolId) !== String(userId)) {
      return res.status(403).json(ErrorResponse.forbidden('Não autorizado'));
    }

    const result = await schoolService.updateFeeRate(schoolId, feeRate);

    return res
      .status(200)
      .json(ApiResponse.success(result, 'Taxa de saque atualizada com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 403
        ? ErrorResponse.forbidden('Actualizacao de Taxa de saque')
        : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// OBTER TAXA DE SAQUE
// =========================================================
export const getFeeRate = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const result = await schoolService.getFeeRate(schoolId);

    return res.status(200).json(ApiResponse.success(result, 'Fee rate retrieved'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404
        ? ErrorResponse.notFound('Erro ao pegar taxa de saque')
        : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// ALTERAR SENHA
// =========================================================
export const changePassword = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { currentPassword, newPassword } = req.body;

    await schoolService.changeSchoolPassword(schoolId, { currentPassword, newPassword });

    await writeAuditLog({
      userId: schoolId,
      userModel: 'School',
      action: 'SCHOOL_PASSWORD_CHANGED',
      entity: 'School',
      entityId: schoolId,
      status: 'success',
      schoolId: schoolId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    return res.status(200).json(ApiResponse.success(null, 'Senha alterada com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 409
        ? ErrorResponse.conflict('Actualizar senha')
        : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};
