/**
 * JWT Configuration
 * Centraliza a configuração de JWT para evitar fallbacks hardcoded.
 *
 * REGRAS DE SEGURANÇA (FASE 3):
 * - JWT deve conter SEMPRE: id, role
 * - role é a única fonte de autorização
 * - NUNCA usar flags paralelas (isAdmin, etc)
 */
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error(
    '[CRÍTICO] JWT_SECRET não está definido no .env. ' +
      'O sistema não pode iniciar sem esta variável de ambiente.',
  );
}

export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES || '7d',
};

/**
 * Gera JWT token com role obrigatório
 * @param {string} id - User ID
 * @param {string} role - User role (admin|school|merchant|student)
 * @returns {string} JWT token
 */
export const signToken = (id, role) => {
  return jwt.sign({ id, role }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn });
};
