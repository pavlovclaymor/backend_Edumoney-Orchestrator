import AuditLog from '../models/auditLog.model.js';

/**
 * Audit Service
 * Centralized reusable service for all audit logging operations.
 * Follows the service layer pattern used in the project.
 */

/**
 * Records an audit log entry for tracked actions.
 * @param {Object} params - Audit log parameters
 * @param {String} params.userId - ID of the user performing the action
 * @param {String} params.userModel - Model type of the user (User, School, Merchant)
 * @param {String} params.action - Action name (e.g., PROFILE_UPDATED, PASSWORD_CHANGED)
 * @param {String} params.entity - Entity type (e.g., Merchant, School, Certificate)
 * @param {String} params.entityId - ID of the entity being acted upon
 * @param {String} params.status - Status (success or failed)
 * @param {String} params.schoolId - School ID for filtering
 * @param {String} params.ip - Request IP address
 * @param {String} params.userAgent - Request User-Agent
 * @param {Object} params.metadata - Optional additional data (for critical updates like password changes)
 * @returns {Promise<Object>} Created audit log document or null if validation fails
 */
export const recordAuditLog = async ({
  userId,
  userModel,
  action,
  entity,
  entityId = null,
  status,
  schoolId,
  ip = null,
  userAgent = null,
  metadata = null,
}) => {
  try {
    // Validate required fields
    if (!userId || !userModel || !action || !entity || !status || !schoolId) {
      console.warn('[AuditService] Missing required fields for audit log:', {
        userId,
        userModel,
        action,
        entity,
        status,
        schoolId,
      });
      return null;
    }

    // Create audit log with optional metadata field for critical updates
    const auditLogData = {
      userId,
      userModel,
      action,
      entity,
      entityId,
      status,
      ip,
      userAgent,
      schoolId,
    };

    // Add metadata only if provided (for password changes, critical settings updates)
    if (metadata) {
      auditLogData.metadata = metadata;
    }

    const auditLog = await AuditLog.create(auditLogData);
    return auditLog;
  } catch (error) {
    console.error('[AuditService] Error recording audit log:', error);
    return null;
  }
};

/**
 * Retrieves paginated and filtered audit logs for a school.
 * @param {String} schoolId - School ID
 * @param {Object} filters - Filter options
 * @param {String} filters.action - Filter by action
 * @param {String} filters.entity - Filter by entity type
 * @param {String} filters.status - Filter by status
 * @param {String} filters.search - Search term for action/entity/ip
 * @param {Date} filters.startDate - Filter from date
 * @param {Date} filters.endDate - Filter to date
 * @param {Number} filters.page - Page number (1-indexed)
 * @param {Number} filters.limit - Results per page
 * @returns {Promise<Object>} Paginated audit logs with metadata
 */
export const getAuditLogs = async (
  schoolId,
  { action, entity, status, search, startDate, endDate, page = 1, limit = 20 },
) => {
  try {
    const filter = { schoolId };

    // Apply filters
    if (action) filter.action = action;
    if (entity) filter.entity = entity;
    if (status) filter.status = status;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (search) {
      filter.$or = [
        { action: { $regex: search, $options: 'i' } },
        { entity: { $regex: search, $options: 'i' } },
        { ip: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Execute query with lean for performance
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      AuditLog.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    return {
      logs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
      },
    };
  } catch (error) {
    console.error('[AuditService] Error fetching audit logs:', error);
    throw error;
  }
};

/**
 * Retrieves a single audit log entry by ID with full details.
 * @param {String} logId - Audit log ID
 * @param {String} schoolId - School ID for authorization
 * @returns {Promise<Object>} Audit log document or null if not found
 */
export const getAuditLogById = async (logId, schoolId) => {
  try {
    const log = await AuditLog.findOne({
      _id: logId,
      schoolId,
    }).lean();
    return log;
  } catch (error) {
    console.error('[AuditService] Error fetching audit log by ID:', error);
    throw error;
  }
};

/**
 * Retrieves distinct action types for a school (used for filter dropdowns).
 * @param {String} schoolId - School ID
 * @returns {Promise<Array>} Array of distinct actions
 */
export const getDistinctActions = async (schoolId) => {
  try {
    const actions = await AuditLog.distinct('action', { schoolId });
    return actions;
  } catch (error) {
    console.error('[AuditService] Error fetching distinct actions:', error);
    throw error;
  }
};

/**
 * Retrieves distinct entity types for a school (used for filter dropdowns).
 * @param {String} schoolId - School ID
 * @returns {Promise<Array>} Array of distinct entities
 */
export const getDistinctEntities = async (schoolId) => {
  try {
    const entities = await AuditLog.distinct('entity', { schoolId });
    return entities;
  } catch (error) {
    console.error('[AuditService] Error fetching distinct entities:', error);
    throw error;
  }
};
