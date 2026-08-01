/**
 * Certificate Data Transfer Object
 * Transforma dados de certificados para exposição ao Frontend
 */

import { toSafeString, toSafeNumber } from './base.dto.js';

/**
 * Extrai ID de qualquer formato
 */
const extractId = (obj) => {
  if (!obj) return null;
  return obj._id?.toString() || obj.id?.toString() || null;
};

/**
 * Mapeia status do certificado
 */
const mapCertificateStatus = (status) => {
  const statuses = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    ISSUED: 'issued',
    CANCELLED: 'cancelled',
  };
  return statuses[status?.toUpperCase()] || status || 'unknown';
};

export const CertificateDTO = {
  /**
   * Transforma configuração de certificado
   */
  fromConfig: (config) => {
    if (!config) return null;
    return {
      id: extractId(config),
      schoolId: toSafeString(config.schoolId),
      templateName: toSafeString(config.templateName),
      placeholders: config.placeholders || [],
      createdAt: config.createdAt?.toISOString?.() || config.createdAt,
      updatedAt: config.updatedAt?.toISOString?.() || config.updatedAt,
    };
  },

  /**
   * Transforma log de certificado
   */
  fromLog: (log) => {
    if (!log) return null;
    return {
      id: extractId(log),
      requestId: toSafeString(log.requestId),
      studentNumber: toSafeString(log.studentNumber),
      studentName: toSafeString(log.studentName),
      processNumber: toSafeString(log.processNumber),
      status: mapCertificateStatus(log.status),
      schoolId: toSafeString(log.schoolId),
      issuedAt: log.issuedAt?.toISOString?.() || log.issuedAt,
      createdAt: log.createdAt?.toISOString?.() || log.createdAt,
    };
  },

  /**
   * Transforma lista de logs
   */
  fromArray: (logs = []) => {
    if (!Array.isArray(logs)) return [];
    return logs.map(CertificateDTO.fromLog);
  },

  /**
   * Estatísticas de certificados
   */
  stats: (data) => ({
    total: toSafeNumber(data.total) || 0,
    pending: toSafeNumber(data.pending) || 0,
    issued: toSafeNumber(data.issued) || 0,
    rejected: toSafeNumber(data.rejected) || 0,
  }),
};

export default CertificateDTO;
