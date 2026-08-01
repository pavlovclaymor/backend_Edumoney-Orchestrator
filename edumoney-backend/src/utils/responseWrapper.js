/**
 * Response Wrapper
 * Standardizes all API responses to consistent format
 */

/**
 * Get current timestamp in ISO format
 */
const getTimestamp = () => new Date().toISOString();

/**
 * API Response - Standard response wrapper
 */
export const ApiResponse = {
  /**
   * Success response with data
   * @param {any} data - Response data
   * @param {string} message - Success message
   * @returns {Object} Standardized success response
   */
  success: (data = null, message = 'Success') => ({
    success: true,
    message,
    data,
    timestamp: getTimestamp(),
  }),

  /**
   * Success response without message
   * @param {any} data - Response data
   * @returns {Object} Standardized success response
   */
  ok: (data = null) => ({
    success: true,
    data,
    timestamp: getTimestamp(),
  }),

  /**
   * Created response
   * @param {any} data - Created resource data
   * @param {string} message - Success message
   * @returns {Object} Standardized created response
   */
  created: (data = null, message = 'Created successfully') => ({
    success: true,
    message,
    data,
    timestamp: getTimestamp(),
  }),

  /**
   * Paginated response
   * @param {Array} data - Array of items
   * @param {Object} pagination - Pagination info
   * @param {string} message - Success message
   * @returns {Object} Standardized paginated response
   */
  paginated: (data = [], pagination = {}, message = 'Success') => ({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || 20,
      total: pagination.total || data.length,
      totalPages:
        pagination.totalPages ||
        Math.ceil((pagination.total || data.length) / (pagination.limit || 20)),
    },
    timestamp: getTimestamp(),
  }),

  /**
   * List response with count
   * @param {Array} data - Array of items
   * @param {number} total - Total count
   * @param {string} message - Success message
   * @returns {Object} Standardized list response
   */
  list: (data = [], total = null, message = 'Success') => ({
    success: true,
    message,
    data,
    count: Array.isArray(data) ? data.length : 0,
    total: total !== null ? total : Array.isArray(data) ? data.length : 0,
    timestamp: getTimestamp(),
  }),
};

/**
 * Error Response - Standard error wrapper
 */
export const ErrorResponse = {
  /**
   * Bad request error (400)
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @returns {Object} Standardized error response
   */
  badRequest: (message = 'Bad request', code = 'BAD_REQUEST') => ({
    success: false,
    code,
    message,
    timestamp: getTimestamp(),
  }),

  /**
   * Unauthorized error (401)
   * @param {string} message - Error message
   * @returns {Object} Standardized error response
   */
  unauthorized: (message = 'Unauthorized') => ({
    success: false,
    code: 'UNAUTHORIZED',
    message,
    timestamp: getTimestamp(),
  }),

  /**
   * Forbidden error (403)
   * @param {string} message - Error message
   * @returns {Object} Standardized error response
   */
  forbidden: (message = 'Forbidden') => ({
    success: false,
    code: 'FORBIDDEN',
    message,
    timestamp: getTimestamp(),
  }),

  /**
   * Not found error (404)
   * @param {string} resource - Resource name
   * @returns {Object} Standardized error response
   */
  notFound: (resource = 'Resource') => ({
    success: false,
    code: 'NOT_FOUND',
    message: `${resource} not found`,
    timestamp: getTimestamp(),
  }),

  /**
   * Conflict error (409)
   * @param {string} message - Error message
   * @returns {Object} Standardized error response
   */
  conflict: (message = 'Conflict') => ({
    success: false,
    code: 'CONFLICT',
    message,
    timestamp: getTimestamp(),
  }),

  /**
   * Validation error (422)
   * @param {string} message - Error message
   * @param {Array} errors - Validation errors
   * @returns {Object} Standardized error response
   */
  validation: (message = 'Validation failed', errors = []) => ({
    success: false,
    code: 'VALIDATION_ERROR',
    message,
    errors,
    timestamp: getTimestamp(),
  }),

  /**
   * Internal server error (500)
   * @param {string} message - Error message
   * @returns {Object} Standardized error response
   */
  internal: (message = 'Internal server error') => ({
    success: false,
    code: 'INTERNAL_ERROR',
    message,
    timestamp: getTimestamp(),
  }),
};

export default {
  ApiResponse,
  ErrorResponse,
};
