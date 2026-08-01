import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';
import * as auditService from '../services/audit.service.js';

/**
 * GET /api/audit/:schoolId
 * Returns paginated, filtered audit logs for a given school.
 */
export const getAuditLogs = async (req, res) => {
  try {
    const { schoolId } = req.params;

    if (String(req.user._id) !== String(schoolId)) {
      return res.status(403).json(ErrorResponse.forbidden('Não autorizado'));
    }

    const { page = 1, limit = 20, action, entity, status, search, startDate, endDate } = req.query;

    const result = await auditService.getAuditLogs(schoolId, {
      action,
      entity,
      status,
      search,
      startDate,
      endDate,
      page,
      limit,
    });

    return res.status(200).json(ApiResponse.success(result, 'Logs de auditoria recuperados'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

/**
 * GET /api/audit/:schoolId/actions
 * Returns distinct action types for the filter dropdown.
 */
export const getAuditActions = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const actions = await auditService.getDistinctActions(schoolId);

    return res.status(200).json(ApiResponse.success({ actions }, 'Ações recuperadas'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

/**
 * GET /api/audit/:schoolId/stats
 * Returns audit log statistics for the school.
 */
export const getAuditStats = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const stats = await auditService.getAuditStats(schoolId);

    return res.status(200).json(ApiResponse.success(stats, 'Estatísticas recuperadas'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};
