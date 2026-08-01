/**
 * Admin Seed
 * Garante existência de usuário admin para acesso administrativo
 *
 * IMPORTANTE: role = "admin" (única fonte de autorização)
 */

import User from '../models/user.model.js';
import bcrypt from 'bcrypt';

const ADMIN_EMAIL = 'admin@edumoney.com';
const ADMIN_PASSWORD = 'Admin@123456';

/**
 * Cria ou atualiza usuário admin
 * @returns {Object} Admin criado/atualizado
 */
export const seedAdmin = async () => {
  console.log('[AdminSeed] Verificando usuário admin...');

  // Verificar se admin já existe
  let admin = await User.findOne({ email: ADMIN_EMAIL });

  if (admin) {
    console.log('[AdminSeed] Admin já existe, atualizando role...');

    // Atualizar role para admin (garantir consistência)
    if (admin.role !== 'admin') {
      admin.role = 'admin';
      admin.isActive = true;
      await admin.save();
      console.log("[AdminSeed] Role atualizado para 'admin'");
    }

    return admin;
  }

  console.log('[AdminSeed] Criando novo usuário admin...');

  // Criar admin com role="admin"
  admin = new User({
    name: 'Administrator',
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    processNumber: 'ADMIN001',
    role: 'admin', // CRÍTICO: role = "admin"
    isActive: true,
    email_verified: true,
    identityVerified: true,
    status: 'ativo',
  });

  await admin.save();
  console.log('[AdminSeed] Admin criado com sucesso!');
  console.log(`  Email: ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`  Role: admin`);

  return admin;
};

/**
 * Verifica e corrige roles de todos os usuários
 * Converte usuários com isAdmin=true para role="admin"
 */
export const migrateLegacyAdmins = async () => {
  console.log('[AdminSeed] Verificando migração de admins legacy...');

  // Buscar usuários com role inválido ou sem role
  const legacyAdmins = await User.find({
    $or: [{ isAdmin: true, role: { $ne: 'admin' } }, { role: undefined }],
  });

  if (legacyAdmins.length === 0) {
    console.log('[AdminSeed] Nenhum admin legacy encontrado');
    return { migrated: 0 };
  }

  console.log(`[AdminSeed] Encontrados ${legacyAdmins.length} usuários para migrar`);

  for (const user of legacyAdmins) {
    if (user.isAdmin === true && user.role !== 'admin') {
      console.log(`[AdminSeed] Migrando: ${user.email} (isAdmin=true → role=admin)`);
      user.role = 'admin';
      await user.save();
    }
  }

  return { migrated: legacyAdmins.length };
};

/**
 * Remove campo isAdmin de todos os usuários (limpeza pós-migração)
 */
export const cleanupIsAdminField = async () => {
  console.log('[AdminSeed] Removendo campo isAdmin de todos os usuários...');

  const result = await User.updateMany({ isAdmin: { $exists: true } }, { $unset: { isAdmin: '' } });

  console.log(`[AdminSeed] Campo isAdmin removido de ${result.modifiedCount} usuários`);
  return { removed: result.modifiedCount };
};

/**
 * Seed completo: cria admin + migra legacy
 */
export const runAdminSeed = async () => {
  console.log('===========================================');
  console.log('[AdminSeed] Iniciando seed de admin...');
  console.log('===========================================');

  try {
    // 1. Migrar admins legacy primeiro
    const migration = await migrateLegacyAdmins();

    // 2. Garantir admin principal
    const admin = await seedAdmin();

    // 3. Limpar campo isAdmin
    const cleanup = await cleanupIsAdminField();

    console.log('===========================================');
    console.log('[AdminSeed] Seed concluído com sucesso!');
    console.log(`  Admin principal: ${ADMIN_EMAIL}`);
    console.log(`  Admins migrados: ${migration.migrated}`);
    console.log(`  Campos isAdmin removidos: ${cleanup.removed}`);
    console.log('===========================================');

    return { admin, migration, cleanup };
  } catch (error) {
    console.error('[AdminSeed] Erro durante seed:', error);
    throw error;
  }
};

export default runAdminSeed;
