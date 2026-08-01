/**
 * ============================================
 * WALLET SERVICE (MIGRATED)
 * ============================================
 *
 * Bank-Grade Financial System - Single Source of Truth
 *
 * MIGRATION STATUS: ✅ COMPLETE
 * All financial operations now use FinancialOrchestrator
 */

import Wallet from '../models/wallet.js';
import mongoose from 'mongoose';
import { FinancialOrchestrator, TRANSACTION_TYPE } from '../core/index.js';

/**
 * Obter wallet por owner
 * @param {string} userId - ID do dono
 * @param {string} model - Modelo do dono (User, School, Merchant)
 * @returns {Object} wallet
 */
export const getWallet = async (userId, model) => {
  const wallet = await Wallet.findOne({ ownerId: userId, ownerModel: model });

  if (!wallet) {
    throw Object.assign(new Error('Wallet not found'), { status: 404 });
  }

  return wallet;
};

/**
 * Adicionar saldo (recarga)
 * MIGRADO: Usa FinancialOrchestrator para operações financeiras
 * @param {string} userId - ID do usuário
 * @param {number} amount - Valor da recarga
 * @returns {Object} { newBalance }
 */
export const addBalance = async (userId, amount) => {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw Object.assign(new Error('Valor inválido para recarga'), { status: 400 });
  }

  const wallet = await Wallet.findOne({ ownerId: userId, ownerModel: 'User' });

  if (!wallet) {
    throw Object.assign(new Error('Carteira não encontrada'), { status: 404 });
  }

  // MIGRADO: Usar FinancialOrchestrator para recarga
  const result = await FinancialOrchestrator.execute({
    type: TRANSACTION_TYPE.RECHARGE,
    payload: {
      userId,
      amount: numericAmount,
    },
  });

  return { newBalance: result.wallet.balance };
};

/**
 * Verificar acesso à wallet
 * @param {string} actorId - ID do ator
 * @param {string} actorModel - Modelo do ator
 * @param {string} userId - ID do dono da wallet
 * @param {string} model - Modelo do dono
 * @returns {boolean}
 */
export const canAccessWallet = (actorId, actorModel, userId, model) => {
  return actorId === userId && actorModel === model;
};
