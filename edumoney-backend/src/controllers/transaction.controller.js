/**
 * Transaction Controller
 * Delega toda a lógica de negócio para transaction.service.js
 * O controller apenas recebe req/res e passa para o service.
 */

import mongoose from 'mongoose';
import * as transactionService from '../services/transaction.service.js';
import { getIO } from '../services/socket.service.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { TransactionDTO } from '../utils/dto/index.js';
import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';

// =========================================================
// CRIAR TRANSAÇÃO (TRANSFERÊNCIA)
// =========================================================
export const createTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { processNumber, email, amount, description, pin } = req.body;
    const senderId = req.user?._id;

    // 1. Chamar service (lógica de negócio)
    const result = await transactionService.createTransfer(
      { processNumber, email, amount, description, pin, senderId },
      session,
    );

    // 2. Commit da transação
    await session.commitTransaction();
    session.endSession();

    // 3. Socket events (após commit)
    try {
      const io = getIO();
      if (result.senderId) {
        io.to(result.senderId.toString()).emit('transaction:completed', result.transaction);
        io.to(result.senderId.toString()).emit('wallet:updated');
      }
      if (result.receiverId) {
        io.to(result.receiverId.toString()).emit('transaction:completed', result.transaction);
        io.to(result.receiverId.toString()).emit('wallet:updated');
      }
    } catch (socketErr) {
      console.error('Socket error on createTransaction', socketErr);
    }

    // 4. Preparar resposta com DTO
    result.transaction.direction = 'outgoing';
    const dto = TransactionDTO.forDetail(result.transaction);

    // 5. Audit log
    await writeAuditLog({
      userId: result.senderId,
      userModel: 'User',
      action: 'TRANSFER_COMPLETED',
      entity: 'Transaction',
      entityId: result.transaction._id,
      status: 'success',
      schoolId: req.user?.schoolId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        amount: result.amount,
        receiverId: result.receiverId,
        receiverName: result.receiverName,
      },
    }).catch(() => {});

    return res.status(201).json(ApiResponse.created(dto, 'Transação realizada com sucesso'));
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    // Audit log de falha
    await writeAuditLog({
      userId: req.user?._id,
      userModel: 'User',
      action: 'TRANSFER_FAILED',
      entity: 'Transaction',
      entityId: null,
      status: 'failed',
      schoolId: req.user?.schoolId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { error: error.message },
    }).catch(() => {});

    const status = error.status || 500;
    const errorResponse =
      status === 401
        ? ErrorResponse.unauthorized(error.message)
        : status === 400
          ? ErrorResponse.badRequest(error.message)
          : status === 404
            ? ErrorResponse.notFound('Usuário')
            : ErrorResponse.internal(error.message);

    return res.status(status).json(errorResponse);
  }
};

// =========================================================
// OBTER TRANSAÇÕES DO USUÁRIO
// =========================================================
export const getTransactionByUser = async (req, res) => {
  try {
    const userId = req.user?._id?.toString();

    const transactions = await transactionService.getTransactionsByUser(userId);

    // Apply DTO transformation
    const dtos = TransactionDTO.fromArray(transactions);

    return res.status(200).json(ApiResponse.list(dtos, null, 'Transações recuperadas'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};
