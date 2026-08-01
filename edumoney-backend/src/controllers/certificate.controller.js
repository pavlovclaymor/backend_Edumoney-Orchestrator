import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';
import { CertificateDTO } from '../utils/dto/certificate.dto.js';
import CertificateConfig from '../models/certificateConfig.model.js';
import CertificateLog from '../models/certificateLog.model.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import * as certificateService from '../services/certificate.service.js';

/**
 * GET /api/certificate/:schoolId/config
 * Returns the stored certificate configuration for the given school.
 */
export const getConfig = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const config = await CertificateConfig.findOne({ schoolId }).lean();
    if (!config) {
      return res.status(404).json(ErrorResponse.notFound('Configuração'));
    }
    const dto = CertificateDTO.fromConfig(config);
    return res.status(200).json(ApiResponse.success(dto, 'Configuração recuperada'));
  } catch (err) {
    console.error('Erro ao buscar config de certificado:', err);
    return res.status(500).json(ErrorResponse.internal(err.message));
  }
};

/**
 * POST /api/certificate/:schoolId/config
 * Creates or updates the certificate configuration for a school.
 */
export const upsertConfig = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const payload = req.body; // expected fields: templateName, placeholders, etc.
    const config = await CertificateConfig.findOneAndUpdate(
      { schoolId },
      { $set: payload },
      { new: true, upsert: true, runValidators: true },
    ).lean();
    // audit log
    await writeAuditLog({
      userId: req.user._id,
      userModel: 'School',
      action: 'CERTIFICATE_CONFIG_UPSERT',
      entity: 'CertificateConfig',
      entityId: config._id,
      status: 'success',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      schoolId,
    });
    const dto = CertificateDTO.fromConfig(config);
    return res.status(200).json(ApiResponse.success(dto, 'Configuração recuperada'));
  } catch (err) {
    console.error('Erro ao salvar config de certificado:', err);
    return res.status(500).json(ErrorResponse.internal(err.message));
  }
};

/**
 * GET /api/certificate/:schoolId/history
 * Returns paginated list of certificate emission logs.
 */
export const getHistory = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { page = 1, limit = 20, status, search } = req.query;
    const filter = { schoolId };
    if (status) filter.status = status;
    if (search) {
      const regex = { $regex: search, $options: 'i' };
      filter.$or = [
        { studentNumber: regex },
        { studentName: regex },
        { processNumber: regex },
        { requestId: regex },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      CertificateLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      CertificateLog.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / Number(limit));
    const dto = CertificateDTO.fromArray(logs);
    return res.status(200).json(ApiResponse.list(dto, total, 'Histórico recuperado'));
  } catch (err) {
    console.error('Erro ao buscar histórico de certificados:', err);
    return res.status(500).json({ message: 'Erro interno ao buscar histórico' });
  }
};

/**
 * POST /api/certificate/:schoolId/request
 * Submits a new certificate request
 */
export const submitCertificateRequest = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const {
      studentNumber,
      studentName,
      processNumber,
      class: classValue,
      grade,
      documentType,
      reason,
      includeGrades,
      institution,
    } = req.body;

    // Validation
    if (!studentNumber || !studentName || !documentType || !reason) {
      return res.status(400).json(ErrorResponse.badRequest('Campos obrigatórios ausentes'));
    }

    const certificateLog = await certificateService.submitCertificateRequest({
      schoolId,
      studentNumber,
      studentName,
      processNumber,
      class: classValue,
      grade,
      documentType,
      reason,
      includeGrades: includeGrades || false,
      institution,
      requestedBy: req.user._id,
    });

    // Audit log
    await writeAuditLog({
      userId: req.user._id,
      userModel: 'School',
      action: 'CERTIFICATE_REQUEST_SUBMITTED',
      entity: 'CertificateLog',
      entityId: certificateLog._id,
      status: 'success',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      schoolId,
    });

    const dto = CertificateDTO.fromLog(certificateLog);
    return res.status(201).json(ApiResponse.success(dto, 'Solicitação registrada'));
  } catch (err) {
    console.error('Erro ao submeter solicitação de certificado:', err);
    return res.status(500).json(ErrorResponse.internal(err.message));
  }
};

/**
 * PATCH /api/certificate/:schoolId/request/:logId/status
 * Updates the status of a certificate request
 */
export const updateCertificateRequestStatus = async (req, res) => {
  try {
    const { schoolId, logId } = req.params;
    const { status, metadata } = req.body;

    // Validation
    if (!status) {
      return res.status(400).json(ErrorResponse.badRequest('Status é obrigatório'));
    }

    const validStatuses = ['pending', 'submitted', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json(ErrorResponse.badRequest('Status inválido'));
    }

    const certificateLog = await certificateService.updateCertificateRequestStatus(
      logId,
      status,
      metadata,
    );

    // Audit log
    await writeAuditLog({
      userId: req.user._id,
      userModel: 'School',
      action: 'CERTIFICATE_REQUEST_STATUS_UPDATED',
      entity: 'CertificateLog',
      entityId: logId,
      status: 'success',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      schoolId,
      metadata: { newStatus: status },
    });

    const dto = CertificateDTO.fromLog(certificateLog);
    return res.status(200).json(ApiResponse.success(dto, 'Status atualizado'));
  } catch (err) {
    console.error('Erro ao atualizar status da solicitação:', err);
    return res.status(500).json(ErrorResponse.internal(err.message));
  }
};

/**
 * GET /api/certificate/:schoolId/requests
 * Returns paginated certificate requests for a school
 */
export const getCertificateRequests = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { page = 1, limit = 20, status, search } = req.query;

    const result = await certificateService.getCertificateRequests(schoolId, {
      status,
      search,
      page,
      limit,
    });

    return res.status(200).json(ApiResponse.success(result, 'Solicitações recuperadas'));
  } catch (err) {
    console.error('Erro ao buscar solicitações de certificados:', err);
    return res.status(500).json(ErrorResponse.internal(err.message));
  }
};

/**
 * GET /api/certificate/:schoolId/stats
 * Returns certificate statistics for a school
 */
export const getCertificateStats = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const stats = await certificateService.getCertificateStats(schoolId);

    const dto = CertificateDTO.stats(stats);
    return res.status(200).json(ApiResponse.success(dto, 'Estatísticas recuperadas'));
  } catch (err) {
    console.error('Erro ao buscar estatísticas de certificados:', err);
    return res.status(500).json(ErrorResponse.internal(err.message));
  }
};
