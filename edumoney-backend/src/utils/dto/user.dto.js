/**
 * User DTO
 * Transforms user MongoDB documents to API response format
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
 * Map user role
 */
const mapUserRole = (role) => {
  const roleMap = {
    student: 'STUDENT',
    user: 'USER',
    admin: 'ADMIN',
    school: 'SCHOOL',
    merchant: 'MERCHANT',
  };
  return roleMap[role] || toSafeString(role).toUpperCase();
};

/**
 * Map user status
 */
const mapUserStatus = (status) => {
  const statusMap = {
    ativo: 'ACTIVE',
    inativo: 'INACTIVE',
    suspended: 'SUSPENDED',
    pending: 'PENDING',
    frozen: 'FROZEN',
  };
  return statusMap[status] || 'INACTIVE';
};

/**
 * User DTO
 */
export const UserDTO = {
  /**
   * Transform single user
   */
  fromDocument: (user) => {
    if (!user) return null;

    const obj = toSafeObject(user);
    if (!obj) return null;

    return {
      id: extractId(obj),
      name: toSafeString(obj.name),
      email: toSafeString(obj.email, null),
      role: mapUserRole(obj.role),
      processNumber: toSafeString(obj.processNumber, null),
      schoolId: obj.schoolId,
      classId: obj.classId,
      year: toSafeNumber(obj.year),
      status: mapUserStatus(obj.status),
      isEmailVerified: Boolean(obj.isEmailVerified),
      walletId: obj.walletId,
      passwordChangedAt: toISOString(obj.passwordChangedAt),
      profilePicture: toSafeString(obj.profilePicture, null),
      phone: toSafeString(obj.phone, null),
      createdAt: toISOString(obj.createdAt),
      updatedAt: toISOString(obj.updatedAt),
    };
  },

  /**
   * Transform user for list (minimal data)
   */
  forList: (user) => {
    if (!user) return null;

    return {
      id: extractId(user),
      name: toSafeString(user.name),
      processNumber: toSafeString(user.processNumber, null),
      role: mapUserRole(user.role),
      status: mapUserStatus(user.status),
    };
  },

  /**
   * Transform user for school response
   */
  forSchool: (user) => {
    if (!user) return null;

    return {
      id: extractId(user),
      name: toSafeString(user.name),
      processNumber: toSafeString(user.processNumber, null),
      status: mapUserStatus(user.status),
      walletId: user.walletId,
      classId: user.classId,
      year: toSafeNumber(user.year),
      createdAt: toISOString(user.createdAt),
    };
  },

  /**
   * Transform array of users
   */
  fromArray: (users) => toSafeArray(users).map(UserDTO.fromDocument),
};

export default UserDTO;
