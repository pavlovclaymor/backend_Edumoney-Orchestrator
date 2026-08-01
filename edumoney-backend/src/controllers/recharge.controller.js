/**
 * Recharge Controller
 * Delega toda a lógica de negócio para o service
 *
 * Uses Contract-First pattern:
 * - DTO for data transformation
 * - ResponseWrapper for standardization
 */

import mongoose from 'mongoose';
import Recharge from '../models/recharge.model.js';
import Wallet from '../models/wallet.js';
import { generateRUPE, simulateRupePayment } from '../utils/rupeSimulator.js';
import { getIO } from '../services/socket.service.js';
import { FinancialOrchestrator, TRANSACTION_TYPE } from '../core/index.js';
import { RechargeDTO } from '../utils/dto/index.js';
import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';

/*
========================================
SOLICITAR RECARGA
========================================
*/
export const requestRecharge = async (req, res) => {
  try {
    const { walletId, schoolId, amount } = req.body;
    const userId = req.user?._id;

    if (!userId || !schoolId || !amount) {
      return res.status(400).json(ErrorResponse.badRequest('Todos os campos são obrigatórios'));
    }
    if (amount <= 0) {
      return res
        .status(400)
        .json(ErrorResponse.badRequest('O valor da recarga deve ser maior que 0'));
    }

    // Verifica se já existe um RUPE pendente
    const pendingRecharge = await Recharge.findOne({
      userId,
      status: 'pending',
    });
    if (pendingRecharge) {
      // Apply DTO transformation
      const dto = RechargeDTO.forPending(pendingRecharge);
      return res
        .status(200)
        .json(
          ApiResponse.success({ recharge: dto, hasPending: true }, 'Você já tem um RUPE pendente'),
        );
    }

    const wallet = await Wallet.findOne({
      _id: walletId || req.user?.walletId,
      ownerId: userId,
      ownerModel: 'User',
    });
    if (!wallet) {
      return res.status(404).json(ErrorResponse.notFound('Carteira'));
    }

    // Gera nova referência RUPE
    const rupeReference = generateRUPE();

    const recharge = await Recharge.create({
      userId,
      walletId: wallet._id,
      schoolId,
      amount,
      rupeReference,
      status: 'pending',
    });

    const paymentLink = `https://rupe-sandbox.gateway/pay?ref=${rupeReference}&amount=${amount}`;

    // Apply DTO transformation
    const dto = RechargeDTO.fromDocument(recharge);
    dto.paymentLink = paymentLink;

    return res
      .status(201)
      .json(ApiResponse.created({ ...dto, paymentLink }, 'RUPE gerado com sucesso'));
  } catch (err) {
    console.error('Erro ao solicitar recarga:', err);
    return res.status(500).json(ErrorResponse.internal(err.message));
  }
};

// GET /recharge/pending?userId=...
export const getPendingRecharge = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(400).json(ErrorResponse.badRequest('userId é obrigatório'));
    }

    const pendingRecharge = await Recharge.findOne({
      userId,
      status: 'pending',
    });

    // Apply DTO transformation
    const dto = pendingRecharge ? RechargeDTO.forPending(pendingRecharge) : null;

    return res.status(200).json(ApiResponse.success({ recharge: dto }, 'RUPE pendente'));
  } catch (err) {
    console.error('Erro ao buscar RUPE pendente:', err);
    return res.status(500).json(ErrorResponse.internal(err.message));
  }
};

/*
========================================
CONFIRMAR RECARGA (CALLBACK RUPE)
========================================
*/
export const confirmRecharge = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { rupeReference } = req.body;
    if (!rupeReference) {
      await session.abortTransaction();
      return res.status(400).json(ErrorResponse.badRequest('rupeReference é obrigatório'));
    }

    const recharge = await Recharge.findOne({ rupeReference }).session(session);
    if (!recharge) {
      await session.abortTransaction();
      return res.status(404).json(ErrorResponse.notFound('Recarga'));
    }

    if (req.user?.role === 'student' && recharge.userId.toString() !== req.user._id.toString()) {
      await session.abortTransaction();
      return res.status(403).json(ErrorResponse.forbidden('Acesso negado'));
    }

    // Idempotência
    if (recharge.status !== 'pending' || recharge.callbackReceived) {
      await session.abortTransaction();
      // Apply DTO transformation
      const dto = RechargeDTO.fromDocument(recharge);
      return res
        .status(200)
        .json(
          ApiResponse.success(
            { ...dto, alreadyProcessed: true },
            'Pagamento já processado anteriormente',
          ),
        );
    }

    const status = await simulateRupePayment(rupeReference, recharge.amount);

    if (status === 'success') {
      recharge.status = 'paid';
    } else {
      recharge.status = 'failed';
    }

    recharge.callbackReceived = true;
    await recharge.save({ session });

    const wallet = await Wallet.findById(recharge.walletId).session(session);
    if (!wallet) {
      await session.abortTransaction();
      return res.status(404).json(ErrorResponse.notFound('Carteira'));
    }

    // MIGRADO: Usar FinancialOrchestrator para operações financeiras
    if (status === 'success') {
      await FinancialOrchestrator.execute({
        type: TRANSACTION_TYPE.RECHARGE,
        payload: {
          userId: recharge.userId,
          rechargeId: recharge._id,
          amount: recharge.amount,
        },
        session,
      });
    }

    await session.commitTransaction();
    session.endSession();

    try {
      const io = getIO();
      if (recharge?.userId && status === 'success') {
        io.to(recharge.userId.toString()).emit('recharge:completed', recharge);
        io.to(recharge.userId.toString()).emit('wallet:updated');
      }
    } catch (socketErr) {
      console.error('Socket error on confirmRecharge', socketErr);
    }

    // Apply DTO transformation
    const dto = RechargeDTO.fromDocument(recharge);

    return res.status(200).json(
      ApiResponse.success(
        {
          ...dto,
          credited: status === 'success' ? recharge.amount : 0,
        },
        status === 'success'
          ? 'Recarga confirmada e saldo adicionado com sucesso'
          : 'Pagamento falhou',
      ),
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Erro ao confirmar recarga:', err);
    return res.status(500).json(ErrorResponse.internal(err.message));
  }
};

/*
========================================
CANCELAR RUPE
========================================
*/
export const cancelRupe = async (req, res) => {
  try {
    const { rupeReference } = req.body;
    if (!rupeReference) {
      return res.status(400).json(ErrorResponse.badRequest('rupeReference é obrigatório'));
    }

    const recharge = await Recharge.findOne({
      rupeReference,
      status: 'pending',
    });
    if (!recharge) {
      return res.status(404).json(ErrorResponse.notFound('RUPE pendente'));
    }

    if (recharge.userId.toString() !== req.user?._id?.toString()) {
      return res.status(403).json(ErrorResponse.forbidden('Acesso negado'));
    }

    recharge.status = 'cancelled';
    recharge.callbackReceived = true;
    await recharge.save();

    return res
      .status(200)
      .json(ApiResponse.success({ rupeReference }, 'RUPE cancelado com sucesso'));
  } catch (err) {
    console.error('Erro ao cancelar RUPE:', err);
    return res.status(500).json(ErrorResponse.internal(err.message));
  }
};
