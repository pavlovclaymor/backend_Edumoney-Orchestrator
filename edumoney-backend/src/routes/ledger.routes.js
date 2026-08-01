/**
 * Ledger Routes
 * Routes for ledger operations and investigation
 */

import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import {
  getEntriesByUser,
  getCalculatedBalance,
  checkConsistency,
  findAllInconsistencies,
} from '../services/ledger.service.js';

const router = express.Router();

/**
 * GET /admin/ledger/user/:userId/entries
 * Get ledger entries for a user
 */
router.get('/user/:userId/entries', protect, authorize('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, skip = 0, startDate, endDate } = req.query;

    const entries = await getEntriesByUser(userId, {
      limit: Number(limit),
      skip: Number(skip),
      startDate,
      endDate,
    });

    return res.status(200).json({
      entries: entries.map((e) => ({
        id: e._id,
        transactionId: e.transactionId,
        userId: e.userId,
        type: e.type,
        amount: e.amount,
        balanceAfter: e.balanceAfter,
        createdAt: e.createdAt,
      })),
      limit: Number(limit),
      skip: Number(skip),
    });
  } catch (error) {
    console.error('Erro ao buscar entradas do ledger:', error);
    return res.status(500).json({ message: 'Erro interno ao buscar entradas' });
  }
});

/**
 * GET /admin/ledger/user/:userId/balance
 * Get calculated balance from ledger for a user
 */
router.get('/user/:userId/balance', protect, authorize('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { walletBalance } = req.query;

    const ledgerBalance = await getCalculatedBalance(userId);

    // If wallet balance provided, check consistency
    if (walletBalance !== undefined) {
      const consistency = await checkConsistency(userId, Number(walletBalance));
      return res.status(200).json(consistency);
    }

    return res.status(200).json(ledgerBalance);
  } catch (error) {
    console.error('Erro ao buscar saldo:', error);
    return res.status(500).json({ message: 'Erro interno ao buscar saldo' });
  }
});

/**
 * GET /admin/ledger/user/:userId/verification
 * Verify ledger vs wallet consistency for a user
 */
router.get('/user/:userId/verification', protect, authorize('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const Wallet = (await import('../models/wallet.js')).default;

    const wallet = await Wallet.findOne({ ownerId: userId }).lean();

    if (!wallet) {
      return res.status(404).json({ message: 'Wallet não encontrada' });
    }

    const verification = await checkConsistency(userId, wallet.balance);

    return res.status(200).json({
      wallet: {
        walletId: wallet._id,
        ownerId: wallet.ownerId,
        balance: wallet.balance,
        currency: wallet.currency || 'AOA',
        isFrozen: wallet.isFrozen,
      },
      ledger: {
        totalCredits: verification.totalCredits,
        totalDebits: verification.totalDebits,
        calculatedBalance: verification.calculatedBalance,
      },
      verification: {
        isConsistent: verification.isConsistent,
        difference: verification.difference,
        status: verification.status,
      },
    });
  } catch (error) {
    console.error('Erro ao verificar consistência:', error);
    return res.status(500).json({ message: 'Erro interno ao verificar' });
  }
});

/**
 * GET /admin/ledger/inconsistencies
 * Find all ledger/wallet inconsistencies
 */
router.get('/inconsistencies', protect, authorize('admin'), async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const inconsistencies = await findAllInconsistencies();

    return res.status(200).json({
      inconsistencies: inconsistencies.slice(0, Number(limit)),
      total: inconsistencies.length,
      limit: Number(limit),
    });
  } catch (error) {
    console.error('Erro ao buscar inconsistências:', error);
    return res.status(500).json({ message: 'Erro interno ao buscar inconsistências' });
  }
});

/**
 * GET /admin/ledger/transaction/:transactionId
 * Get ledger entries for a transaction
 */
router.get('/transaction/:transactionId', protect, authorize('admin'), async (req, res) => {
  try {
    const { transactionId } = req.params;
    const Ledger = (await import('../models/ledger.model.js')).default;

    const entries = await Ledger.find({ transactionId }).populate('userId', 'name email').lean();

    return res.status(200).json({
      entries: entries.map((e) => ({
        id: e._id,
        transactionId: e.transactionId,
        user: e.userId
          ? {
              id: e.userId._id,
              name: e.userId.name,
              email: e.userId.email,
            }
          : null,
        type: e.type,
        amount: e.amount,
        balanceAfter: e.balanceAfter,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar entradas da transação:', error);
    return res.status(500).json({ message: 'Erro interno ao buscar entradas' });
  }
});

/**
 * GET /admin/ledger/stats
 * Get ledger statistics
 */
router.get('/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const Ledger = (await import('../models/ledger.model.js')).default;

    const [totalEntries, creditStats, debitStats, recentEntries] = await Promise.all([
      Ledger.countDocuments(),
      Ledger.aggregate([
        { $match: { type: 'credit' } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
      Ledger.aggregate([
        { $match: { type: 'debit' } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
      Ledger.find().sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    return res.status(200).json({
      totalEntries,
      credits: {
        count: creditStats[0]?.count || 0,
        total: creditStats[0]?.total || 0,
      },
      debits: {
        count: debitStats[0]?.count || 0,
        total: debitStats[0]?.total || 0,
      },
      recentEntries: recentEntries.map((e) => ({
        id: e._id,
        transactionId: e.transactionId,
        userId: e.userId,
        type: e.type,
        amount: e.amount,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return res.status(500).json({ message: 'Erro interno ao buscar estatísticas' });
  }
});

export default router;
