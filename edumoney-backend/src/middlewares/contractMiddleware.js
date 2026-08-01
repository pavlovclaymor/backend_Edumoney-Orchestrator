/**
 * Contract Middleware Registration
 *
 * This module provides a centralized way to register all contract-related
 * middleware for the application.
 */

import {
  validateResponseMiddleware,
  strictValidateResponseMiddleware,
} from './validateResponse.js';

/**
 * Register contract validation middleware
 *
 * @param {Object} app - Express app
 * @param {Object} options - Configuration options
 * @param {boolean} options.strict - Use strict validation (throws on violations)
 * @param {boolean} options.enabled - Enable/disable validation
 */
export const registerContractMiddleware = (app, options = {}) => {
  const { strict = false, enabled = true } = options;

  if (!enabled) {
    console.log('[Contract] Validation middleware disabled');
    return;
  }

  const middleware = strict ? strictValidateResponseMiddleware : validateResponseMiddleware;

  // Register as global middleware (runs after all routes)
  app.use(middleware);

  if (strict) {
    console.log('[Contract] Strict validation middleware ENABLED');
  } else {
    console.log('[Contract] Validation middleware ENABLED (non-strict)');
  }
};

export default {
  registerContractMiddleware,
  validateResponseMiddleware,
  strictValidateResponseMiddleware,
};
