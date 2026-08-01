/**
 * ============================================
 * FINANCE SERVICE (MARKED INTERNAL)
 * ============================================
 *
 * ⚠️ INTERNAL USE ONLY ⚠️
 *
 * This module is for FinancialOrchestrator internal use.
 * DO NOT import directly from services or controllers.
 *
 * All external money operations MUST use FinancialOrchestrator
 *
 * @version 2.0
 */

import mongoose from 'mongoose';
import Wallet from '../models/wallet.js';
import Transaction from '../models/transaction.js';
import { financialEnforcement } from '../core/index.js';

const getWallet = async (ownerId, ownerType, session) => {
  const model = ownerType === 'Merchant' ? 'Merchant' : ownerType === 'School' ? 'School' : 'User';

  const wallet = await Wallet.findOne({ ownerId, ownerModel: model }).session(session);
  return wallet;
};

/**
 * ⚠️ INTERNAL ONLY - For FinancialOrchestrator use
 *
 * Processa transação entre carteiras
 * Uses FinancialEnforcement for protection
 *
 * @param {Object} options
 * @param {mongoose.ClientSession} [session] opcional, para usar transação externa
 */
export const processTransaction = async ({
  senderId,
  senderType = 'User',
  receiverId,
  receiverType = 'User',
  rupeReference,
  externalReference,
  amount,
  type,
  description,
  session: externalSession = null,
}) => {
  // ENFORCEMENT: Verify orchestrator context
  if (!financialEnforcement.canPerformFinancialOperation()) {
    throw new Error(
      'FORBIDDEN: processTransaction is internal to FinancialOrchestrator. ' +
        'Use FinancialOrchestrator.execute() instead.',
    );
  }

  const session = externalSession || (await mongoose.startSession());

  try {
    if (!externalSession) session.startTransaction();
    if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
      throw new Error('Valor de transacao invalido');
    }

    // Idempotencia: evita debito/credito duplicado para a mesma referencia.
    const transactionReference = externalReference || rupeReference || null;
    if (transactionReference) {
      const existingTransaction = await Transaction.findOne({
        externalReference: transactionReference,
      }).session(session);

      if (existingTransaction) {
        if (!externalSession) {
          await session.commitTransaction();
          session.endSession();
        }
        return existingTransaction;
      }
    }

    const senderWallet = await getWallet(senderId, senderType, session);
    const receiverWallet = await getWallet(receiverId, receiverType, session);

    if (!senderWallet || !receiverWallet) throw new Error('Carteira não encontrada');

    if (senderWallet.balance < amount) throw new Error('Saldo insuficiente');

    // ✅ ENFORCED: Uses enforcement context from Orchestrator
    senderWallet.debit(amount);
    receiverWallet.credit(amount);

    await senderWallet.save({ session });
    await receiverWallet.save({ session });

    // Cria a transação
    const transaction = await Transaction.create(
      [
        {
          senderId,
          senderType,
          receiverId,
          receiverType,
          amount,
          type,
          description: description || 'Pagamento de Factura',
          rupeReference,
          externalReference: transactionReference,
          status: 'completed',
        },
      ],
      { session },
    );

    // Marca direction para front sem recalcular
    transaction[0]._userId = senderId;
    transaction[0].direction = 'outgoing';

    if (!externalSession) {
      await session.commitTransaction();
      session.endSession();
    }

    return transaction[0];
  } catch (error) {
    if (!externalSession) {
      await session.abortTransaction();
      session.endSession();
    }
    throw error;
  }
};
