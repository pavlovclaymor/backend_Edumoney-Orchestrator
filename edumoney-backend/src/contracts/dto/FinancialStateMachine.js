/**
 * Financial State Machine
 * Define todos os estados financeiros permitidos no sistema.
 * NUNCA inventar estado novo sem atualizar este arquivo.
 */

export const TRANSACTION_STATES = {
  INITIATED: 'initiated',
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  REVERSED: 'reversed',
};

export const PAYMENT_STATES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const RECHARGE_STATES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
};

export const INVOICE_STATES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAID: 'paid',
  CANCELLED: 'cancelled',
};

export const WALLET_STATES = {
  ACTIVE: 'active',
  FROZEN: 'frozen',
  INACTIVE: 'inactive',
};

/**
 * Validar transição de estado de transação
 * @param {string} currentState - Estado atual
 * @param {string} newState - Novo estado
 * @returns {Object} Resultado da validação
 */
export const validateTransactionTransition = (currentState, newState) => {
  const validTransitions = {
    [TRANSACTION_STATES.INITIATED]: [TRANSACTION_STATES.PENDING, TRANSACTION_STATES.FAILED],
    [TRANSACTION_STATES.PENDING]: [TRANSACTION_STATES.PROCESSING, TRANSACTION_STATES.FAILED],
    [TRANSACTION_STATES.PROCESSING]: [TRANSACTION_STATES.SUCCESS, TRANSACTION_STATES.FAILED],
    [TRANSACTION_STATES.SUCCESS]: [TRANSACTION_STATES.REVERSED],
    [TRANSACTION_STATES.FAILED]: [],
    [TRANSACTION_STATES.REVERSED]: [],
  };

  const allowed = validTransitions[currentState] || [];

  if (!allowed.includes(newState)) {
    return {
      valid: false,
      error: `Invalid state transition: ${currentState} → ${newState}`,
      allowedTransitions: allowed,
    };
  }

  return { valid: true };
};

/**
 * Validar transição de estado de pagamento
 */
export const validatePaymentTransition = (currentState, newState) => {
  const validTransitions = {
    [PAYMENT_STATES.PENDING]: [PAYMENT_STATES.PROCESSING, PAYMENT_STATES.FAILED],
    [PAYMENT_STATES.PROCESSING]: [PAYMENT_STATES.COMPLETED, PAYMENT_STATES.FAILED],
    [PAYMENT_STATES.COMPLETED]: [],
    [PAYMENT_STATES.FAILED]: [],
  };

  const allowed = validTransitions[currentState] || [];

  return {
    valid: allowed.includes(newState),
    error: allowed.includes(newState) ? null : `Invalid transition: ${currentState} → ${newState}`,
  };
};

/**
 * Validar transição de estado de recarga
 */
export const validateRechargeTransition = (currentState, newState) => {
  const validTransitions = {
    [RECHARGE_STATES.PENDING]: [RECHARGE_STATES.PROCESSING, RECHARGE_STATES.FAILED],
    [RECHARGE_STATES.PROCESSING]: [RECHARGE_STATES.SUCCESS, RECHARGE_STATES.FAILED],
    [RECHARGE_STATES.SUCCESS]: [],
    [RECHARGE_STATES.FAILED]: [],
  };

  const allowed = validTransitions[currentState] || [];

  return {
    valid: allowed.includes(newState),
    error: allowed.includes(newState) ? null : `Invalid transition: ${currentState} → ${newState}`,
  };
};

/**
 * Normalizar estado de transação
 */
export const normalizeTransactionState = (state) => {
  const stateMap = {
    INITIATED: TRANSACTION_STATES.INITIATED,
    PENDING: TRANSACTION_STATES.PENDING,
    PROCESSING: TRANSACTION_STATES.PROCESSING,
    SUCCESS: TRANSACTION_STATES.SUCCESS,
    COMPLETED: TRANSACTION_STATES.SUCCESS,
    FAILED: TRANSACTION_STATES.FAILED,
    REVERSED: TRANSACTION_STATES.REVERSED,
    // Frontend states
    pending: TRANSACTION_STATES.PENDING,
    processing: TRANSACTION_STATES.PROCESSING,
    success: TRANSACTION_STATES.SUCCESS,
    completed: TRANSACTION_STATES.SUCCESS,
    failed: TRANSACTION_STATES.FAILED,
    reversed: TRANSACTION_STATES.REVERSED,
  };

  return stateMap[state] || state;
};

/**
 * Normalizar estado de pagamento
 */
export const normalizePaymentState = (state) => {
  const stateMap = {
    PENDING: PAYMENT_STATES.PENDING,
    PROCESSING: PAYMENT_STATES.PROCESSING,
    COMPLETED: PAYMENT_STATES.COMPLETED,
    SUCCESS: PAYMENT_STATES.COMPLETED,
    FAILED: PAYMENT_STATES.FAILED,
    // Frontend states
    pending: PAYMENT_STATES.PENDING,
    processing: PAYMENT_STATES.PROCESSING,
    completed: PAYMENT_STATES.COMPLETED,
    success: PAYMENT_STATES.COMPLETED,
    failed: PAYMENT_STATES.FAILED,
  };

  return stateMap[state] || state;
};

/**
 * Obter estado terminal (final)
 */
export const isTerminalState = (entityType, state) => {
  const terminalStates = {
    transaction: [
      TRANSACTION_STATES.SUCCESS,
      TRANSACTION_STATES.FAILED,
      TRANSACTION_STATES.REVERSED,
    ],
    payment: [PAYMENT_STATES.COMPLETED, PAYMENT_STATES.FAILED],
    recharge: [RECHARGE_STATES.SUCCESS, RECHARGE_STATES.FAILED],
    invoice: [INVOICE_STATES.PAID, INVOICE_STATES.CANCELLED],
    wallet: [WALLET_STATES.FROZEN, WALLET_STATES.INACTIVE],
  };

  return (terminalStates[entityType] || []).includes(state);
};

/**
 * Obter descrição do estado
 */
export const getStateDescription = (entityType, state) => {
  const descriptions = {
    transaction: {
      [TRANSACTION_STATES.INITIATED]: 'Transação iniciada',
      [TRANSACTION_STATES.PENDING]: 'Aguardando processamento',
      [TRANSACTION_STATES.PROCESSING]: 'Processando',
      [TRANSACTION_STATES.SUCCESS]: 'Concluída com sucesso',
      [TRANSACTION_STATES.FAILED]: 'Falhou',
      [TRANSACTION_STATES.REVERSED]: 'Revertida',
    },
    payment: {
      [PAYMENT_STATES.PENDING]: 'Pagamento pendente',
      [PAYMENT_STATES.PROCESSING]: 'Processando pagamento',
      [PAYMENT_STATES.COMPLETED]: 'Pagamento concluído',
      [PAYMENT_STATES.FAILED]: 'Pagamento falhou',
    },
    recharge: {
      [RECHARGE_STATES.PENDING]: 'Recarga pendente',
      [RECHARGE_STATES.PROCESSING]: 'Processando recarga',
      [RECHARGE_STATES.SUCCESS]: 'Recarga concluída',
      [RECHARGE_STATES.FAILED]: 'Recarga falhou',
    },
  };

  return descriptions[entityType]?.[state] || state;
};

export default {
  TRANSACTION_STATES,
  PAYMENT_STATES,
  RECHARGE_STATES,
  INVOICE_STATES,
  WALLET_STATES,
  validateTransactionTransition,
  validatePaymentTransition,
  validateRechargeTransition,
  normalizeTransactionState,
  normalizePaymentState,
  isTerminalState,
  getStateDescription,
};
