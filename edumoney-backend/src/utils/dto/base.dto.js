/**
 * Base DTO Utilities
 * Provides common transformation functions for all DTOs
 */

/**
 * Convert MongoDB document to plain object
 * @param {Object} doc - MongoDB document or plain object
 * @returns {Object} Plain object
 */
export const toPlainObject = (doc) => {
  if (!doc) return null;
  if (doc.toObject) return doc.toObject();
  if (typeof doc === 'object') return { ...doc };
  return null;
};

/**
 * Convert MongoDB document to safe object (exclude sensitive fields)
 * @param {Object} doc - MongoDB document or plain object
 * @returns {Object} Safe plain object
 */
export const toSafeObject = (doc) => {
  if (!doc) return null;

  const obj = toPlainObject(doc);
  if (!obj) return null;

  // Always exclude these fields
  delete obj.__v;
  delete obj.password;
  delete obj.pin;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.verificationCode;
  delete obj.VerificationCode;

  return obj;
};

/**
 * Convert array of documents to array of safe objects
 * @param {Array} docs - Array of MongoDB documents
 * @returns {Array} Array of safe plain objects
 */
export const toSafeArray = (docs) => {
  if (!docs) return [];
  if (!Array.isArray(docs)) return [toSafeObject(docs)];
  return docs.map((doc) => toSafeObject(doc)).filter(Boolean);
};

/**
 * Extract ID from document
 * @param {Object} doc - Document with _id or id
 * @returns {String} Document ID
 */
export const extractId = (doc) => {
  if (!doc) return null;
  return doc._id?.toString() || doc.id || null;
};

/**
 * Transform date to ISO string
 * @param {Date|String} date - Date object or string
 * @returns {String|null} ISO date string or null
 */
export const toISOString = (date) => {
  if (!date) return null;
  try {
    return new Date(date).toISOString();
  } catch {
    return null;
  }
};

/**
 * Transform amount to number with safe default
 * @param {any} amount - Amount value
 * @param {Number} defaultValue - Default value
 * @returns {Number} Safe number
 */
export const toSafeNumber = (amount, defaultValue = 0) => {
  if (amount === null || amount === undefined) return defaultValue;
  const num = Number(amount);
  return isNaN(num) ? defaultValue : num;
};

/**
 * Transform string to safe string
 * @param {any} str - String value
 * @param {String} defaultValue - Default value
 * @returns {String} Safe string
 */
export const toSafeString = (str, defaultValue = '') => {
  if (str === null || str === undefined) return defaultValue;
  return String(str);
};

export default {
  toPlainObject,
  toSafeObject,
  toSafeArray,
  extractId,
  toISOString,
  toSafeNumber,
  toSafeString,
};
