/**
 * Financial Socket Gateway
 *
 * Camada que consome Redis events e emite via Socket.IO para frontend.
 *
 * Responsabilidades:
 * - Consumir eventos do Redis
 * - Emitir via Socket.IO
 * - Garantir eventId uniqueness
 * - Garantir ordering básico
 *
 * Regra: "Se um evento acontecer no backend, o frontend deve saber imediatamente"
 */

import { redisSubscriber } from '../../core/redis/index.js';
import crypto from 'crypto';

class FinancialSocketGateway {
  constructor() {
    this.io = null;
    this.connectedClients = new Map(); // socketId -> userId
    this.eventCache = new Map(); // eventId -> event (deduplication)
    this.maxCacheSize = 10000;

    // Event channels para subscribe
    this.channels = [
      'wallet:credited',
      'wallet:debited',
      'wallet:created',
      'transaction:created',
      'transaction:completed',
      'transaction:failed',
      'ledger:created',
      'ledger:updated',
      'payment:initiated',
      'payment:completed',
      'payment:failed',
      'invoice:created',
      'invoice:paid',
      'recharge:created',
      'recharge:completed',
      'student:import:completed',
      'system:import_completed',
    ];
  }

  /**
   * Inicializar gateway com Socket.IO
   */
  initialize(io) {
    this.io = io;

    // Setup Socket.IO event handlers
    this.setupSocketHandlers();

    // Subscribe a eventos Redis
    this.subscribeToRedisEvents();

    console.log('✅ FinancialSocketGateway: Initialized');

    return this;
  }

  /**
   * Setup handlers de Socket.IO
   */
  setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      const socketId = socket.id;

      console.log(`🔌 Socket connected: ${socketId}`);

      // Autenticação
      socket.on('authenticate', (data) => {
        const userId = data.userId;
        const tenantId = data.tenantId;

        if (userId) {
          this.connectedClients.set(socketId, { userId, tenantId });
          socket.join(`tenant:${tenantId}`);
          socket.join(`user:${userId}`);

          // Enviar eventos pendentes do cache
          this.sendPendingEvents(socket, userId);

          console.log(`🔐 Socket authenticated: ${socketId} -> user:${userId}`);
        }
      });

      // Subscribe a canais específicos
      socket.on('subscribe', (channel) => {
        const client = this.connectedClients.get(socketId);
        if (client) {
          socket.join(channel);
          console.log(`📡 Socket subscribed: ${socketId} -> ${channel}`);
        }
      });

      // Unsubscribe de canais
      socket.on('unsubscribe', (channel) => {
        socket.leave(channel);
        console.log(`📡 Socket unsubscribed: ${socketId} <- ${channel}`);
      });

      // Request para replay de eventos
      socket.on('request_replay', (data) => {
        this.handleReplayRequest(socket, data);
      });

      // Disconnect
      socket.on('disconnect', () => {
        this.connectedClients.delete(socketId);
        console.log(`🔌 Socket disconnected: ${socketId}`);
      });
    });
  }

  /**
   * Subscribe a eventos Redis
   */
  subscribeToRedisEvents() {
    // Usar EventBus existente ou Redis Pub/Sub
    // Aqui integramos com o EventBus
    this.subscribeToEventBus();

    // Se Redis subscriber disponível, usar também
    if (redisSubscriber && redisSubscriber.subscribe) {
      this.subscribeToRedisPubSub();
    }
  }

  /**
   * Subscribe ao EventBus
   */
  subscribeToEventBus() {
    const { EventBus } = require('../../core/events/EventBus.js');
    const eventBus = EventBus.getInstance();

    for (const channel of this.channels) {
      eventBus.subscribe(channel, (event) => {
        this.handleEvent(channel, event);
      });
    }
  }

  /**
   * Subscribe ao Redis Pub/Sub
   */
  subscribeToRedisPubSub() {
    for (const channel of this.channels) {
      const redisChannel = `event:${channel}`;

      redisSubscriber.subscribe(redisChannel, (message) => {
        try {
          const event = JSON.parse(message);
          this.handleEvent(channel, event);
        } catch (error) {
          console.error('SocketGateway: Redis parse error', error.message);
        }
      });
    }
  }

  /**
   * Processar evento recebido
   */
  handleEvent(channel, event) {
    // Gerar eventId se não existir
    const eventId = event.eventId || crypto.randomUUID();

    // Deduplicar
    if (this.eventCache.has(eventId)) {
      console.log(`⚠️ Duplicate event filtered: ${eventId}`);
      return;
    }

    // Adicionar ao cache
    this.eventCache.set(eventId, {
      ...event,
      channel,
      processedAt: new Date().toISOString(),
    });

    // Limpar cache se muito grande
    if (this.eventCache.size > this.maxCacheSize) {
      const first = this.eventCache.keys().next().value;
      this.eventCache.delete(first);
    }

    // Preparar payload para frontend
    const payload = this.formatPayload(channel, event, eventId);

    // Emitir para sockets
    this.emitToClients(channel, payload);
  }

  /**
   * Formatar payload para frontend
   */
  formatPayload(channel, event, eventId) {
    return {
      eventId,
      type: channel,
      timestamp: new Date().toISOString(),
      data: event,
      // Metadados para UI
      ui: {
        shouldUpdateWallet: channel.startsWith('wallet:'),
        shouldUpdateLedger: channel.startsWith('ledger:'),
        shouldUpdateTransaction: channel.startsWith('transaction:'),
        shouldUpdatePayment: channel.startsWith('payment:'),
        shouldUpdateInvoice: channel.startsWith('invoice:'),
      },
    };
  }

  /**
   * Emitir para clientes Socket.IO
   */
  emitToClients(channel, payload) {
    if (!this.io) return;

    // 1. Emit para canal específico
    this.io.to(channel).emit(channel, payload);

    // 2. Emit para canal global de financeiro
    this.io.to('financial:all').emit('financial:event', payload);

    // 3. Emit para tenant específico (se houver tenantId no evento)
    if (payload.data.tenantId) {
      this.io.to(`tenant:${payload.data.tenantId}`).emit(channel, payload);
    }

    // 4. Emit para usuário específico (se houver userId no evento)
    const targetUserId = payload.data.userId || payload.data.senderId || payload.data.receiverId;
    if (targetUserId) {
      this.io.to(`user:${targetUserId}`).emit(channel, payload);
    }
  }

  /**
   * Enviar eventos pendentes para socket
   */
  sendPendingEvents(socket, userId) {
    const pendingEvents = [];

    for (const [eventId, event] of this.eventCache.entries()) {
      if (
        event.data.userId === userId ||
        event.data.senderId === userId ||
        event.data.receiverId === userId
      ) {
        pendingEvents.push(event);
      }
    }

    if (pendingEvents.length > 0) {
      socket.emit('events:pending', {
        events: pendingEvents.slice(-50), // Últimos 50
        count: pendingEvents.length,
      });
    }
  }

  /**
   * Handle request de replay
   */
  handleReplayRequest(socket, data) {
    const { userId, fromTimestamp, channel } = data;

    const events = [];
    for (const [eventId, event] of this.eventCache.entries()) {
      if (event.data.userId === userId) {
        if (fromTimestamp && new Date(event.timestamp) < new Date(fromTimestamp)) {
          continue;
        }
        if (channel && !event.channel.includes(channel)) {
          continue;
        }
        events.push(event);
      }
    }

    socket.emit('events:replay', {
      events: events.slice(-100), // Últimos 100
      total: events.length,
    });
  }

  /**
   * Emitir evento manual (para uso interno)
   */
  emitManual(channel, data) {
    this.handleEvent(channel, data);
  }

  /**
   * Broadcast para todos os tenants
   */
  broadcastToAllTenants(payload) {
    if (!this.io) return;
    this.io.to('financial:all').emit('financial:broadcast', payload);
  }

  /**
   * Obter status do gateway
   */
  getStatus() {
    return {
      connectedClients: this.connectedClients.size,
      cachedEvents: this.eventCache.size,
      channels: this.channels,
      ioConnected: !!this.io,
    };
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.connectedClients.clear();
    this.eventCache.clear();
    console.log('FinancialSocketGateway: Cleanup complete');
  }
}

// Singleton
export const financialSocketGateway = new FinancialSocketGateway();
export default financialSocketGateway;
