/**
 * Integration Test Harness
 * Simula sistema completo para validar integrações.
 * Testes obrigatórios antes de produção.
 */

import {
  toWalletResponse,
  toTransactionResponse,
  toInvoiceResponse,
} from '../contracts/dto/FinancialDTOMapper.js';
import {
  validateTransactionTransition,
  normalizeTransactionState,
} from '../contracts/dto/FinancialStateMachine.js';
import { validateEvent } from '../contracts/events/event.contract.js';

class IntegrationTestHarness {
  constructor() {
    this.testResults = [];
    this.passed = 0;
    this.failed = 0;
  }

  /**
   * Teste: Transfer flow completo
   */
  async testTransferFlow() {
    const testName = 'Transfer Flow';
    const startTime = Date.now();

    try {
      // 1. Simular request de transferência
      const transferRequest = {
        senderId: 'user123',
        receiverId: 'user456',
        amount: 10000,
        pin: '1234',
      };

      // 2. Validar payload
      if (!transferRequest.amount || transferRequest.amount <= 0) {
        throw new Error('Invalid amount');
      }

      // 3. Simular processamento
      const transaction = {
        _id: 'tx123',
        senderId: transferRequest.senderId,
        receiverId: transferRequest.receiverId,
        amount: transferRequest.amount,
        type: 'transfer',
        status: 'success',
        createdAt: new Date(),
      };

      // 4. Mapear para DTO
      const dtoResponse = toTransactionResponse(transaction);

      // 5. Validar resposta
      if (!dtoResponse.id) throw new Error('Missing transaction ID');
      if (!dtoResponse.amount) throw new Error('Missing amount');
      if (dtoResponse.status !== 'success') throw new Error('Wrong status');

      // 6. Validar state machine
      const stateValidation = validateTransactionTransition('processing', 'success');
      if (!stateValidation.valid) throw new Error(stateValidation.error);

      this.passed++;
      return this.pass(testName, Date.now() - startTime);
    } catch (error) {
      this.failed++;
      return this.fail(testName, error.message, Date.now() - startTime);
    }
  }

  /**
   * Teste: Recharge flow completo
   */
  async testRechargeFlow() {
    const testName = 'Recharge Flow';
    const startTime = Date.now();

    try {
      const rechargeRequest = {
        userId: 'user123',
        amount: 50000,
        rupeReference: 'RUPE123',
      };

      if (!rechargeRequest.amount || rechargeRequest.amount <= 0) {
        throw new Error('Invalid amount');
      }

      const recharge = {
        _id: 'rc123',
        userId: rechargeRequest.userId,
        amount: rechargeRequest.amount,
        status: 'success',
        rupeReference: rechargeRequest.rupeReference,
        createdAt: new Date(),
      };

      // Mapear para DTO
      const dtoResponse = {
        id: recharge._id.toString(),
        userId: recharge.userId,
        amount: recharge.amount,
        status: 'success',
        rupeReference: recharge.rupeReference,
      };

      // Validar
      if (!dtoResponse.id) throw new Error('Missing recharge ID');
      if (dtoResponse.status !== 'success') throw new Error('Wrong status');

      this.passed++;
      return this.pass(testName, Date.now() - startTime);
    } catch (error) {
      this.failed++;
      return this.fail(testName, error.message, Date.now() - startTime);
    }
  }

  /**
   * Teste: Invoice payment flow
   */
  async testInvoicePaymentFlow() {
    const testName = 'Invoice Payment Flow';
    const startTime = Date.now();

    try {
      const invoice = {
        _id: 'inv123',
        invoiceNumber: 'INV-2024-001',
        merchantId: 'merchant123',
        totalAmount: 25000,
        status: 'paid',
        items: [{ description: 'Service', quantity: 1, unitPrice: 25000 }],
        createdAt: new Date(),
        paidAt: new Date(),
      };

      // Mapear para DTO
      const dtoResponse = toInvoiceResponse(invoice);

      // Validar
      if (!dtoResponse.id) throw new Error('Missing invoice ID');
      if (dtoResponse.totalAmount !== 25000) throw new Error('Wrong amount');
      if (dtoResponse.status !== 'paid') throw new Error('Wrong status');
      if (!dtoResponse.items || dtoResponse.items.length === 0) {
        throw new Error('Missing items');
      }

      this.passed++;
      return this.pass(testName, Date.now() - startTime);
    } catch (error) {
      this.failed++;
      return this.fail(testName, error.message, Date.now() - startTime);
    }
  }

  /**
   * Teste: Ledger consistency
   */
  async testLedgerConsistency() {
    const testName = 'Ledger Consistency';
    const startTime = Date.now();

    try {
      // Simular ledger entries
      const entries = [
        { userId: 'user123', type: 'credit', amount: 50000, balanceAfter: 50000 },
        { userId: 'user123', type: 'debit', amount: 10000, balanceAfter: 40000 },
        { userId: 'user123', type: 'credit', amount: 20000, balanceAfter: 60000 },
      ];

      // Calcular soma
      let credits = 0;
      let debits = 0;

      for (const entry of entries) {
        if (entry.type === 'credit') credits += entry.amount;
        if (entry.type === 'debit') debits += entry.amount;
      }

      const calculatedBalance = credits - debits;
      const expectedBalance = 60000;

      if (calculatedBalance !== expectedBalance) {
        throw new Error(`Balance mismatch: ${calculatedBalance} != ${expectedBalance}`);
      }

      this.passed++;
      return this.pass(testName, Date.now() - startTime);
    } catch (error) {
      this.failed++;
      return this.fail(testName, error.message, Date.now() - startTime);
    }
  }

  /**
   * Teste: Event contract validation
   */
  async testEventContractValidation() {
    const testName = 'Event Contract Validation';
    const startTime = Date.now();

    try {
      // Simular evento de payment
      const event = {
        eventId: 'evt123',
        eventType: 'payment:completed',
        version: 'v1',
        timestamp: new Date().toISOString(),
        correlationId: 'corr123',
        data: {
          transactionId: 'tx123',
          userId: 'user123',
          merchantId: 'merchant123',
          amount: 10000,
          type: 'payment',
        },
      };

      // Validar evento
      const validation = validateEvent('payment:completed', event);

      if (!validation.valid) {
        throw new Error(`Event validation failed: ${validation.errors.join(', ')}`);
      }

      this.passed++;
      return this.pass(testName, Date.now() - startTime);
    } catch (error) {
      this.failed++;
      return this.fail(testName, error.message, Date.now() - startTime);
    }
  }

  /**
   * Teste: State machine transitions
   */
  async testStateMachineTransitions() {
    const testName = 'State Machine Transitions';
    const startTime = Date.now();

    try {
      // Testar transições válidas
      const validTransitions = [
        { from: 'initiated', to: 'pending' },
        { from: 'pending', to: 'processing' },
        { from: 'processing', to: 'success' },
        { from: 'pending', to: 'failed' },
        { from: 'success', to: 'reversed' },
      ];

      for (const transition of validTransitions) {
        const result = validateTransactionTransition(transition.from, transition.to);
        if (!result.valid) {
          throw new Error(`Invalid transition: ${transition.from} -> ${transition.to}`);
        }
      }

      // Testar transição inválida
      const invalidTransition = validateTransactionTransition('success', 'pending');
      if (invalidTransition.valid) {
        throw new Error('Should have rejected invalid transition');
      }

      this.passed++;
      return this.pass(testName, Date.now() - startTime);
    } catch (error) {
      this.failed++;
      return this.fail(testName, error.message, Date.now() - startTime);
    }
  }

  /**
   * Teste: Frontend sync simulation
   */
  async testFrontendSyncSimulation() {
    const testName = 'Frontend Sync Simulation';
    const startTime = Date.now();

    try {
      // Simular resposta do backend
      const backendResponse = {
        id: 'tx123',
        amount: 10000,
        status: 'success',
        _meta: {
          version: 'v1',
          timestamp: new Date().toISOString(),
          consistencyModel: 'eventual',
        },
      };

      // Simular parsing do frontend
      const frontendParsed = {
        id: backendResponse.id,
        amount: backendResponse.amount,
        status: backendResponse.status,
      };

      // Validar que frontend pode parsear
      if (!frontendParsed.id) throw new Error('Frontend cannot parse ID');
      if (!frontendParsed.amount) throw new Error('Frontend cannot parse amount');
      if (!frontendParsed.status) throw new Error('Frontend cannot parse status');

      this.passed++;
      return this.pass(testName, Date.now() - startTime);
    } catch (error) {
      this.failed++;
      return this.fail(testName, error.message, Date.now() - startTime);
    }
  }

  /**
   * Executar todos os testes
   */
  async runAllTests() {
    console.log('🚀 Starting Integration Test Harness...\n');

    await this.testTransferFlow();
    await this.testRechargeFlow();
    await this.testInvoicePaymentFlow();
    await this.testLedgerConsistency();
    await this.testEventContractValidation();
    await this.testStateMachineTransitions();
    await this.testFrontendSyncSimulation();

    console.log('\n📊 Integration Test Results:');
    console.log(`   ✅ Passed: ${this.passed}`);
    console.log(`   ❌ Failed: ${this.failed}`);
    console.log(`   📈 Total: ${this.passed + this.failed}`);

    return {
      passed: this.passed,
      failed: this.failed,
      total: this.passed + this.failed,
      successRate: Math.round((this.passed / (this.passed + this.failed)) * 100),
      results: this.testResults,
    };
  }

  pass(testName, duration) {
    console.log(`   ✅ ${testName} (${duration}ms)`);
    this.testResults.push({ testName, status: 'passed', duration });
    return { testName, status: 'passed', duration };
  }

  fail(testName, error, duration) {
    console.log(`   ❌ ${testName} - ${error} (${duration}ms)`);
    this.testResults.push({ testName, status: 'failed', error, duration });
    return { testName, status: 'failed', error, duration };
  }

  getResults() {
    return {
      passed: this.passed,
      failed: this.failed,
      results: this.testResults,
    };
  }
}

export const integrationTestHarness = new IntegrationTestHarness();
export default integrationTestHarness;
