/**
 * ESLint Rules for Contract-First Enforcement
 * 
 * These rules detect and prevent common contract violations:
 * - Raw MongoDB document returns
 * - Missing DTO transformation
 * - Non-standard response formats
 */

module.exports = {
  rules: {
    /**
     * Rule: no-raw-mongodb-response
     * Disallows direct return of MongoDB documents in responses
     * 
     * ❌ BAD: res.send(mongoDoc), res.json(mongoDoc)
     * ✅ GOOD: res.json(ApiResponse.success(dto))
     */
    'no-raw-mongodb-response': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow raw MongoDB document returns',
          category: 'Contract Enforcement',
          recommended: true,
        },
        schema: [],
      },
      create(context) {
        return {
          CallExpression(node) {
            // Check for res.send or res.json calls
            const callee = node.callee;
            if (
              callee.type === 'MemberExpression' &&
              callee.object.name === 'res' &&
              (callee.property.name === 'send' || callee.property.name === 'json')
            ) {
              // Check if argument is a MongoDB document pattern
              if (node.arguments.length > 0) {
                const arg = node.arguments[0];
                
                // Pattern 1: Direct variable that might be a MongoDB doc
                if (arg.type === 'Identifier') {
                  const forbiddenNames = [
                    'wallet', 'wallets', 'transaction', 'transactions',
                    'school', 'schools', 'merchant', 'merchants',
                    'user', 'users', 'invoice', 'invoices',
                    'recharge', 'recharges', 'certificate', 'certificates',
                    'audit', 'audits', 'logs', 'log', 'result', 'results',
                  ];
                  
                  if (forbiddenNames.includes(arg.name)) {
                    context.report({
                      node,
                      message: `Raw MongoDB document '${arg.name}' returned directly. Use DTO transformation: ApiResponse.success(${arg.name}DTO.fromDocument(${arg.name}))`,
                    });
                  }
                }
              }
            }
          },
        };
      },
    },

    /**
     * Rule: require-api-response-wrapper
     * Requires all successful responses to use ApiResponse wrapper
     */
    'require-api-response-wrapper': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Require ApiResponse wrapper for all responses',
          category: 'Contract Enforcement',
          recommended: true,
        },
        schema: [],
      },
      create(context) {
        return {
          CallExpression(node) {
            const callee = node.callee;
            if (
              callee.type === 'MemberExpression' &&
              callee.object.name === 'res' &&
              callee.property.name === 'json'
            ) {
              if (node.arguments.length > 0) {
                const arg = node.arguments[0];
                
                // Check if it's already wrapped in ApiResponse
                if (
                  arg.type === 'CallExpression' &&
                  arg.callee.type === 'MemberExpression' &&
                  arg.callee.object.name === 'ApiResponse'
                ) {
                  // Already wrapped - OK
                  return;
                }
                
                // Check if it's an ErrorResponse
                if (
                  arg.type === 'CallExpression' &&
                  arg.callee.type === 'MemberExpression' &&
                  arg.callee.object.name === 'ErrorResponse'
                ) {
                  // Error response - OK
                  return;
                }
                
                // Check if it's a simple message object
                if (
                  arg.type === 'ObjectExpression' &&
                  arg.properties.length === 1 &&
                  arg.properties[0].key.name === 'message'
                ) {
                  // Simple message - OK for errors
                  return;
                }
                
                // Report if not wrapped
                context.report({
                  node,
                  message: 'Response should use ApiResponse wrapper: ApiResponse.success(data) or ApiResponse.created(data)',
                });
              }
            }
          },
        };
      },
    },

    /**
     * Rule: no-unsafe-array-return
     * Disallows returning raw arrays from database queries
     */
    'no-unsafe-array-return': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow raw array returns from DB queries',
          category: 'Contract Enforcement',
          recommended: true,
        },
        schema: [],
      },
      create(context) {
        return {
          CallExpression(node) {
            const callee = node.callee;
            if (
              callee.type === 'MemberExpression' &&
              callee.object.name === 'res' &&
              callee.property.name === 'json'
            ) {
              if (node.arguments.length > 0) {
                const arg = node.arguments[0];
                
                // Check for raw array variables
                if (arg.type === 'Identifier') {
                  const arrayNames = [
                    'transactions', 'merchants', 'schools', 'users',
                    'wallets', 'invoices', 'recharges', 'certificates',
                    'audits', 'logs', 'classes', 'products', 'services',
                  ];
                  
                  if (arrayNames.includes(arg.name)) {
                    context.report({
                      node,
                      message: `Raw array '${arg.name}' returned. Use ApiResponse.list(${arg.name}DTO.fromArray(${arg.name}))`,
                    });
                  }
                }
              }
            }
          },
        };
      },
    },

    /**
     * Rule: require-dto-import
     * Requires controllers to import DTO modules
     */
    'require-dto-import': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Require DTO imports in controllers',
          category: 'Contract Enforcement',
          recommended: false,
        },
        schema: [],
      },
      create(context) {
        let hasDtoImport = false;
        let isControllerFile = false;
        
        const filename = context.getFilename();
        if (filename.includes('/controllers/')) {
          isControllerFile = true;
        }
        
        return {
          ImportDeclaration(node) {
            if (node.source.value.includes('dto')) {
              hasDtoImport = true;
            }
          },
          'Program:exit'() {
            if (isControllerFile && !hasDtoImport) {
              context.report({
                node: context.getSourceCode().ast,
                message: 'Controllers should import DTO modules: import { *DTO } from "../utils/dto/index.js"',
              });
            }
          },
        };
      },
    },

    /**
     * Rule: require-response-wrapper-import
     * Requires controllers to import ResponseWrapper
     */
    'require-response-wrapper-import': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Require ResponseWrapper imports in controllers',
          category: 'Contract Enforcement',
          recommended: false,
        },
        schema: [],
      },
      create(context) {
        let hasWrapperImport = false;
        let isControllerFile = false;
        
        const filename = context.getFilename();
        if (filename.includes('/controllers/')) {
          isControllerFile = true;
        }
        
        return {
          ImportDeclaration(node) {
            if (node.source.value.includes('responseWrapper')) {
              hasWrapperImport = true;
            }
          },
          'Program:exit'() {
            if (isControllerFile && !hasWrapperImport) {
              context.report({
                node: context.getSourceCode().ast,
                message: 'Controllers should import ResponseWrapper: import { ApiResponse, ErrorResponse } from "../utils/responseWrapper.js"',
              });
            }
          },
        };
      },
    },
  },
};
