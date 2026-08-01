/**
 * ============================================
 * TRANSACTION SERVICE (MIGRATED)
 * ============================================
 *
 * Bank-Grade Financial System - Single Source of Truth
 *
 * MIGRATION STATUS: ✅ COMPLETE
 * All financial operations now use FinancialOrchestrator
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import Transaction from '../models/transaction.js';
import Wallet from '../models/wallet.js';
import User from '../models/user.model.js';
import { FinancialOrchestrator, TRANSACTION_TYPE } from '../core/index.js';

/**
 * Criar transação (transferência entre estudantes)
 * @param {Object} data - Dados de entrada { processNumber, email, amount, description, pin, senderId }
 * @param {Object} session - Sessão mongoose para transação
 * @returns {Object} Resultado da operação
 */
export const createTransfer = async (data, session) => {
  const { processNumber, email, amount, description, pin, senderId } = data;

  // 1. Validações de entrada
  if (!senderId || (!processNumber && !email) || !amount || !pin) {
    throw Object.assign(new Error('Dados incompletos'), { status: 400 });
  }

  const numericAmount = Number(amount);
  if (numericAmount <= 0) {
    throw Object.assign(new Error('Valor inválido'), { status: 400 });
  }

  // 2. Buscar remetente COM PIN
  const sender = await User.findById(senderId).select('+pin').session(session);

  if (!sender) {
    throw Object.assign(new Error('Remetente não encontrado'), { status: 404 });
  }

  // 3. Validar PIN
  const isMatch = await bcrypt.compare(pin, sender.pin);
  if (!isMatch) {
    throw Object.assign(new Error('PIN incorreto'), { status: 401 });
  }

  // 4. Buscar destinatário
  let receiver;
  if (processNumber) {
    receiver = await User.findOne({ processNumber }).session(session);
  } else {
    receiver = await User.findOne({ email }).session(session);
  }

  if (!receiver) {
    throw Object.assign(new Error('Destinatário não encontrado'), { status: 404 });
  }

  // 5. Não transferir para si mesmo
  if (sender._id.toString() === receiver._id.toString()) {
    throw Object.assign(new Error('Não podes transferir para ti mesmo'), { status: 400 });
  }

  // 6. Apenas estudantes
  if (sender.role !== 'student' || receiver.role !== 'student') {
    throw Object.assign(new Error('Apenas estudantes podem transferir'), { status: 403 });
  }

  // 7. Mesma escola
  if (sender.schoolId.toString() !== receiver.schoolId.toString()) {
    throw Object.assign(new Error('Transferências apenas dentro da mesma escola'), { status: 403 });
  }

  // 8. Buscar carteiras
  const senderWallet = await Wallet.findOne({
    ownerId: sender._id,
    ownerModel: 'User',
  }).session(session);

  const receiverWallet = await Wallet.findOne({
    ownerId: receiver._id,
    ownerModel: 'User',
  }).session(session);

  if (!senderWallet || !receiverWallet) {
    throw Object.assign(new Error('Carteira não encontrada'), { status: 404 });
  }

  // 9. Saldo insuficiente
  if (senderWallet.balance < numericAmount) {
    throw Object.assign(new Error('Saldo insuficiente'), { status: 400 });
  }

  // 10. MIGRADO: Executar transferência via FinancialOrchestrator
  const result = await FinancialOrchestrator.execute({
    type: TRANSACTION_TYPE.TRANSFER,
    payload: {
      senderId: sender._id,
      receiverId: receiver._id,
      amount: numericAmount,
      description: description || 'Transferência EDUMONEY',
    },
    session,
  });

  // 11. Retornar resultado estruturado
  return {
    transaction: result.transaction,
    senderId: sender._id,
    senderName: sender.name,
    receiverId: receiver._id,
    receiverName: receiver.name,
    amount: numericAmount,
    session,
  };
};

/**
 * Obter transações de um usuário
 * @param {string} userId - ID do usuário
 * @returns {Array} Lista de transações
 */
export const getTransactionsByUser = async (userId) => {
  if (!userId) {
    throw Object.assign(new Error('ID do usuário é obrigatório'), { status: 400 });
  }

  const transactions = await Transaction.find({
    $or: [{ senderId: userId }, { receiverId: userId }],
  })
    .populate('senderId', 'name email role walletId')
    .populate('receiverId', 'name email role walletId')
    .sort({ createdAt: -1 });

  // Mapear resultado com direção
  const result = transactions.map((tx) => {
    const obj = tx.toObject();
    const isSender = tx.senderId?._id?.toString() === userId?.toString();
    obj.direction = isSender ? 'outgoing' : 'incoming';
    obj.isSender = isSender;
    return obj;
  });

  return result;
};

/**
 * Obter uma transação por ID
 * @param {string} transactionId - ID da transação
 * @returns {Object} Transação encontrada
 */
export const getTransactionById = async (transactionId) => {
  if (!transactionId) {
    throw Object.assign(new Error('ID da transação é obrigatório'), { status: 400 });
  }

  const transaction = await Transaction.findById(transactionId)
    .populate('senderId', 'name email role walletId')
    .populate('receiverId', 'name email role walletId');

  if (!transaction) {
    throw Object.assign(new Error('Transação não encontrada'), { status: 404 });
  }

  return transaction;
};
