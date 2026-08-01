import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';
import * as dashboardService from '../services/dashboard.service.js';

export const getFinancialMetrics = async (req, res) => {
  try {
    const { schoolId } = req.params;
    if (String(req.user._id) !== String(schoolId)) {
      return res.status(403).json(ErrorResponse.forbidden('Nao autorizado'));
    }
    const metrics = await dashboardService.getFinancialMetrics(schoolId);
    return res
      .status(200)
      .json(
        ApiResponse.success(
          { metrics, recentTransactions: [] },
          'Metricas financeiras recuperadas',
        ),
      );
  } catch (error) {
    console.error('Erro ao buscar metricas financeiras:', error);
    return res.status(500).json(ErrorResponse.internal('Erro ao buscar metricas financeiras'));
  }
};

export const getRevenueData = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { startDate, endDate } = req.query;
    if (String(req.user._id) !== String(schoolId)) {
      return res.status(403).json(ErrorResponse.forbidden('Nao autorizado'));
    }
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const revenueData = await dashboardService.getRevenueByDate(schoolId, start, end);
    return res
      .status(200)
      .json(
        ApiResponse.success(
          { data: Array.isArray(revenueData) ? revenueData : [] },
          'Dados de receita recuperados',
        ),
      );
  } catch (error) {
    console.error('Erro ao buscar dados de receita:', error);
    return res.status(500).json(ErrorResponse.internal('Erro ao buscar dados de receita'));
  }
};

export const getMerchantStats = async (req, res) => {
  try {
    const { schoolId } = req.params;
    if (String(req.user._id) !== String(schoolId)) {
      return res.status(403).json(ErrorResponse.forbidden('Nao autorizado'));
    }
    const stats = await dashboardService.getMerchantStats(schoolId);
    return res
      .status(200)
      .json(ApiResponse.success({ stats }, 'Estatisticas de comerciantes recuperadas'));
  } catch (error) {
    console.error('Erro ao buscar estatisticas de comerciantes:', error);
    return res
      .status(500)
      .json(ErrorResponse.internal('Erro ao buscar estatisticas de comerciantes'));
  }
};

export const getCertificateStats = async (req, res) => {
  try {
    const { schoolId } = req.params;
    if (String(req.user._id) !== String(schoolId)) {
      return res.status(403).json(ErrorResponse.forbidden('Nao autorizado'));
    }
    const stats = await dashboardService.getCertificateRequestStats(schoolId);
    return res
      .status(200)
      .json(ApiResponse.success({ stats }, 'Estatisticas de certificados recuperadas'));
  } catch (error) {
    console.error('Erro ao buscar estatisticas de certificados:', error);
    return res
      .status(500)
      .json(ErrorResponse.internal('Erro ao buscar estatisticas de certificados'));
  }
};

export const getRecentTransactions = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { limit = 10 } = req.query;
    if (String(req.user._id) !== String(schoolId)) {
      return res.status(403).json(ErrorResponse.forbidden('Nao autorizado'));
    }
    const transactions = await dashboardService.getRecentTransactions(schoolId, Number(limit));
    return res
      .status(200)
      .json(
        ApiResponse.success(
          { transactions: Array.isArray(transactions) ? transactions : [] },
          'Transacoes recentes recuperadas',
        ),
      );
  } catch (error) {
    console.error('Erro ao buscar transacoes recentes:', error);
    return res.status(500).json(ErrorResponse.internal('Erro ao buscar transacoes recentes'));
  }
};

export const getTopMerchants = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { limit = 5 } = req.query;
    if (String(req.user._id) !== String(schoolId)) {
      return res.status(403).json(ErrorResponse.forbidden('Nao autorizado'));
    }
    const merchants = await dashboardService.getTopMerchants(schoolId, Number(limit));
    return res
      .status(200)
      .json(ApiResponse.success({ merchants }, 'Comerciantes principais recuperados'));
  } catch (error) {
    console.error('Erro ao buscar comerciantes principais:', error);
    return res.status(500).json(ErrorResponse.internal('Erro ao buscar comerciantes principais'));
  }
};
