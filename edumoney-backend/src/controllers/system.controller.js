import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';
/**
 * System Controller
 * Delega toda a lógica de negócio para system.service.js
 * O controller apenas recebe req/res e passa para o service.
 */

import * as systemService from '../services/system.service.js';
import { writeAuditLog } from '../utils/auditLogger.js';

// =========================================================
// HEALTH CHECK
// =========================================================
export const getHealth = async (req, res) => {
  try {
    const health = await systemService.getHealth();

    return res.status(200).json(health);
  } catch (error) {
    const status = error.status || 500;
    const message = error.message || 'Erro interno';
    return res.status(status).json({ message });
  }
};

// =========================================================
// REDIS STATUS
// =========================================================
export const getRedisStatus = async (req, res) => {
  try {
    const status = await systemService.getRedisStatus();

    return res.status(200).json(status);
  } catch (error) {
    const status = error.status || 500;
    const message = error.message || 'Erro interno';
    return res.status(status).json({ message });
  }
};

// =========================================================
// SYSTEM STATS
// =========================================================
export const getStats = async (req, res) => {
  try {
    const stats = await systemService.getStats();

    return res.status(200).json(stats);
  } catch (error) {
    const status = error.status || 500;
    const message = error.message || 'Erro interno';
    return res.status(status).json({ message });
  }
};

// =========================================================
// SYSTEM EVENTS
// =========================================================
export const getEvents = async (req, res) => {
  try {
    const { limit, type, action, startDate, endDate } = req.query;

    const options = {
      limit: limit ? Number(limit) : 50,
    };

    if (type) options.type = type;
    if (action) options.action = action;
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    const events = await systemService.getEvents(options);

    return res.status(200).json({ events });
  } catch (error) {
    const status = error.status || 500;
    const message = error.message || 'Erro interno';
    return res.status(status).json({ message });
  }
};

// =========================================================
// WORKERS STATUS
// =========================================================
export const getWorkersStatus = async (req, res) => {
  try {
    const status = await systemService.getWorkersStatus();

    return res.status(200).json(status);
  } catch (error) {
    const status = error.status || 500;
    const message = error.message || 'Erro interno';
    return res.status(status).json({ message });
  }
};
