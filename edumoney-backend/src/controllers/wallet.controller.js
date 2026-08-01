/**
 * Wallet Controller
 * Delega toda a lógica de negócio para wallet.service.js
 * CRÍTICO: Módulo financeiro - requer testes rigorosos.
 *
 * Uses Contract-First pattern:
 * - DTO for data transformation
 * - ResponseWrapper for standardization
 */

import * as walletService from '../services/wallet.service.js';
import mongoose from 'mongoose';
import { WalletDTO } from '../utils/dto/index.js';
import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';

// =========================================================
// OBTER WALLET
// =========================================================
export const getWallet = async (req, res) => {
  try {
    const { userId, model } = req.params;
    const actorId = req.user?._id?.toString();
    const actorModel = req.userModel;

    if (!actorId || !actorModel) {
      return res.status(401).json(ErrorResponse.unauthorized('Não autenticado'));
    }

    if (!walletService.canAccessWallet(actorId, actorModel, userId, model)) {
      return res.status(403).json(ErrorResponse.forbidden('Acesso negado a carteira'));
    }

    const wallet = await walletService.getWallet(userId, model);

    // Apply DTO transformation
    const dto = WalletDTO.fromDocument(wallet);

    return res.status(200).json(ApiResponse.success(dto, 'Wallet retrieved'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404 ? ErrorResponse.notFound('Wallet') : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// ADICIONAR SALDO (RECARGA)
// =========================================================
export const addBalance = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { amount } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json(ErrorResponse.unauthorized('Não autenticado'));
    }

    const result = await walletService.addBalance(userId, amount);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json(
      ApiResponse.success(
        {
          newBalance: result.newBalance,
        },
        'Saldo adicionado com sucesso',
      ),
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    const status = error.status || 500;
    const errResponse =
      status === 400
        ? ErrorResponse.badRequest(error.message)
        : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};
