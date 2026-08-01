/**
 * Admin DTO
 * Transforms admin-related MongoDB documents to API response format
 */

import {
  toSafeObject,
  toSafeArray,
  extractId,
  toISOString,
  toSafeNumber,
  toSafeString,
} from './base.dto.js';

/**
 * Transform user document for admin view
 * @param {Object} user - User MongoDB document
 * @returns {Object} User DTO for admin
 */
export const AdminDTO = {
  /**
   * User for admin view (full data)
   * @param {Object} user - User MongoDB document
   * @returns {Object} User DTO
   */
  userForAdmin: (user) => {
    if (!user) return null;

    return {
      id: extractId(user),
      name: toSafeString(user.name),
      email: toSafeString(user.email),
      role: toSafeString(user.role),
      isActive: Boolean(user.isActive),
      riskScore: toSafeNumber(user.riskScore, 0),
      suspendedAt: toISOString(user.suspendedAt),
      reactivatedAt: toISOString(user.reactivatedAt),
      createdAt: toISOString(user.createdAt),
      updatedAt: toISOString(user.updatedAt),
    };
  },

  /**
   * User list item (minimal data)
   * @param {Object} user - User MongoDB document
   * @returns {Object} Minimal user DTO
   */
  userListItem: (user) => {
    if (!user) return null;

    return {
      id: extractId(user),
      name: toSafeString(user.name),
      email: toSafeString(user.email),
      role: toSafeString(user.role),
      isActive: Boolean(user.isActive),
      riskScore: toSafeNumber(user.riskScore, 0),
    };
  },

  /**
   * User status for admin
   * @param {Object} user - User MongoDB document
   * @returns {Object} User status DTO
   */
  userStatus: (user) => {
    if (!user) return null;

    return {
      id: extractId(user),
      name: toSafeString(user.name),
      email: toSafeString(user.email),
      role: toSafeString(user.role),
      isActive: Boolean(user.isActive),
      riskScore: toSafeNumber(user.riskScore, 0),
      suspendedAt: toISOString(user.suspendedAt),
    };
  },

  /**
   * Wallet for admin view
   * @param {Object} wallet - Wallet MongoDB document
   * @returns {Object} Wallet DTO for admin
   */
  walletForAdmin: (wallet) => {
    if (!wallet) return null;

    return {
      id: extractId(wallet),
      ownerId: wallet.ownerId,
      ownerModel: toSafeString(wallet.ownerModel),
      balance: toSafeNumber(wallet.balance),
      currency: toSafeString(wallet.currency, 'AOA'),
      status: toSafeString(wallet.status, 'active'),
      isFrozen: Boolean(wallet.isFrozen),
      frozenReason: toSafeString(wallet.frozenReason, null),
      frozenAt: toISOString(wallet.frozenAt),
      unfrozenAt: toISOString(wallet.unfrozenAt),
      lastTransactionAt: toISOString(wallet.lastTransactionAt),
      createdAt: toISOString(wallet.createdAt),
      updatedAt: toISOString(wallet.updatedAt),
    };
  },

  /**
   * Frozen wallet item
   * @param {Object} wallet - Wallet MongoDB document
   * @param {Object} user - User document (populated)
   * @returns {Object} Frozen wallet DTO
   */
  frozenWalletItem: (wallet, user) => {
    if (!wallet) return null;

    return {
      walletId: extractId(wallet),
      userId: wallet.ownerId,
      balance: toSafeNumber(wallet.balance),
      frozenReason: toSafeString(wallet.frozenReason, null),
      frozenAt: toISOString(wallet.frozenAt),
      user: user
        ? {
            name: toSafeString(user.name),
            email: toSafeString(user.email),
            role: toSafeString(user.role),
          }
        : null,
    };
  },

  /**
   * Wallet action result (freeze/unfreeze)
   * @param {Object} result - Service result
   * @returns {Object} Wallet action DTO
   */
  walletAction: (result) => {
    if (!result) return null;

    return {
      walletId: extractId(result),
      userId: result.userId,
      isFrozen: Boolean(result.isFrozen),
      frozenReason: toSafeString(result.frozenReason, null),
      frozenAt: toISOString(result.frozenAt),
      unfrozenAt: toISOString(result.unfrozenAt),
    };
  },

  /**
   * Wallet status for admin
   * @param {Object} result - Service result (wallet + user)
   * @returns {Object} Wallet status DTO
   */
  walletStatus: (result) => {
    if (!result) return null;

    return {
      walletId: extractId(result),
      userId: result.userId,
      balance: toSafeNumber(result.balance),
      currency: toSafeString(result.currency, 'AOA'),
      isFrozen: Boolean(result.isFrozen),
      frozenReason: toSafeString(result.frozenReason, null),
      frozenAt: toISOString(result.frozenAt),
      unfrozenAt: toISOString(result.unfrozenAt),
      user: result.user
        ? {
            name: toSafeString(result.user.name),
            email: toSafeString(result.user.email),
            isActive: Boolean(result.user.isActive),
            riskScore: toSafeNumber(result.user.riskScore, 0),
          }
        : null,
    };
  },

  /**
   * Fraud stats
   * @param {Object} stats - Fraud statistics
   * @returns {Object} Fraud stats DTO
   */
  fraudStats: (stats) => {
    if (!stats) return null;

    return {
      totalUsers: toSafeNumber(stats.totalUsers, 0),
      highRiskUsers: toSafeNumber(stats.highRiskUsers, 0),
      highRiskPercentage: toSafeNumber(stats.highRiskPercentage, 0),
      frozenWallets: toSafeNumber(stats.frozenWallets, 0),
      recentHighRisk: toSafeArray(stats.recentHighRisk).map((u) => ({
        userId: extractId(u),
        name: toSafeString(u.name),
        email: toSafeString(u.email),
        riskScore: toSafeNumber(u.riskScore, 0),
      })),
    };
  },

  /**
   * Fraud alert item
   * @param {Object} alert - Alert document
   * @returns {Object} Fraud alert DTO
   */
  fraudAlert: (alert) => {
    if (!alert) return null;

    return {
      userId: extractId(alert),
      name: toSafeString(alert.name),
      email: toSafeString(alert.email),
      riskScore: toSafeNumber(alert.riskScore, 0),
      lastFlag: toSafeString(alert.lastFlag || alert.auditFlags?.lastFlag, null),
    };
  },

  /**
   * High risk user item
   * @param {Object} user - User document
   * @returns {Object} High risk user DTO
   */
  highRiskUser: (user) => {
    if (!user) return null;

    return {
      userId: extractId(user),
      name: toSafeString(user.name),
      email: toSafeString(user.email),
      role: toSafeString(user.role),
      riskScore: toSafeNumber(user.riskScore, 0),
      isActive: Boolean(user.isActive),
    };
  },

  /**
   * Security dashboard
   * @param {Object} data - Dashboard data
   * @returns {Object} Security dashboard DTO
   */
  securityDashboard: (data) => {
    if (!data) return null;

    return {
      totalUsers: toSafeNumber(data.totalUsers, 0),
      highRiskUsers: toSafeNumber(data.highRiskUsers, 0),
      highRiskPercentage: toSafeNumber(data.highRiskPercentage, 0),
      frozenWallets: toSafeNumber(data.frozenWallets, 0),
      recentTransactions: toSafeNumber(data.recentTransactions, 0),
      systemStatus: toSafeString(data.systemStatus, 'operational'),
    };
  },

  /**
   * User action result (suspend/reactivate)
   * @param {Object} result - Service result
   * @returns {Object} User action DTO
   */
  userAction: (result) => {
    if (!result) return null;

    return {
      userId: extractId(result),
      name: toSafeString(result.name),
      email: toSafeString(result.email),
      isActive: Boolean(result.isActive),
      suspendedAt: toISOString(result.suspendedAt),
      reactivatedAt: toISOString(result.reactivatedAt),
      suspensionReason: toSafeString(result.suspensionReason, null),
    };
  },

  /**
   * Risk score update result
   * @param {Object} result - Service result
   * @returns {Object} Risk score DTO
   */
  riskScoreUpdate: (result) => {
    if (!result) return null;

    return {
      userId: extractId(result),
      name: toSafeString(result.name),
      riskScore: toSafeNumber(result.riskScore, 0),
    };
  },

  /**
   * Array transformers
   */
  fromUserArray: (users) => toSafeArray(users).map(AdminDTO.userForAdmin),
  fromWalletArray: (wallets) => toSafeArray(wallets).map(AdminDTO.walletForAdmin),
  fromFraudAlertsArray: (alerts) => toSafeArray(alerts).map(AdminDTO.fraudAlert),
  fromHighRiskUsersArray: (users) => toSafeArray(users).map(AdminDTO.highRiskUser),
};

export default AdminDTO;
