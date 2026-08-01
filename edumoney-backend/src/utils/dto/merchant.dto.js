/**
 * Merchant DTO
 * Transforms merchant MongoDB documents to API response format
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
 * Map merchant status
 */
const mapMerchantStatus = (status) => {
  const statusMap = {
    active: 'ACTIVE',
    inactive: 'INACTIVE',
    suspended: 'SUSPENDED',
    pending: 'PENDING',
  };
  return statusMap[status] || 'ACTIVE';
};

/**
 * Merchant DTO
 */
export const MerchantDTO = {
  /**
   * Transform single merchant
   */
  fromDocument: (merchant) => {
    if (!merchant) return null;

    const obj = toSafeObject(merchant);
    if (!obj) return null;

    return {
      id: extractId(obj),
      name: toSafeString(obj.name),
      email: toSafeString(obj.email, null),
      nif: toSafeString(obj.nif),
      category: toSafeString(obj.category, 'outro'),
      phone: toSafeString(obj.phone, null),
      description: toSafeString(obj.description, ''),
      address: toSafeString(obj.address, null),
      schoolId: obj.schoolId,
      walletId: obj.walletId,
      isActive: Boolean(obj.isActive),
      profilePicture: toSafeString(obj.profilePicture, null),
      createdAt: toISOString(obj.createdAt),
      updatedAt: toISOString(obj.updatedAt),
    };
  },

  /**
   * Transform merchant for list (minimal data)
   */
  forList: (merchant) => {
    if (!merchant) return null;

    return {
      id: extractId(merchant),
      name: toSafeString(merchant.name),
      category: toSafeString(merchant.category, 'outro'),
      nif: toSafeNumber(merchant.nif),
      isActive: Boolean(merchant.isActive),
    };
  },

  /**
   * Transform merchant for school response
   */
  forSchool: (merchant) => {
    if (!merchant) return null;

    return {
      id: extractId(merchant),
      name: toSafeString(merchant.name),
      category: toSafeString(merchant.category, 'outro'),
      nif: toSafeNumber(merchant.nif),
      isActive: Boolean(merchant.isActive),
      createdAt: toISOString(merchant.createdAt),
    };
  },

  /**
   * Transform array of merchants
   */
  fromArray: (merchants) => toSafeArray(merchants).map(MerchantDTO.fromDocument),

  /**
   * Transform array for list view
   */
  fromArrayForList: (merchants) => toSafeArray(merchants).map(MerchantDTO.forList),
};

export default MerchantDTO;
