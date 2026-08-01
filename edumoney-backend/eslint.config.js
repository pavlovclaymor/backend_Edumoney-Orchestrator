import eslint from '@eslint/js';
import globals from 'globals';

export default [
  eslint.configs.recommended,
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      '*.min.js',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml'
    ]
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        console: 'readonly',
        process: 'readonly'
      }
    },
    rules: {
      // Regras críticas apenas (segurança e funcionalidade)
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-var': 'warn',
      'prefer-const': 'warn',
      // Regras relaxadas para não quebrar o código existente
      'quotes': 'off',
      'semi': 'off',
      'indent': 'off',
      'comma-dangle': 'off',
      'no-trailing-spaces': 'off',
      'eol-last': 'off',
      'arrow-spacing': 'off',
      'object-curly-spacing': 'off',
      'array-bracket-spacing': 'off',
      'keyword-spacing': 'off'
    }
  }
];