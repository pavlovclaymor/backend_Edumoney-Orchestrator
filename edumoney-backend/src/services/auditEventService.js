/**
 * Audit Event Service
 *
 * Centralized, event-driven audit logging.
 *
 * Flow:
 *   1. Create audit log in MongoDB
 *   2. Emit Socket.IO event automatically
 *   3. Handle errors separately (audit failures don't break main operation)
 *
 * This ensures 100% backend-driven, real-time audit trail.
 */

import { recordAuditLog } from './audit.service.js';
import { getIO } from './socket.service.js';

/**
 * Create audit log and emit realtime socket event automatically.
 *
 * @param {Object} params - Audit parameters
 * @param {String} params.action - Action name (e.g., PASSWORD_CHANGED, PAYMENT_COMPLETED)
 * @param {String} params.actorId - User/School/Merchant ID performing the action
 * @param {String} params.actorType - Actor model type (User, School, Merchant)
 * @param {String} params.targetId - Target entity ID (optional)
 * @param {String} params.targetType - Target entity type (optional)
 * @param {String} params.schoolId - School ID for scoping
 * @param {String} params.ipAddress - Request IP
 * @param {String} params.userAgent - Request User-Agent
 * @param {Object} params.metadata - Additional metadata
 * @param {String} params.status - 'success' or 'failed' (default: 'success')
 * @returns {Promise<Object>} Created audit log document
 */
export const createAuditEventLog = async ({
  action,
  actorId,
  actorType,
  targetId = null,
  targetType = null,
  schoolId,
  ipAddress = null,
  userAgent = null,
  metadata = null,
  status = 'success',
}) => {
  let auditLog = null;

  try {
    // 1. Create audit log in MongoDB
    auditLog = await recordAuditLog({
      userId: actorId,
      userModel: actorType,
      action,
      entity: targetType || 'System',
      entityId: targetId,
      status,
      schoolId,
      ip: ipAddress,
      userAgent,
      metadata,
    });

    // 2. Emit socket event automatically (non-blocking)
    emitAuditEvent(auditLog, schoolId);

    return auditLog;
  } catch (error) {
    console.error('[AuditEventService] Error creating audit log:', error);
    // Don't rethrow: audit failures must not break the main operation
    return null;
  }
};

/**
 * Emit audit event via Socket.IO.
 * Sent to school admin room and admin broadcast.
 *
 * @param {Object} auditLog - Created audit log document
 * @param {String} schoolId - School ID for room targeting
 */
function emitAuditEvent(auditLog, schoolId) {
  try {
    const io = getIO();
    if (!io) {
      console.warn('[AuditEventService] Socket.IO not initialized, audit event not emitted');
      return;
    }

    // Standard audit event structure
    const event = {
      id: auditLog._id,
      action: auditLog.action,
      entity: auditLog.entity,
      status: auditLog.status,
      actorId: auditLog.userId,
      actorType: auditLog.userModel,
      targetId: auditLog.entityId,
      timestamp: auditLog.createdAt,
      ipAddress: auditLog.ip,
      metadata: auditLog.metadata,
    };

    // Emit to school admin room (for filtering by school later)
    io.to(`school:${schoolId}:audit`).emit('audit:new', event);

    // Emit to global admin broadcast (for admin dashboard)
    io.emit('audit:global', event);

    console.log(`[AuditEventService] Audit event emitted: ${auditLog.action}`);
  } catch (error) {
    console.error('[AuditEventService] Socket emit error (non-blocking):', error);
    // Don't rethrow: socket failures must not break the main operation
  }
}

/**
 * Batch create audit events (for bulk operations).
 * Useful for migrations or batch admin actions.
 *
 * @param {Array} auditParams - Array of audit parameters
 * @returns {Promise<Array>} Created audit logs
 */
export const createAuditEventLogBatch = async (auditParams) => {
  const results = [];

  for (const params of auditParams) {
    const log = await createAuditEventLog(params);
    if (log) results.push(log);
  }

  return results;
};
