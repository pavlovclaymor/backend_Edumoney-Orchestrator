/**
 * RUPE Data Transfer Object
 * Transforma dados do RUPE para exposição ao Frontend
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
 * Mapeia estado do RUPE para formato padronizado
 */
const mapRupeState = (estado) => {
  const states = {
    PENDENTE: 'pending',
    PAGO: 'paid',
    CANCELADO: 'cancelled',
    EXPIRADO: 'expired',
  };
  return states[estado?.toUpperCase()] || estado || 'unknown';
};

export const RupeDTO = {
  /**
   * Transforma um RUPE
   */
  fromRupe: (rupe) => {
    if (!rupe) return null;
    return {
      id: extractId(rupe),
      reference: toSafeString(rupe.referencia),
      serviceType: toSafeString(rupe.tipoServico),
      amount: toSafeNumber(rupe.valor),
      state: mapRupeState(rupe.estado),
      quantity: toSafeNumber(rupe.quantidade),
      userId: toSafeString(rupe.userId),
      schoolId: toSafeString(rupe.schoolId),
      createdAt: rupe.createdAt?.toISOString?.() || rupe.createdAt,
      expiresAt: rupe.dataExpiracao?.toISOString?.() || rupe.dataExpiracao,
    };
  },

  /**
   * Transforma lista de RUPEs
   */
  fromArray: (rupes = []) => {
    if (!Array.isArray(rupes)) return [];
    return rupes.map(RupeDTO.fromRupe);
  },

  /**
   * Resumo para PendingRupe
   */
  pendingSummary: (rupes = [], total) => ({
    totalAmount: toSafeNumber(total),
    quantity: rupes.length,
    items: RupeDTO.fromArray(rupes),
  }),
};

export default RupeDTO;
