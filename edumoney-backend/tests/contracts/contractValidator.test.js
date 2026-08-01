/**
 * Contract Validator Tests
 * Tests for the contract validation utilities
 */

import { describe, test, expect } from 'vitest';
import {
  isMongoDocument,
  isMongoId,
  validateNoMongoFields,
  validateApiResponse,
  validateResponse,
  getMongoInternalFields,
} from '../../src/utils/contractValidator.js';

describe('Contract Validator', () => {
  describe('isMongoDocument', () => {
    test('should detect MongoDB document pattern', () => {
      const doc = { _id: '123', __v: 0, name: 'Test' };
      expect(isMongoDocument(doc)).toBe(true);
    });

    test('should reject plain objects without _id', () => {
      const obj = { name: 'Test', value: 123 };
      expect(isMongoDocument(obj)).toBe(false);
    });

    test('should reject null and undefined', () => {
      expect(isMongoDocument(null)).toBe(false);
      expect(isMongoDocument(undefined)).toBe(false);
    });

    test('should reject primitives', () => {
      expect(isMongoDocument('string')).toBe(false);
      expect(isMongoDocument(123)).toBe(false);
      expect(isMongoDocument(true)).toBe(false);
    });
  });

  describe('isMongoId', () => {
    test('should validate correct ObjectId', () => {
      expect(isMongoId('507f1f77bcf86cd799439011')).toBe(true);
    });

    test('should reject invalid ObjectId', () => {
      expect(isMongoId('invalid')).toBe(false);
      expect(isMongoId('')).toBe(false);
    });
  });

  describe('getMongoInternalFields', () => {
    test('should return all internal fields', () => {
      const fields = getMongoInternalFields();
      expect(fields).toContain('__v');
      expect(fields).toContain('password');
      expect(fields).toContain('pin');
      expect(fields).toContain('_id');
    });
  });

  describe('validateNoMongoFields', () => {
    test('should detect __v field', () => {
      const doc = { _id: '123', __v: 0, name: 'Test' };
      const violations = validateNoMongoFields(doc);
      expect(violations.some(v => v.field === '__v')).toBe(true);
    });

    test('should detect password field', () => {
      const doc = { _id: '123', password: 'secret123' };
      const violations = validateNoMongoFields(doc);
      expect(violations.some(v => v.field === 'password')).toBe(true);
    });

    test('should detect nested MongoDB fields', () => {
      const doc = {
        _id: '123',
        user: { _id: '456', __v: 1 },
      };
      const violations = validateNoMongoFields(doc);
      expect(violations.length).toBeGreaterThan(0);
    });

    test('should return empty for safe objects', () => {
      const safeObj = {
        id: '123',
        name: 'Test',
        balance: 100,
      };
      const violations = validateNoMongoFields(safeObj);
      expect(violations.length).toBe(0);
    });

    test('should handle null input', () => {
      const violations = validateNoMongoFields(null);
      expect(violations.length).toBe(0);
    });
  });

  describe('validateApiResponse', () => {
    test('should validate correct success response', () => {
      const response = {
        success: true,
        message: 'Operation successful',
        data: { id: '123' },
        timestamp: '2026-06-18T10:00:00.000Z',
      };
      const violations = validateApiResponse(response);
      expect(violations.length).toBe(0);
    });

    test('should require success field', () => {
      const response = {
        message: 'Test',
        data: {},
        timestamp: '2026-06-18T10:00:00.000Z',
      };
      const violations = validateApiResponse(response);
      expect(violations.some(v => v.field === 'success')).toBe(true);
    });

    test('should require timestamp field', () => {
      const response = {
        success: true,
        message: 'Test',
        data: {},
      };
      const violations = validateApiResponse(response);
      expect(violations.some(v => v.field === 'timestamp')).toBe(true);
    });

    test('should require message for success responses', () => {
      const response = {
        success: true,
        data: {},
        timestamp: '2026-06-18T10:00:00.000Z',
      };
      const violations = validateApiResponse(response);
      expect(violations.some(v => v.field === 'message')).toBe(true);
    });
  });

  describe('validateResponse', () => {
    test('should validate complete response', () => {
      const response = {
        success: true,
        message: 'Wallet retrieved',
        data: {
          id: '123',
          balance: 100,
          currency: 'AOA',
        },
        timestamp: '2026-06-18T10:00:00.000Z',
      };
      const violations = validateResponse(response);
      expect(violations.length).toBe(0);
    });

    test('should detect MongoDB document in data', () => {
      const response = {
        success: true,
        message: 'Wallet retrieved',
        data: {
          _id: '123',
          __v: 0,
          balance: 100,
        },
        timestamp: '2026-06-18T10:00:00.000Z',
      };
      const violations = validateResponse(response);
      expect(violations.length).toBeGreaterThan(0);
    });

    test('should detect password in data', () => {
      const response = {
        success: true,
        message: 'User retrieved',
        data: {
          id: '123',
          password: 'secret123',
        },
        timestamp: '2026-06-18T10:00:00.000Z',
      };
      const violations = validateResponse(response);
      expect(violations.some(v => v.field.includes('password'))).toBe(true);
    });
  });
});

describe('DTO Transformation', () => {
  test('WalletDTO should remove __v field', async () => {
    const { WalletDTO } = await import('../../src/utils/dto/index.js');
    
    const mongoDoc = {
      _id: '507f1f77bcf86cd799439011',
      __v: 0,
      balance: 100,
      currency: 'AOA',
      status: 'active',
      ownerId: 'user123',
      password: 'shouldNotBeIncluded',
    };
    
    const dto = WalletDTO.fromDocument(mongoDoc);
    
    expect(dto.id).toBe('507f1f77bcf86cd799439011');
    expect(dto.balance).toBe(100);
    expect(dto.__v).toBeUndefined();
    expect(dto.password).toBeUndefined();
  });

  test('TransactionDTO should transform status', async () => {
    const { TransactionDTO } = await import('../../src/utils/dto/index.js');
    
    const mongoDoc = {
      _id: '507f1f77bcf86cd799439012',
      __v: 0,
      amount: 50,
      type: 'transfer',
      status: 'completed',
      senderId: 'user1',
      receiverId: 'user2',
      createdAt: new Date(),
    };
    
    const dto = TransactionDTO.fromDocument(mongoDoc);
    
    expect(dto.status).toBe('SUCCESS');
    expect(dto.type).toBe('TRANSFER');
  });
});

describe('Response Wrapper', () => {
  test('ApiResponse.success should have correct structure', async () => {
    const { ApiResponse } = await import('../../src/utils/responseWrapper.js');
    
    const response = ApiResponse.success({ id: '123' }, 'Success');
    
    expect(response.success).toBe(true);
    expect(response.message).toBe('Success');
    expect(response.data).toEqual({ id: '123' });
    expect(response.timestamp).toBeDefined();
  });

  test('ErrorResponse.notFound should have correct structure', async () => {
    const { ErrorResponse } = await import('../../src/utils/responseWrapper.js');
    
    const response = ErrorResponse.notFound('Wallet');
    
    expect(response.success).toBe(false);
    expect(response.code).toBe('NOT_FOUND');
    expect(response.message).toBe('Wallet not found');
    expect(response.timestamp).toBeDefined();
  });

  test('ApiResponse.list should include count', async () => {
    const { ApiResponse } = await import('../../src/utils/responseWrapper.js');
    
    const response = ApiResponse.list([{ id: '1' }, { id: '2' }], 10, 'List retrieved');
    
    expect(response.success).toBe(true);
    expect(response.data.length).toBe(2);
    expect(response.count).toBe(2);
    expect(response.total).toBe(10);
  });
});
