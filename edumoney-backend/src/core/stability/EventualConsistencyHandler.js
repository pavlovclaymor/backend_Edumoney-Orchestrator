/**
 * Eventual Consistency Handler
 * Garante que frontend trata corretamente eventual consistency.
 * Adiciona metadados de sincronização em todas as respostas.
 */

import crypto from 'crypto';

/**
 * Adicionar metadata de consistência a resposta
 * @param {Object} response - Resposta original
 * @param {Object} options - Opções de consistência
 */
export const addConsistencyMetadata = (response, options = {}) => {
  const { syncDelay = 0, isOptimistic = false, requiresConfirmation = false } = options;

  return {
    ...response,
    _meta: {
      version: 'v1',
      timestamp: new Date().toISOString(),
      syncDelay,
      isOptimistic,
      requiresConfirmation,
      consistencyModel: 'eventual',
      lastVerified: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    },
  };
};

/**
 * Criar resposta de confirmação de sincronização
 */
export const createSyncConfirmation = (transactionId, status) => {
  return {
    transactionId,
    status,
    confirmed: true,
    syncedAt: new Date().toISOString(),
    syncStatus: 'confirmed',
    message: 'Transação sincronizada com sucesso',
  };
};

/**
 * Criar resposta de reconciliação de wallet
 */
export const createWalletReconciliation = (walletData, ledgerData) => {
  const walletBalance = Number(walletData.balance || 0);
  const ledgerBalance = ledgerData.calculatedBalance || 0;
  const difference = Math.abs(walletBalance - ledgerBalance);
  const isConsistent = difference < 0.01;

  return {
    walletId: walletData._id?.toString() || walletData.id,
    walletBalance,
    ledgerBalance,
    difference,
    isConsistent,
    reconciliationStatus: isConsistent ? 'SYNCED' : 'RECONCILING',
    lastReconciliation: new Date().toISOString(),
    _meta: {
      type: 'reconciliation',
      timestamp: new Date().toISOString(),
    },
  };
};

/**
 * Criar resposta de confirmação de pagamento
 */
export const createPaymentConfirmation = (paymentData, transactionData) => {
  return {
    paymentId: paymentData.id,
    transactionId: transactionData?.id,
    status: paymentData.status,
    amount: paymentData.amount,
    confirmed: paymentData.status === 'success' || paymentData.status === 'completed',
    syncedAt: new Date().toISOString(),
    _meta: {
      type: 'payment_confirmation',
      timestamp: new Date().toISOString(),
      requiresReconciliation: true,
    },
  };
};

/**
 * Indicadores de delay de sincronização
 */
export const createSyncIndicators = (entityType, lastUpdate) => {
  const now = Date.now();
  const lastUpdateTime = new Date(lastUpdate).getTime();
  const delayMs = now - lastUpdateTime;

  return {
    entityType,
    lastUpdate,
    delayMs,
    isStale: delayMs > 5000, // 5 segundos
    isVeryStale: delayMs > 30000, // 30 segundos
    syncHealth: delayMs < 1000 ? 'excellent' : delayMs < 5000 ? 'good' : 'degraded',
  };
};

/**
 * Wrapper para respostas com eventual consistency
 */
export const wrapWithConsistency = (data, type, additionalMeta = {}) => {
  return {
    ...data,
    _meta: {
      type,
      version: 'v1',
      timestamp: new Date().toISOString(),
      consistencyModel: 'eventual',
      ...additionalMeta,
    },
  };
};

/**
 * Frontend-safe response for transactions
 */
export const frontendTransactionResponse = (transaction, options = {}) => {
  const { includeSyncIndicators = true } = options;

  const baseResponse = {
    id: transaction.id || transaction._id?.toString(),
    amount: transaction.amount,
    type: transaction.type,
    status: transaction.status,
    createdAt: transaction.createdAt,
    _frontend: {
      isOptimistic: false,
      requiresSync: transaction.status === 'pending' || transaction.status === 'processing',
      canRetry: transaction.status === 'failed',
    },
  };

  if (includeSyncIndicators) {
    baseResponse._sync = createSyncIndicators(
      'transaction',
      transaction.updatedAt || transaction.createdAt,
    );
  }

  return baseResponse;
};

/**
 * Frontend-safe response for wallet
 */
export const frontendWalletResponse = (wallet, options = {}) => {
  const { includeLedgerCheck = true, includeSyncIndicators = true } = options;

  const baseResponse = {
    id: wallet.id || wallet._id?.toString(),
    ownerId: wallet.ownerId?.toString(),
    balance: wallet.balance,
    currency: wallet.currency || 'AOA',
    status: wallet.isFrozen ? 'frozen' : 'active',
    updatedAt: wallet.updatedAt,
    _frontend: {
      isOptimistic: false,
      requiresSync: false,
      canReceive: !wallet.isFrozen,
    },
  };

  if (includeSyncIndicators) {
    baseResponse._sync = createSyncIndicators('wallet', wallet.updatedAt);
  }

  return baseResponse;
};

/**
 * Criar estado de carregamento otimista
 */
export const createOptimisticUpdate = (type, data, optimisticState) => {
  return {
    type,
    data,
    _optimistic: {
      enabled: true,
      state: optimisticState,
      createdAt: new Date().toISOString(),
      willReconcile: true,
    },
  };
};

/**
 * Verificar se resposta está sincronizada
 */
export const isSynced = (response) => {
  const meta = response._meta || response._sync;

  if (!meta) return true; // Sem metadata, assume synced

  if (meta.isStale) {
    return {
      synced: false,
      reason: 'stale_data',
      lastSync: meta.lastVerified || meta.lastUpdate,
    };
  }

  return { synced: true };
};

export default {
  addConsistencyMetadata,
  createSyncConfirmation,
  createWalletReconciliation,
  createPaymentConfirmation,
  createSyncIndicators,
  wrapWithConsistency,
  frontendTransactionResponse,
  frontendWalletResponse,
  createOptimisticUpdate,
  isSynced,
};
