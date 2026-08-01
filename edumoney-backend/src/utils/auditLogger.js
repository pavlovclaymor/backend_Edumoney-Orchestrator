import * as auditService from '../services/audit.service.js';

/**
 * Normaliza valores de actor e entidade para o formato esperado pelo AuditLog.
 * Aceita tanto ObjectId/string como documentos populados.
 */
function normalizeId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  return null;
}

function normalizeModelName(model) {
  if (!model) return null;
  if (typeof model === 'string') return model;
  if (model.modelName) return model.modelName;
  if (model.constructor?.modelName) return model.constructor.modelName;
  return null;
}

function sanitizeMetadata(metadata) {
  if (!metadata) return null;

  try {
    // Garante que é serializável e remove campos muito pesados
    const plain = JSON.parse(JSON.stringify(metadata));

    if (plain.password) plain.password = '***';
    if (plain.pin) plain.pin = '***';
    if (plain.token) plain.token = '***';

    return plain;
  } catch (e) {
    console.warn('[AuditLogger] Failed to serialize metadata, skipping field');
    return null;
  }
}

/**
 * Backward compatible wrapper utility that calls the audit service.
 * Nunca lança erro para o fluxo principal e faz normalização interna dos dados.
 */
export const writeAuditLog = async (params = {}) => {
  try {
    const {
      userId,
      userModel,
      action,
      entity,
      entityId = null,
      status,
      ip = null,
      userAgent = null,
      schoolId,
      metadata = null,
    } = params;

    await auditService.recordAuditLog({
      userId: normalizeId(userId),
      userModel: normalizeModelName(userModel) || userModel,
      action,
      entity,
      entityId: normalizeId(entityId),
      status,
      ip,
      userAgent,
      schoolId: normalizeId(schoolId) || schoolId,
      metadata: sanitizeMetadata(metadata),
    });
  } catch (error) {
    // Nunca quebra o request principal
    console.error('[AuditLogger] Error writing audit log:', error);
  }
};
