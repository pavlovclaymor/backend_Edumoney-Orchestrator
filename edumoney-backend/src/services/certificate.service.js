import CertificateLog from '../models/certificateLog.model.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Certificate Service
 * Handles certificate request tracking and management.
 * This service remains decoupled and integration-ready for external certificate providers.
 */

/**
 * Creates a new certificate request
 * @param {Object} params - Request parameters
 * @param {String} params.schoolId - School ID
 * @param {String} params.studentNumber - Student number
 * @param {String} params.studentName - Student name
 * @param {String} params.processNumber - Process number
 * @param {String} params.class - Class name
 * @param {String} params.grade - Grade
 * @param {String} params.documentType - Document type (Certificado/Declaração)
 * @param {String} params.reason - Reason for request
 * @param {Boolean} params.includeGrades - Include grades in document
 * @param {String} params.institution - Institution name
 * @param {String} params.requestedBy - User ID who submitted the request
 * @returns {Promise<Object>} Created certificate log document
 */
export const submitCertificateRequest = async ({
  schoolId,
  studentNumber,
  studentName,
  processNumber,
  class: classValue,
  grade,
  documentType,
  reason,
  includeGrades = false,
  institution,
  requestedBy,
}) => {
  try {
    // Generate unique request ID
    const requestId = `CERT-${uuidv4().substring(0, 8).toUpperCase()}`;

    const certificateLog = await CertificateLog.create({
      schoolId,
      studentNumber,
      studentName,
      processNumber,
      class: classValue,
      grade,
      documentType,
      reason,
      includeGrades,
      institution,
      requestId,
      status: 'issued', // Keep existing status field for backward compatibility
      requestStatus: 'submitted', // New tracking status
      requestedBy,
      statusUpdatedAt: new Date(),
      metadata: {
        initialSubmissionTime: new Date().toISOString(),
      },
    });

    return certificateLog;
  } catch (error) {
    throw error;
  }
};

/**
 * Updates the status of a certificate request
 * @param {String} logId - Certificate log ID
 * @param {String} newStatus - New status (submitted, completed, failed)
 * @param {Object} metadata - Optional metadata for tracking external responses
 * @returns {Promise<Object>} Updated certificate log
 */
export const updateCertificateRequestStatus = async (logId, newStatus, metadata = null) => {
  try {
    const update = {
      requestStatus: newStatus,
      statusUpdatedAt: new Date(),
    };

    if (metadata) {
      update.metadata = metadata;
    }

    const certificateLog = await CertificateLog.findByIdAndUpdate(logId, update, { new: true });

    if (!certificateLog) {
      throw new Error('Certificate log not found');
    }

    return certificateLog;
  } catch (error) {
    throw error;
  }
};

/**
 * Gets certificate request details by log ID
 * @param {String} logId - Certificate log ID
 * @returns {Promise<Object>} Certificate log document
 */
export const getCertificateRequestDetails = async (logId) => {
  try {
    const certificateLog = await CertificateLog.findById(logId).lean();
    return certificateLog;
  } catch (error) {
    throw error;
  }
};

/**
 * Gets certificate requests for a school with filtering and pagination
 * @param {String} schoolId - School ID
 * @param {Object} options - Filtering options
 * @param {String} options.status - Filter by request status
 * @param {String} options.search - Search term
 * @param {Number} options.page - Page number
 * @param {Number} options.limit - Results per page
 * @returns {Promise<Object>} Paginated results
 */
export const getCertificateRequests = async (schoolId, options = {}) => {
  try {
    const { status, search, page = 1, limit = 20 } = options;

    const filter = { schoolId };

    if (status) {
      filter.requestStatus = status;
    }

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
    throw error;
  }
};

/**
 * Gets certificate statistics for a school
 * @param {String} schoolId - School ID
 * @returns {Promise<Object>} Statistics
 */
export const getCertificateStats = async (schoolId) => {
  try {
    const schoolIdObj = new require('mongoose').Types.ObjectId(schoolId);
    const stats = await CertificateLog.aggregate([
      { $match: { schoolId: schoolIdObj } },
      {
        $facet: {
          totalRequests: [{ $count: 'count' }],
          byStatus: [{ $group: { _id: '$requestStatus', count: { $count: 'count' } } }],
          successRate: [
            {
              $group: {
                _id: null,
                completed: { $sum: { $cond: [{ $eq: ['$requestStatus', 'completed'] }, 1, 0] } },
                failed: { $sum: { $cond: [{ $eq: ['$requestStatus', 'failed'] }, 1, 0] } },
                total: { $count: 'count' },
              },
            },
          ],
        },
      },
    ]);

    return {
      totalRequests: stats[0]?.totalRequests[0]?.count || 0,
      byStatus: stats[0]?.byStatus || [],
      successRate: stats[0]?.successRate[0] || { completed: 0, failed: 0, total: 0 },
    };
  } catch (error) {
    throw error;
  }
};
