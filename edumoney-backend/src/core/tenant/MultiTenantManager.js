/**
 * Multi-Tenant Manager
 * Gerencia isolamento de tenants no sistema financeiro.
 * Cada tenant tem seu próprio:
 * - namespace de dados
 * - quotas e limites
 * - configuração
 */

import crypto from 'crypto';

class MultiTenantManager {
  constructor() {
    this.tenants = new Map();
    this.defaultTenant = {
      id: 'default',
      name: 'Default Tenant',
      status: 'active',
      quotas: {
        maxWallets: 10000,
        maxTransactionsPerDay: 100000,
        maxAmountPerTransaction: 1000000,
        rateLimitPerSecond: 100,
      },
      features: {
        multiCurrency: true,
        webhookNotifications: true,
        invoicePDF: true,
        analytics: true,
      },
    };
  }

  /**
   * Criar tenant
   * @param {Object} config - Configuração do tenant
   */
  createTenant(config) {
    const tenant = {
      id: config.id || crypto.randomUUID(),
      name: config.name,
      status: config.status || 'active',
      createdAt: new Date().toISOString(),
      quotas: {
        maxWallets: config.quotas?.maxWallets || 10000,
        maxTransactionsPerDay: config.quotas?.maxTransactionsPerDay || 100000,
        maxAmountPerTransaction: config.quotas?.maxAmountPerTransaction || 1000000,
        rateLimitPerSecond: config.quotas?.rateLimitPerSecond || 100,
      },
      features: {
        multiCurrency: config.features?.multiCurrency ?? true,
        webhookNotifications: config.features?.webhookNotifications ?? true,
        invoicePDF: config.features?.invoicePDF ?? true,
        analytics: config.features?.analytics ?? true,
      },
      metadata: config.metadata || {},
    };

    this.tenants.set(tenant.id, tenant);
    console.log(`🏢 MultiTenantManager: Created tenant ${tenant.id}`);

    return tenant;
  }

  /**
   * Obter tenant por ID
   * @param {string} tenantId - ID do tenant
   */
  getTenant(tenantId) {
    if (tenantId === 'default' || !this.tenants.has(tenantId)) {
      return this.defaultTenant;
    }
    return this.tenants.get(tenantId);
  }

  /**
   * Validar tenant
   * @param {string} tenantId - ID do tenant
   */
  validateTenant(tenantId) {
    const tenant = this.getTenant(tenantId);

    if (tenant.status !== 'active') {
      throw new Error(`Tenant ${tenantId} is not active`);
    }

    return tenant;
  }

  /**
   * Validar quota de tenant
   * @param {string} tenantId - ID do tenant
   * @param {string} quotaType - Tipo de quota
   * @param {number} value - Valor a validar
   */
  validateQuota(tenantId, quotaType, value) {
    const tenant = this.validateTenant(tenantId);
    const quota = tenant.quotas[quotaType];

    if (quota === undefined) {
      return true;
    }

    if (value > quota) {
      throw new Error(`Quota exceeded for tenant ${tenantId}: ${quotaType} (max: ${quota})`);
    }

    return true;
  }

  /**
   * Verificar feature disponível
   * @param {string} tenantId - ID do tenant
   * @param {string} feature - Nome da feature
   */
  hasFeature(tenantId, feature) {
    const tenant = this.getTenant(tenantId);
    return tenant.features[feature] === true;
  }

  /**
   * Atualizar tenant
   * @param {string} tenantId - ID do tenant
   * @param {Object} updates - Atualizações
   */
  updateTenant(tenantId, updates) {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    Object.assign(tenant, updates, { updatedAt: new Date().toISOString() });
    return tenant;
  }

  /**
   * Desativar tenant
   * @param {string} tenantId - ID do tenant
   */
  deactivateTenant(tenantId) {
    return this.updateTenant(tenantId, { status: 'inactive' });
  }

  /**
   * Listar todos os tenants
   */
  listTenants() {
    return Array.from(this.tenants.values());
  }

  /**
   * Obter estatísticas de tenant
   * @param {string} tenantId - ID do tenant
   */
  getTenantStats(tenantId) {
    const tenant = this.getTenant(tenantId);

    return {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      createdAt: tenant.createdAt,
      quotas: tenant.quotas,
      features: tenant.features,
    };
  }

  /**
   * Gerar namespace para tenant
   * @param {string} tenantId - ID do tenant
   * @param {string} collection - Nome da collection
   */
  getNamespace(tenantId, collection) {
    return `tenant_${tenantId}_${collection}`;
  }

  /**
   * Validar limites de transação
   * @param {string} tenantId - ID do tenant
   * @param {number} amount - Valor da transação
   */
  validateTransactionLimit(tenantId, amount) {
    return this.validateQuota(tenantId, 'maxAmountPerTransaction', amount);
  }
}

export const multiTenantManager = new MultiTenantManager();
export default multiTenantManager;
