/**
 * Infrastructure Module Index
 *
 * Exports centralizados da infraestrutura.
 */

export { eventBridge } from './redis/EventBridge.js';
export { redisRecoveryManager } from './redis/RedisRecoveryManager.js';
export { financialSocketGateway } from './socket/FinancialSocketGateway.js';
