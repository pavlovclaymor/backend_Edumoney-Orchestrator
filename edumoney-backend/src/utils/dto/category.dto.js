/**
 * Category DTO
 * Transforms category MongoDB documents to API response format
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
 * Transform category document to DTO
 * @param {Object} category - Category MongoDB document
 * @returns {Object} Category DTO
 */
export const CategoryDTO = {
  fromDocument: (category) => {
    if (!category) return null;

    const obj = toSafeObject(category);
    if (!obj) return null;

    return {
      id: extractId(obj),
      merchantId: obj.merchantId,
      name: toSafeString(obj.name),
      description: toSafeString(obj.description),
      isActive: Boolean(obj.isActive),
      productCount: toSafeNumber(obj.productCount, 0),
      createdAt: toISOString(obj.createdAt),
      updatedAt: toISOString(obj.updatedAt),
    };
  },

  /**
   * Transform array of categories
   * @param {Array} categories - Array of category documents
   * @returns {Array} Array of category DTOs
   */
  fromArray: (categories) => toSafeArray(categories).map(CategoryDTO.fromDocument),
};

/**
 * Product DTO
 * Transforms product MongoDB documents to API response format
 */
export const ProductDTO = {
  fromDocument: (product) => {
    if (!product) return null;

    const obj = toSafeObject(product);
    if (!obj) return null;

    return {
      id: extractId(obj),
      merchantId: obj.merchantId,
      schoolId: obj.schoolId,
      name: toSafeString(obj.name),
      price: toSafeNumber(obj.price),
      quantity: toSafeNumber(obj.quantity, 0),
      categoryName: toSafeString(obj.categoryName),
      img: toSafeString(obj.img),
      isActive: Boolean(obj.isActive),
      createdAt: toISOString(obj.createdAt),
      updatedAt: toISOString(obj.updatedAt),
    };
  },

  /**
   * Transform array of products
   * @param {Array} products - Array of product documents
   * @returns {Array} Array of product DTOs
   */
  fromArray: (products) => toSafeArray(products).map(ProductDTO.fromDocument),
};

/**
 * Recharge DTO
 * Transforms recharge MongoDB documents to API response format
 */
export const RechargeDTO = {
  fromDocument: (recharge) => {
    if (!recharge) return null;

    const obj = toSafeObject(recharge);
    if (!obj) return null;

    return {
      id: extractId(obj),
      userId: obj.userId,
      walletId: obj.walletId,
      schoolId: obj.schoolId,
      amount: toSafeNumber(obj.amount),
      currency: toSafeString(obj.currency, 'AOA'),
      rupeReference: toSafeString(obj.rupeReference),
      status: toSafeString(obj.status, 'pending'),
      paymentLink:
        obj.status === 'pending'
          ? `https://rupe-sandbox.gateway/pay?ref=${obj.rupeReference}&amount=${obj.amount}`
          : null,
      callbackReceived: Boolean(obj.callbackReceived),
      createdAt: toISOString(obj.createdAt),
      updatedAt: toISOString(obj.updatedAt),
    };
  },

  /**
   * Transform pending recharge
   * @param {Object} recharge - Recharge document
   * @returns {Object} Recharge DTO for pending status
   */
  forPending: (recharge) => {
    if (!recharge) return null;

    return {
      id: extractId(recharge),
      amount: toSafeNumber(recharge.amount),
      currency: toSafeString(recharge.currency, 'AOA'),
      rupeReference: toSafeString(recharge.rupeReference),
      status: toSafeString(recharge.status, 'pending'),
      paymentLink: `https://rupe-sandbox.gateway/pay?ref=${recharge.rupeReference}&amount=${recharge.amount}`,
      createdAt: toISOString(recharge.createdAt),
    };
  },

  /**
   * Transform array of recharges
   * @param {Array} recharges - Array of recharge documents
   * @returns {Array} Array of recharge DTOs
   */
  fromArray: (recharges) => toSafeArray(recharges).map(RechargeDTO.fromDocument),
};

export default {
  CategoryDTO,
  ProductDTO,
  RechargeDTO,
};
