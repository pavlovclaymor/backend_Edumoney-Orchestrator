/**
 * Contract Validator
 * Runtime validation for contract enforcement
 *
 * This module provides utilities to validate that responses
 * conform to the Contract-First architecture standards.
 */

import mongoose from 'mongoose';

/**
 * Check if a value is a MongoDB document (has _id and __v)
 */
export const isMongoDocument = (value) => {
  if (!value || typeof value !== 'object') return false;

  // Check if it's a mongoose document
  if (value instanceof mongoose.Document) return true;

  // Check if it looks like a raw MongoDB document
  if (value._id && (value.__v !== undefined || value.createdAt)) {
    return true;
  }

  return false;
};

/**
 * Check if a value is a MongoDB ObjectId
 */
export const isMongoId = (value) => {
  return mongoose.Types.ObjectId.isValid(value);
};

/**
 * Get all MongoDB fields that should not be exposed
 */
export const getMongoInternalFields = () => [
  '__v',
  'password',
  'pin',
  'resetPasswordToken',
  'resetPasswordExpires',
  'verificationCode',
  'VerificationCode',
  '_id', // Should be mapped to 'id'
];

/**
 * Validate that an object does not contain MongoDB internal fields
 */
export const validateNoMongoFields = (obj, path = '') => {
  const violations = [];
  const internalFields = getMongoInternalFields();

  if (!obj || typeof obj !== 'object') return violations;

  for (const key of Object.keys(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (internalFields.includes(key)) {
      violations.push({
        field: currentPath,
        issue: `MongoDB internal field '${key}' should not be exposed`,
        severity: 'ERROR',
      });
    }

    // Recursively check nested objects
    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      violations.push(...validateNoMongoFields(obj[key], currentPath));
    }
  }

  return violations;
};

/**
 * Validate that a response is wrapped in ApiResponse format
 */
export const validateApiResponse = (response) => {
  const violations = [];

  if (!response || typeof response !== 'object') {
    violations.push({
      field: 'root',
      issue: 'Response must be an object',
      severity: 'ERROR',
    });
    return violations;
  }

  // Check for success field
  if (typeof response.success !== 'boolean') {
    violations.push({
      field: 'success',
      issue: 'Response must have a boolean "success" field',
      severity: 'ERROR',
    });
  }

  // Check for timestamp
  if (!response.timestamp) {
    violations.push({
      field: 'timestamp',
      issue: 'Response must have a "timestamp" field',
      severity: 'ERROR',
    });
  }

  // Check for message (required for success responses)
  if (response.success && !response.message) {
    violations.push({
      field: 'message',
      issue: 'Success response must have a "message" field',
      severity: 'WARNING',
    });
  }

  return violations;
};

/**
 * Validate that an error response follows ErrorResponse format
 */
export const validateErrorResponse = (response) => {
  const violations = [];

  if (!response || typeof response !== 'object') {
    violations.push({
      field: 'root',
      issue: 'Error response must be an object',
      severity: 'ERROR',
    });
    return violations;
  }

  // Check success is false
  if (response.success !== false) {
    violations.push({
      field: 'success',
      issue: 'Error response must have success=false',
      severity: 'ERROR',
    });
  }

  // Check for code field
  if (!response.code) {
    violations.push({
      field: 'code',
      issue: 'Error response must have a "code" field',
      severity: 'ERROR',
    });
  }

  // Check for message field
  if (!response.message) {
    violations.push({
      field: 'message',
      issue: 'Error response must have a "message" field',
      severity: 'ERROR',
    });
  }

  return violations;
};

/**
 * Validate response data
 */
export const validateResponseData = (data) => {
  const violations = [];

  // Check for MongoDB documents in data
  if (isMongoDocument(data)) {
    violations.push({
      field: 'data',
      issue: 'Data contains raw MongoDB document. Use DTO transformation.',
      severity: 'ERROR',
    });
  }

  // Check for MongoDB fields in data
  if (data && typeof data === 'object') {
    violations.push(...validateNoMongoFields(data, 'data'));
  }

  return violations;
};

/**
 * Full response validation
 */
export const validateResponse = (response) => {
  const violations = [];

  // Validate structure
  violations.push(...validateApiResponse(response));

  // If valid structure, validate data
  if (response && response.success === true) {
    violations.push(...validateResponseData(response.data));
  }

  return violations;
};

/**
 * Contract enforcement configuration
 */
export const ContractConfig = {
  // Whether to throw on violations
  throwOnViolation: process.env.NODE_ENV === 'development',

  // Whether to log violations
  logViolations: true,

  // Whether to allow legacy format (for backward compatibility)
  allowLegacyFormat: process.env.ALLOW_LEGACY_FORMAT === 'true',

  // List of endpoints that are exempt from contract validation
  exemptEndpoints: ['/health', '/api/health', '/api/status'],
};

export default {
  isMongoDocument,
  isMongoId,
  getMongoInternalFields,
  validateNoMongoFields,
  validateApiResponse,
  validateErrorResponse,
  validateResponseData,
  validateResponse,
  ContractConfig,
};
