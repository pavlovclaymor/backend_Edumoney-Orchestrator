/**
 * Wallet DTO
 * Transforms wallet MongoDB documents to API response format
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
 * Transform wallet document to DTO
 * @param {Object} wallet - Wallet MongoDB document
 * @returns {Object} Wallet DTO
 */
export const WalletDTO = {
  fromDocument: (wallet) => {
    if (!wallet) return null;

    const obj = toSafeObject(wallet);
    if (!obj) return null;

    return {
      id: extractId(obj),
      balance: toSafeNumber(obj.balance),
      currency: toSafeString(obj.currency, 'AOA'),
      status: toSafeString(obj.status, 'active'),
      ownerId: obj.ownerId,
      ownerModel: toSafeString(obj.ownerModel),
      isFrozen: Boolean(obj.isFrozen),
      frozenReason: toSafeString(obj.frozenReason, null),
      totalCredits: toSafeNumber(obj.totalCredits),
      totalDebits: toSafeNumber(obj.totalDebits),
      lastTransactionAt: toISOString(obj.lastTransactionAt),
      createdAt: toISOString(obj.createdAt),
      updatedAt: toISOString(obj.updatedAt),
    };
  },

  /**
   * Transform wallet for user response (minimal data)
   * @param {Object} wallet - Wallet MongoDB document
   * @returns {Object} Minimal wallet DTO
   */
  forUser: (wallet) => {
    if (!wallet) return null;

    return {
      id: extractId(wallet),
      balance: toSafeNumber(wallet.balance),
      currency: toSafeString(wallet.currency, 'AOA'),
      status: toSafeString(wallet.status, 'active'),
      isFrozen: Boolean(wallet.isFrozen),
    };
  },

  /**
   * Transform wallet for admin response (full data)
   * @param {Object} wallet - Wallet MongoDB document
   * @returns {Object} Full wallet DTO
   */
  forAdmin: (wallet) => {
    if (!wallet) return null;

    const dto = WalletDTO.fromDocument(wallet);
    if (!dto) return null;

    return {
      ...dto,
      // Additional admin fields
      transactionCount: toSafeNumber(wallet.transactionCount, 0),
      lastActivityAt: toISOString(wallet.lastActivityAt),
    };
  },

  /**
   * Transform array of wallets
   * @param {Array} wallets - Array of wallet documents
   * @returns {Array} Array of wallet DTOs
   */
  fromArray: (wallets) => toSafeArray(wallets).map(WalletDTO.fromDocument),
};

export default WalletDTO;
