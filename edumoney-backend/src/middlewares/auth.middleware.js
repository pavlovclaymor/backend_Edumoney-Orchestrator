/**
 * Authentication Middleware
 * Handles JWT verification and user loading
 *
 * REGRAS DE SEGURANÇA (FASE 3):
 * - JWT contém id e role
 * - role é a ÚNICA fonte de autorização
 * - NUNCA usar flags paralelas (isAdmin, etc)
 */

import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import School from '../models/school.model.js';
import Merchant from '../models/merchant.model.js';
import { JWT_CONFIG } from '../config/jwt.js';

export const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).send({ message: 'Token não fornecido' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_CONFIG.secret);

    // Extrair role do JWT (prioridade) ou usar default baseado no modelo
    const jwtRole = decoded.role;

    let actor = await User.findById(decoded.id).select('-password');
    let actorModel = 'User';
    let actorRole = jwtRole || 'student';

    if (!actor) {
      actor = await School.findById(decoded.id).select('-password');
      actorModel = 'School';
      actorRole = jwtRole || 'school';
    }

    if (!actor) {
      actor = await Merchant.findById(decoded.id).select('-password');
      actorModel = 'Merchant';
      actorRole = jwtRole || 'merchant';
    }

    if (!actor) {
      return res.status(401).send({ message: 'Utilizador não encontrado' });
    }

    req.user = actor;
    req.userModel = actorModel;
    req.userRole = actorRole; // Role do JWT como fonte primária
    next();
  } catch (error) {
    console.error('JWT Error:', error.message);
    return res.status(401).send({ message: error.message });
  }
};

/**
 * Role guard — Authorization based ONLY on role
 * Pass allowed roles as strings: authorize("school"), authorize("admin", "school")
 *
 * IMPORTANT: Uses ONLY role from JWT - no DB flags, no isAdmin
 */
export const authorize =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).send({ message: 'Não autenticado' });
    }

    // Se não há roles especificados, permite acesso
    if (allowedRoles.length === 0) return next();

    // Usa role do JWT como ÚNICA fonte de autorização
    const userRole = req.userRole;

    if (!userRole) {
      return res.status(403).send({ message: 'Acesso proibido: role não definido' });
    }

    // Verifica se role do usuário está na lista de permitidos
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    // Nega acesso se role não está na lista
    return res.status(403).send({ message: 'Acesso proibido: permissão insuficiente' });
  };
