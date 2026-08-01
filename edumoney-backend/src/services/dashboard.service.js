import mongoose from 'mongoose';
import Merchant from '../models/merchant.model.js';
import School from '../models/school.model.js';
import Transaction from '../models/transaction.js';
import CertificateLog from '../models/certificateLog.model.js';

/**
 * Dashboard Service
 * Provides lightweight, request-time financial metrics and aggregations.
 * All metrics are computed on demand - no persistent analytics or streaming.
 */

/**
 * Get financial metrics for a school
 * Computed from current database state at request time
 */
export const getFinancialMetrics = async (schoolId) => {
  try {
    const schoolId_obj = new mongoose.Types.ObjectId(schoolId);

    // Parallel aggregations for performance
    const [totalBalance, transactionStats] = await Promise.all([
      // Get school's wallet balance
      School.findById(schoolId)
        .select('walletId')
        .populate({
          path: 'walletId',
          select: 'balance',
        })
        .lean(),

      // Get transaction statistics
      Transaction.aggregate([
        { $match: { schoolId: schoolId_obj } },
        {
          $group: {
            _id: null,
            totalTransactions: { $count: 'count' },
            totalAmount: { $sum: '$amount' },
            avgAmount: { $avg: '$amount' },
          },
        },
      ]),
    ]);

    const balance = totalBalance?.walletId?.balance || 0;
    const stats = transactionStats[0] || { totalTransactions: 0, totalAmount: 0, avgAmount: 0 };

    // FASE 8.5: Guarantee consistent response shape
    return {
      totalBalance: balance,
      totalTransactions: stats.totalTransactions || 0,
      totalAmount: stats.totalAmount || 0,
      averageTransaction: stats.avgAmount || 0,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get revenue data aggregated by date for chart
 */
export const getRevenueByDate = async (schoolId, startDate, endDate) => {
  try {
    const schoolId_obj = new mongoose.Types.ObjectId(schoolId);

    const revenue = await Transaction.aggregate([
      {
        $match: {
          schoolId: schoolId_obj,
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          total: { $sum: '$amount' },
          count: { $count: 'count' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // FASE 8.5: Guarantee array return
    if (!Array.isArray(revenue)) {
      return [];
    }

    // Format for charts
    return revenue.map((item) => ({
      date: item._id,
      amount: item.total || 0,
      transactions: item.count || 0,
    }));
  } catch (error) {
    throw error;
  }
};

/**
 * Get merchant statistics for a school
 */
export const getMerchantStats = async (schoolId) => {
  try {
    const merchants = await Merchant.find({ schoolId }).select('name isActive').lean();

    const activeMerchants = merchants.filter((m) => m.isActive).length;
    const totalMerchants = merchants.length;

    return {
      totalMerchants,
      activeMerchants,
      inactiveMerchants: totalMerchants - activeMerchants,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get certificate statistics for a school
 */
export const getCertificateRequestStats = async (schoolId) => {
  try {
    const schoolId_obj = new mongoose.Types.ObjectId(schoolId);

    const stats = await CertificateLog.aggregate([
      { $match: { schoolId: schoolId_obj } },
      {
        $group: {
          _id: null,
          totalRequests: { $count: 'count' },
          submitted: {
            $sum: { $cond: [{ $eq: ['$requestStatus', 'submitted'] }, 1, 0] },
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$requestStatus', 'completed'] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$requestStatus', 'failed'] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$requestStatus', 'pending'] }, 1, 0] },
          },
        },
      },
    ]);

    const data = stats[0] || {
      totalRequests: 0,
      submitted: 0,
      completed: 0,
      failed: 0,
      pending: 0,
    };

    return {
      totalRequests: data.totalRequests,
      byStatus: {
        submitted: data.submitted,
        completed: data.completed,
        failed: data.failed,
        pending: data.pending,
      },
      completionRate: data.totalRequests > 0 ? (data.completed / data.totalRequests) * 100 : 0,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get recent transactions for a school
 */
export const getRecentTransactions = async (schoolId, limit = 10) => {
  try {
    const transactions = await Transaction.find({ schoolId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return transactions;
  } catch (error) {
    throw error;
  }
};

/**
 * Get top merchants by transaction volume for a school
 */
export const getTopMerchants = async (schoolId, limit = 5) => {
  try {
    const schoolId_obj = new mongoose.Types.ObjectId(schoolId);

    const topMerchants = await Transaction.aggregate([
      { $match: { schoolId: schoolId_obj } },
      {
        $group: {
          _id: '$merchantId',
          totalAmount: { $sum: '$amount' },
          transactionCount: { $count: 'count' },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'merchants',
          localField: '_id',
          foreignField: '_id',
          as: 'merchant',
        },
      },
      {
        $unwind: '$merchant',
      },
      {
        $project: {
          _id: 0,
          merchantId: '$_id',
          merchantName: '$merchant.name',
          totalAmount: 1,
          transactionCount: 1,
        },
      },
    ]);

    return topMerchants;
  } catch (error) {
    throw error;
  }
};
