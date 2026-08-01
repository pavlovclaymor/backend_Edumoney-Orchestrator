/**
 * School DTO
 * Transforms school MongoDB documents to API response format
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
 * School DTO
 */
export const SchoolDTO = {
  /**
   * Transform single school
   */
  fromDocument: (school) => {
    if (!school) return null;

    const obj = toSafeObject(school);
    if (!obj) return null;

    return {
      id: extractId(obj),
      name: toSafeString(obj.name),
      email: toSafeString(obj.email, null),
      nif: toSafeString(obj.nif),
      phone: toSafeString(obj.phone, null),
      address: toSafeString(obj.address, null),
      logo: toSafeString(obj.logo, null),
      walletId: obj.walletId,
      feeRate: toSafeNumber(obj.feeRate, 0),
      status: toSafeString(obj.status, 'ativo'),
      isActive: obj.status ? obj.status === 'ativo' : Boolean(obj.isActive),
      profilePicture: toSafeString(obj.profilePicture, null),
      description: toSafeString(obj.description, ''),
      website: toSafeString(obj.website, ''),
      sheetsPrinted: toSafeNumber(obj.sheetsPrinted, 0),
      sheetsSold: toSafeNumber(obj.sheetsSold, 0),
      createdAt: toISOString(obj.createdAt),
      updatedAt: toISOString(obj.updatedAt),
    };
  },

  /**
   * Transform school for list (minimal data)
   */
  forList: (school) => {
    if (!school) return null;

    return {
      id: extractId(school),
      name: toSafeString(school.name),
      nif: toSafeString(school.nif),
      isActive: Boolean(school.isActive),
    };
  },

  /**
   * Transform school for registry (NIF lookup)
   */
  forRegistry: (school) => {
    if (!school) return null;

    return {
      id: extractId(school),
      name: toSafeString(school.name),
      nif: toSafeString(school.nif),
      isActive: Boolean(school.isActive),
    };
  },

  /**
   * Transform array of schools
   */
  fromArray: (schools) => toSafeArray(schools).map(SchoolDTO.fromDocument),
};

export default SchoolDTO;
