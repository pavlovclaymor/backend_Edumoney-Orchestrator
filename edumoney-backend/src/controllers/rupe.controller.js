import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';
import { RupeDTO } from '../utils/dto/rupe.dto.js';
import Rupe from '../models/rupe.model.js';
import ServicePrice from '../models/servicePrice.model.js';
import { generateRUPE } from '../utils/rupeSimulator.js';
import mongoose from 'mongoose';
import User from '../models/user.model.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import {
  validateAccountActivation,
  validateServiceActive,
  validateStockAvailable,
} from '../services/accountValidation.service.js';

const verifyClass = (turma) => true;

/**
 * Creates or returns a pending RUPE for a user
 */
export const createRupe = async (userId, schoolId, tipoServico, req = null) => {
  let auditMetadata = {};

  try {
    const existingRupe = await Rupe.findOne({
      userId,
      schoolId,
      tipoServico,
      estado: 'PENDENTE',
    });

    if (existingRupe) {
      return existingRupe;
    }

    const serviceCheck = await validateServiceActive(schoolId, tipoServico);
    if (!serviceCheck.active) {
      auditMetadata.blockedReason = 'service_inactive';
      await writeAuditLog({
        userId,
        userModel: 'User',
        action: 'RUPE_REQUEST_BLOCKED',
        entity: 'Rupe',
        entityId: null,
        status: 'failed',
        schoolId,
        ip: req?.ip || null,
        userAgent: req?.headers?.['user-agent'] || null,
        metadata: auditMetadata,
      }).catch(() => {});
      throw new Error(serviceCheck.message);
    }

    const stockCheck = await validateStockAvailable(schoolId, tipoServico);
    if (!stockCheck.hasStock) {
      auditMetadata.blockedReason = 'insufficient_stock';
      await writeAuditLog({
        userId,
        userModel: 'User',
        action: 'RUPE_REQUEST_BLOCKED',
        entity: 'Rupe',
        entityId: null,
        status: 'failed',
        schoolId,
        ip: req?.ip || null,
        userAgent: req?.headers?.['user-agent'] || null,
        metadata: auditMetadata,
      }).catch(() => {});
      throw new Error(stockCheck.message);
    }

    const accountCheck = await validateAccountActivation(userId);
    if (!accountCheck.activated) {
      auditMetadata.blockedReason = 'account_not_activated';
      await writeAuditLog({
        userId,
        userModel: 'User',
        action: 'RUPE_REQUEST_BLOCKED',
        entity: 'Rupe',
        entityId: null,
        status: 'failed',
        schoolId,
        ip: req?.ip || null,
        userAgent: req?.headers?.['user-agent'] || null,
        metadata: auditMetadata,
      }).catch(() => {});
      throw new Error(accountCheck.message);
    }

    if (tipoServico === 'CERTIFICADO') {
      const user = await User.findById(userId);
      if (!user) throw new Error('Utilizador não encontrado');
      if (!verifyClass(user.turma)) {
        throw new Error('Classe não autorizada para gerar RUPE para pagar certificado');
      }
    }

    let referencia;
    let exists = true;
    while (exists) {
      referencia = generateRUPE();
      const rupeExists = await Rupe.findOne({ referencia });
      exists = !!rupeExists;
    }

    const servicePrice = await ServicePrice.findOne({ schoolId, tipoServico });
    if (!servicePrice) {
      throw new Error('Serviço não disponível. A escola ainda não definiu o preço.');
    }

    const rupe = await Rupe.create({
      userId,
      schoolId,
      tipoServico,
      valor: servicePrice.valor,
      referencia,
      estado: 'PENDENTE',
      quantidade: servicePrice.quantidade,
    });

    await writeAuditLog({
      userId,
      userModel: 'User',
      action: 'RUPE_REQUEST_SUCCESS',
      entity: 'Rupe',
      entityId: rupe._id,
      status: 'success',
      schoolId,
      ip: req?.ip || null,
      userAgent: req?.headers?.['user-agent'] || null,
      metadata: {
        rupeReference: referencia,
        tipoServico,
        valor: rupe.valor,
      },
    }).catch(() => {});

    return rupe;
  } catch (error) {
    console.error('[RupeController] Error in createRupe:', error.message);
    throw error;
  }
};

/**
 * POST /api/rupe/create
 * Cria RUPE para o usuário
 */
export const sendRupeCallback = async (req, res) => {
  const { tipoServico } = req.body;
  const userId = req.user?._id;
  const schoolId = req.user?.schoolId;

  if (!userId || !schoolId || !tipoServico) {
    return res.status(400).json(ErrorResponse.badRequest('Dados incompletos'));
  }

  try {
    const existing = await Rupe.findOne({
      userId,
      schoolId,
      tipoServico,
      estado: 'PENDENTE',
    });

    if (existing) {
      const dto = RupeDTO.fromRupe(existing);
      return res
        .status(200)
        .json(ApiResponse.success(dto, 'Já existe um RUPE pendente para este serviço'));
    }

    const rupe = await createRupe(userId, schoolId, tipoServico, req);
    const dto = RupeDTO.fromRupe(rupe);

    return res.status(201).json(ApiResponse.success(dto, 'RUPE criado com sucesso'));
  } catch (error) {
    await writeAuditLog({
      userId,
      userModel: 'User',
      action: 'RUPE_REQUEST_FAILED',
      entity: 'Rupe',
      entityId: null,
      status: 'failed',
      schoolId,
      ip: req?.ip || null,
      userAgent: req?.headers?.['user-agent'] || null,
      metadata: { error: error.message },
    }).catch(() => {});

    const status = error.status || 400;
    return res.status(status).json(ErrorResponse.badRequest(error.message));
  }
};

/**
 * GET /api/rupe/pending/:schoolId
 * Lista RUPEs pendentes da escola
 */
export const PendingRupe = async (req, res) => {
  try {
    const { schoolId } = req.params;

    if (req.user?._id?.toString() !== schoolId) {
      return res.status(403).json(ErrorResponse.forbidden('Acesso negado'));
    }

    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json(ErrorResponse.badRequest('schoolId inválido'));
    }

    const schoolObjectId = new mongoose.Types.ObjectId(schoolId);
    const rupes = await Rupe.find({
      schoolId: schoolObjectId,
      estado: 'PENDENTE',
    });

    const totalPendente = rupes.reduce((acc, rupe) => acc + rupe.valor, 0);
    const dto = RupeDTO.pendingSummary(rupes, totalPendente);

    return res.status(200).json(ApiResponse.success(dto, 'RUPEs pendentes recuperados'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};
