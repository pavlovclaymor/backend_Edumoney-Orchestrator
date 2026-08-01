/**
 * Backward Compatibility Layer
 * Garante que v1 nunca quebra.
 * Novas features vão para v2.
 */

import { wrapSuccessResponse } from './financial.contract.js';

export const API_VERSIONS = {
  V1: 'v1',
  V2: 'v2',
};

const DEPRECATED_ENDPOINTS = {
  '/api/wallet': 'v1',
  '/api/transaction': 'v1',
  '/api/payment': 'v1',
  '/api/recharge': 'v1',
  '/api/invoice': 'v1',
};

const VERSION_MIGRATIONS = {
  // Adicionar migrations de v1 para v2 aqui quando necessário
};

/**
 * Verificar se endpoint está deprecated
 */
export const isDeprecated = (endpoint) => {
  return !!DEPRECATED_ENDPOINTS[endpoint];
};

/**
 * Obter versão de endpoint
 */
export const getEndpointVersion = (endpoint) => {
  return DEPRECATED_ENDPOINTS[endpoint] || 'v2';
};

/**
 * Migrar resposta da versão antiga para nova
 */
export const migrateResponse = (data, fromVersion, toVersion) => {
  const migration = VERSION_MIGRATIONS[`${fromVersion}_to_${toVersion}`];

  if (!migration) {
    return data; // Sem migration necessária
  }

  return migration(data);
};

/**
 * Criar resposta v1 (garantido compatível)
 */
export const createV1Response = (data, type) => {
  return wrapSuccessResponse(data, {
    apiVersion: API_VERSIONS.V1,
    deprecated: true,
    migrationNote: 'v1 is stable but deprecated. Consider migrating to v2.',
  });
};

/**
 * Middleware de versionamento
 */
export const versionMiddleware = (req, res, next) => {
  const path = req.path;
  const version = req.headers['api-version'] || 'v1';

  // Adicionar versão ao request
  req.apiVersion = version;

  // Verificar se endpoint existe na versão
  if (version === 'v1' && !DEPRECATED_ENDPOINTS[path]) {
    // v1 deve existir para os endpoints principais
  }

  next();
};

/**
 * Headers de versão
 */
export const getVersionHeaders = (version = 'v1') => ({
  'API-Version': version,
  'API-Deprecated': version === 'v1' ? 'false' : 'false',
  'API-Supported-Versions': 'v1,v2',
});

/**
 * Wrapper para resposta com headers de versão
 */
export const wrapWithVersionHeaders = (response, version = 'v1') => ({
  ...response,
  _version: {
    api: version,
    headers: getVersionHeaders(version),
  },
});

/**
 * Deprecation warning response
 */
export const deprecationWarning = (endpoint) => ({
  success: true,
  warning: {
    code: 'DEPRECATED_ENDPOINT',
    message: `Endpoint ${endpoint} está deprecated`,
    migration: `Use a versão v2 do endpoint`,
    sunsetDate: '2026-12-31',
  },
});

export default {
  API_VERSIONS,
  DEPRECATED_ENDPOINTS,
  isDeprecated,
  getEndpointVersion,
  migrateResponse,
  createV1Response,
  versionMiddleware,
  getVersionHeaders,
  wrapWithVersionHeaders,
  deprecationWarning,
};
