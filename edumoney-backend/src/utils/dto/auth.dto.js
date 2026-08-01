/**
 * Auth DTO
 * Transforms auth-related data to API response format
 */

import { toSafeObject, extractId, toISOString, toSafeNumber, toSafeString } from './base.dto.js';

/**
 * Transform user document to Auth response DTO
 * @param {Object} user - User MongoDB document
 * @returns {Object} User Auth DTO
 */
export const AuthDTO = {
  /**
   * Transform user for login/register response
   * @param {Object} user - User MongoDB document
   * @param {string} token - JWT token
   * @returns {Object} User Auth DTO
   */
  fromUser: (user, token = null) => {
    if (!user) return null;

    const obj = toSafeObject(user);

    const dto = {
      id: extractId(obj),
      name: toSafeString(obj.name),
      processNumber: toSafeString(obj.processNumber),
      role: toSafeString(obj.role, 'student'),
      email: toSafeString(obj.email),
      schoolId: obj.schoolId,
      classId: obj.classId,
      year: toSafeNumber(obj.year),
      isActive: Boolean(obj.isActive),
      status: toSafeString(obj.status),
      walletId: obj.walletId,
      passwordChangedAt: toISOString(obj.passwordChangedAt),
      createdAt: toISOString(obj.createdAt),
    };

    if (token) {
      dto.token = token;
    }

    return dto;
  },

  /**
   * Transform school for login response
   * @param {Object} school - School MongoDB document
   * @param {string} token - JWT token
   * @returns {Object} School Auth DTO
   */
  fromSchool: (school, token = null) => {
    if (!school) return null;

    const obj = toSafeObject(school);

    const dto = {
      id: extractId(obj),
      name: toSafeString(obj.name),
      nif: toSafeString(obj.nif),
      role: 'school',
      email: toSafeString(obj.email),
      phone: toSafeString(obj.phone),
      address: toSafeString(obj.address),
      feeRate: toSafeNumber(obj.feeRate, 0),
      isActive: Boolean(obj.isActive),
      createdAt: toISOString(obj.createdAt),
    };

    if (token) {
      dto.token = token;
    }

    return dto;
  },

  /**
   * Transform merchant for login response
   * @param {Object} merchant - Merchant MongoDB document
   * @param {string} token - JWT token
   * @returns {Object} Merchant Auth DTO
   */
  fromMerchant: (merchant, token = null) => {
    if (!merchant) return null;

    const obj = toSafeObject(merchant);

    const dto = {
      id: extractId(obj),
      name: toSafeString(obj.name),
      nif: toSafeString(obj.nif),
      role: 'merchant',
      category: toSafeString(obj.category),
      schoolId: obj.schoolId,
      email: toSafeString(obj.email),
      isActive: Boolean(obj.isActive),
      walletId: obj.walletId,
      createdAt: toISOString(obj.createdAt),
    };

    if (token) {
      dto.token = token;
    }

    return dto;
  },

  /**
   * Transform registration result
   * @param {Object} result - Registration result
   * @returns {Object} Registration DTO
   */
  registrationResult: (result) => {
    if (!result) return null;

    const user = AuthDTO.fromUser(result);
    return user;
  },
  /**
   * Transform login success result
   * @param {Object} result - Login result
   * @param {string} role - User role
   * @returns {Object} Login DTO
   */
  loginSuccess: (result, role) => {
    if (!result) return null;

    if (role === 'admin') {
      return {
        userData: AuthDTO.fromAdmin(result.userObj || result.user, result.token),
        token: result.token,
      };
    }

    if (role === 'school') {
      return {
        userData: AuthDTO.fromSchool(result.school || result.userObj),
        token: result.token,
      };
    }

    if (role === 'merchant') {
      return {
        userData: AuthDTO.fromMerchant(result.merchant || result.userObj),
        token: result.token,
      };
    }

    return {
      userData: AuthDTO.fromUser(result.userObj || result.user),
      token: result.token,
    };
  },

  /**
   * Transform login failure
   * @param {string} reason - Failure reason
   * @returns {Object} Login failure DTO
   */
  loginFailure: (reason) => {
    return {
      success: false,
      reason: toSafeString(reason),
    };
  },
};

export default AuthDTO;
// ============ ADMIN DTO ============

/**
 * Transform admin for login response
 * @param {Object} admin - Admin MongoDB document
 * @param {string} token - JWT token
 * @returns {Object} Admin Auth DTO
 */
AuthDTO.fromAdmin = (admin, token = null) => {
  if (!admin) return null;

  const obj = toSafeObject(admin);

  const dto = {
    id: extractId(obj),
    name: toSafeString(obj.name),
    email: toSafeString(obj.email),
    role: 'admin',
    isActive: Boolean(obj.isActive),
    permissions: obj.permissions || [],
    createdAt: toISOString(obj.createdAt),
  };

  if (token) {
    dto.token = token;
  }

  return dto;
};
