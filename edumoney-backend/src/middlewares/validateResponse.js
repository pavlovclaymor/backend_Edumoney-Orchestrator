/**
 * Response Validation Middleware
 * Intercepts all responses and validates them against Contract-First standards
 *
 * This middleware ensures that all API responses conform to the contract
 * without requiring manual validation in every controller.
 */

import {
  validateResponse,
  validateNoMongoFields,
  isMongoDocument,
  ContractConfig,
} from '../utils/contractValidator.js';

/**
 * Create response validation middleware
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.throwOnViolation - Whether to throw on contract violations
 * @param {boolean} options.logViolations - Whether to log violations
 * @param {boolean} options.strictMode - Whether to use strict validation
 * @returns {Function} Express middleware
 */
export const createResponseValidator = (options = {}) => {
  const config = {
    throwOnViolation: options.throwOnViolation ?? ContractConfig.throwOnViolation,
    logViolations: options.logViolations ?? ContractConfig.logViolations,
    strictMode: options.strictMode ?? false,
  };

  return (req, res, next) => {
    // Store original json and send methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Track if response has been validated
    let responseValidated = false;

    // Override json method to validate responses
    res.json = function (body) {
      // Skip validation for exempt endpoints
      if (ContractConfig.exemptEndpoints.includes(req.path)) {
        return originalJson(body);
      }

      // Skip validation for non-JSON content types
      const contentType = res.get('Content-Type') || '';
      if (!contentType.includes('application/json') && !contentType.includes('text/plain')) {
        // Let non-JSON responses through
        return originalJson(body);
      }

      // Validate response
      const violations = validateResponse(body);

      if (violations.length > 0) {
        // Log violations
        if (config.logViolations) {
          console.error(`[Contract Violation] ${req.method} ${req.path}`);
          violations.forEach((v) => {
            console.error(`  - [${v.severity}] ${v.field}: ${v.issue}`);
          });
        }

        // In strict mode or development, throw on violation
        if (config.throwOnViolation && config.strictMode) {
          throw new Error(
            `Contract violation in ${req.method} ${req.path}: ${violations.map((v) => v.issue).join(', ')}`,
          );
        }
      }

      // Mark as validated
      responseValidated = true;

      // Call original json
      return originalJson(body);
    };

    // Override send method for additional validation
    res.send = function (body) {
      // Skip validation for exempt endpoints
      if (ContractConfig.exemptEndpoints.includes(req.path)) {
        return originalSend(body);
      }

      // Only validate if sending an object
      if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
        // Check for MongoDB documents
        if (isMongoDocument(body)) {
          const error = `[Contract Violation] RAW MongoDB document returned at ${req.method} ${req.path}. Use DTO transformation.`;

          if (config.logViolations) {
            console.error(error);
          }

          if (config.throwOnViolation && config.strictMode) {
            throw new Error(error);
          }
        }

        // Check for MongoDB internal fields
        const mongoViolations = validateNoMongoFields(body);
        if (mongoViolations.length > 0) {
          if (config.logViolations) {
            console.error(
              `[Contract Violation] MongoDB fields exposed at ${req.method} ${req.path}`,
            );
            mongoViolations.forEach((v) => {
              console.error(`  - ${v.field}: ${v.issue}`);
            });
          }
        }
      }

      // Call original send
      return originalSend(body);
    };

    next();
  };
};

/**
 * Default response validator middleware
 * Validates all responses except exempt endpoints
 */
export const validateResponseMiddleware = createResponseValidator({
  throwOnViolation: false,
  logViolations: true,
  strictMode: false,
});

/**
 * Strict response validator middleware
 * Throws on any contract violation (use in development only)
 */
export const strictValidateResponseMiddleware = createResponseValidator({
  throwOnViolation: true,
  logViolations: true,
  strictMode: true,
});

export default validateResponseMiddleware;
