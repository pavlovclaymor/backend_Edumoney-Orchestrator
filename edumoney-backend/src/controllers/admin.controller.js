/**
 * Admin Controller
 * Delega toda a lógica de negócio para admin.service.js
 *
 * Uses Contract-First pattern:
 * - DTO for data transformation
 * - ResponseWrapper for standardization
 */

import * as adminService from '../services/admin.service.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { createNotification } from './notification.controller.js';
import { AdminDTO } from '../utils/dto/index.js';
import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';

// =========================================================
// WALLET STATUS
// =========================================================
export const getWalletStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await adminService.getWalletStatus(userId);

    // Apply DTO transformation
    const dto = AdminDTO.walletStatus(result);

    return res.status(200).json(ApiResponse.success(dto, 'Wallet status retrieved'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404 ? ErrorResponse.notFound('Wallet') : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// FREEZE WALLET
// =========================================================
export const freezeWallet = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    if (!reason) {
      return res.status(400).json(ErrorResponse.badRequest('Reason is required'));
    }

    const result = await adminService.freezeWallet(userId, adminId, reason);

    // Audit log
    await writeAuditLog({
      userId: adminId,
      userModel: 'Admin',
      action: 'WALLET_FROZEN',
      entity: 'Wallet',
      entityId: result.walletId,
      status: 'success',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { targetUserId: userId, reason },
    }).catch(() => {});

    // Notification to user
    await createNotification(
      userId,
      'User',
      'Carteira congelada',
      `Sua carteira foi congelada. Motivo: ${reason}`,
      'security',
      'high',
    ).catch(() => {});

    // Apply DTO transformation
    const dto = AdminDTO.walletAction(result);

    return res.status(200).json(ApiResponse.success(dto, 'Wallet congelada com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404 ? ErrorResponse.notFound('Wallet') : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// UNFREEZE WALLET
// =========================================================
export const unfreezeWallet = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user._id;

    const result = await adminService.unfreezeWallet(userId, adminId);

    // Audit log
    await writeAuditLog({
      userId: adminId,
      userModel: 'Admin',
      action: 'WALLET_UNFROZEN',
      entity: 'Wallet',
      entityId: result.walletId,
      status: 'success',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { targetUserId: userId },
    }).catch(() => {});

    // Notification to user
    await createNotification(
      userId,
      'User',
      'Carteira descongelada',
      'Sua carteira foi descongelada e está novamente ativa.',
      'security',
      'high',
    ).catch(() => {});

    // Apply DTO transformation
    const dto = AdminDTO.walletAction(result);

    return res.status(200).json(ApiResponse.success(dto, 'Wallet descongelada com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404 ? ErrorResponse.notFound('Wallet') : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// GET FROZEN WALLETS
// =========================================================
export const getFrozenWallets = async (req, res) => {
  try {
    const result = await adminService.getFrozenWallets();

    // Apply DTO transformation
    const dto = result.map((item) => AdminDTO.frozenWalletItem(item.wallet, item.user));

    return res.status(200).json(ApiResponse.list(dto, dto.length, 'Frozen wallets retrieved'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// =========================================================
// SUSPEND USER
// =========================================================
export const suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    if (!reason) {
      return res.status(400).json(ErrorResponse.badRequest('Reason is required'));
    }

    const result = await adminService.suspendUser(userId, adminId, reason);

    // Audit log
    await writeAuditLog({
      userId: adminId,
      userModel: 'Admin',
      action: 'USER_SUSPENDED',
      entity: 'User',
      entityId: result.userId,
      status: 'success',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { targetUserId: userId, reason },
    }).catch(() => {});

    // Notification to user
    await createNotification(
      userId,
      'User',
      'Conta suspensa',
      `Sua conta foi suspensa. Motivo: ${reason}`,
      'security',
      'high',
    ).catch(() => {});

    // Apply DTO transformation
    const dto = AdminDTO.userAction(result);

    return res.status(200).json(ApiResponse.success(dto, 'Usuário suspenso com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404 ? ErrorResponse.notFound('User') : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// REACTIVATE USER
// =========================================================
export const reactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user._id;

    const result = await adminService.reactivateUser(userId, adminId);

    // Audit log
    await writeAuditLog({
      userId: adminId,
      userModel: 'Admin',
      action: 'USER_REACTIVATED',
      entity: 'User',
      entityId: result.userId,
      status: 'success',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { targetUserId: userId },
    }).catch(() => {});

    // Notification to user
    await createNotification(
      userId,
      'User',
      'Conta reativada',
      'Sua conta foi reativada e está novamente ativa.',
      'security',
      'high',
    ).catch(() => {});

    // Apply DTO transformation
    const dto = AdminDTO.userAction(result);

    return res.status(200).json(ApiResponse.success(dto, 'Usuário reativado com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404 ? ErrorResponse.notFound('User') : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// GET USER STATUS
// =========================================================
export const getUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await adminService.getUserStatus(userId);

    // Apply DTO transformation
    const dto = AdminDTO.userStatus(result);

    return res.status(200).json(ApiResponse.success(dto, 'User status retrieved'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404 ? ErrorResponse.notFound('User') : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// SET USER RISK SCORE
// =========================================================
export const setUserRiskScore = async (req, res) => {
  try {
    const { userId } = req.params;
    const { score } = req.body;
    const adminId = req.user._id;

    if (score === undefined || score === null) {
      return res.status(400).json(ErrorResponse.badRequest('Score is required'));
    }

    if (typeof score !== 'number' || score < 0 || score > 1) {
      return res
        .status(400)
        .json(ErrorResponse.badRequest('Score must be a number between 0 and 1'));
    }

    const result = await adminService.setUserRiskScore(userId, score);

    // Audit log
    await writeAuditLog({
      userId: adminId,
      userModel: 'Admin',
      action: 'RISK_SCORE_UPDATED',
      entity: 'User',
      entityId: result.userId,
      status: 'success',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { targetUserId: userId, score },
    }).catch(() => {});

    // Apply DTO transformation
    const dto = AdminDTO.riskScoreUpdate(result);

    return res.status(200).json(ApiResponse.success(dto, 'Risk score atualizado com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404 ? ErrorResponse.notFound('User') : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// FRAUD STATS
// =========================================================
export const getFraudStats = async (req, res) => {
  try {
    const result = await adminService.getFraudStats();

    // Apply DTO transformation
    const dto = AdminDTO.fraudStats(result);

    return res.status(200).json(ApiResponse.success(dto, 'Fraud stats retrieved'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// =========================================================
// FRAUD ALERTS
// =========================================================
export const getFraudAlerts = async (req, res) => {
  try {
    const { limit } = req.query;
    const result = await adminService.getFraudAlerts(Number(limit) || 20);

    // Apply DTO transformation
    const dto = AdminDTO.fromFraudAlertsArray(result);

    return res.status(200).json(ApiResponse.list(dto, dto.length, 'Fraud alerts retrieved'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// =========================================================
// HIGH RISK USERS
// =========================================================
export const getHighRiskUsers = async (req, res) => {
  try {
    const { threshold } = req.query;
    const result = await adminService.getHighRiskUsers(threshold ? Number(threshold) : 0.7);

    // Apply DTO transformation
    const dto = AdminDTO.fromHighRiskUsersArray(result);

    return res.status(200).json(ApiResponse.list(dto, dto.length, 'High risk users retrieved'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// =========================================================
// SECURITY DASHBOARD
// =========================================================
export const getSecurityDashboard = async (req, res) => {
  try {
    const result = await adminService.getSecurityDashboard();

    // Apply DTO transformation
    const dto = AdminDTO.securityDashboard(result);

    return res.status(200).json(ApiResponse.success(dto, 'Security dashboard retrieved'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// =========================================================
// GET USERS
// =========================================================
export const getUsers = async (req, res) => {
  try {
    const { role, isActive, schoolId, limit } = req.query;
    const filters = {};

    if (role) filters.role = role;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (schoolId) filters.schoolId = schoolId;
    if (limit) filters.limit = Number(limit);

    const result = await adminService.getUsers(filters);

    // Apply DTO transformation
    const dto = AdminDTO.fromUserArray(result);

    return res.status(200).json(ApiResponse.list(dto, dto.length, 'Users retrieved'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};
