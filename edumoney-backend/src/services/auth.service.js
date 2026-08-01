/**
 * Auth Service
 * Contém toda a lógica de negócio relacionada à autenticação.
 * Este arquivo NÃO deve ter dependências de req/res - apenas lógica pura.
 */

import User from '../models/user.model.js';
import Wallet from '../models/wallet.js';
import School from '../models/school.model.js';
import Class from '../models/class.model.js';
import Merchant from '../models/merchant.model.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendVerificationEmail, sendPasswordResetEmail } from './emailService.js';
import { signToken } from '../config/jwt.js';

// ============ ADMIN LOGIN ============

/**
 * Login de Admin por email
 * @param {Object} data - { email, password }
 * @returns {Object} { success, userObj, token }
 */
export const loginAdminByEmail = async ({ email, password }) => {
  // Buscar usuario com role=admin
  const admin = await User.findOne({ email: email.toLowerCase(), role: 'admin' }).select(
    '+password',
  );

  if (!admin) {
    return { success: false, reason: 'NOT_FOUND' };
  }

  console.log('Admin encontrado:', admin.email, 'Role:', admin.role, 'password:', admin.password);
  // Verificar senha
  const isMatch = await admin.matchPassword(password);
  console.log('Senha correta:', isMatch);
  if (!isMatch) {
    return { success: false, reason: 'INVALID_PASSWORD' };
  }

  // Verificar se está ativo
  if (admin.status !== 'active' && admin.isActive === false) {
    return { success: false, reason: 'ACCOUNT_INACTIVE' };
  }

  // Gerar token
  const token = signToken(admin._id, 'admin');

  return {
    success: true,
    userObj: admin,
    token,
  };
};

/**
 * Constrói payload público do estudante para sincronização frontend.
 * @param {string} userId - ID do usuário
 * @returns {Object|null} Dados públicos do estudante ou null se não encontrado
 */
export const buildStudentUserData = async (userId) => {
  const user = await User.findById(userId)
    .populate('schoolId', '_id name nif')
    .populate('walletId', 'balance')
    .select('+pin');

  if (!user) return null;

  const userData = user.toObject();
  delete userData.password;
  delete userData.pin;
  userData.role = userData.role || 'student';
  userData.pinConfigured = !!user.pin;

  return userData;
};

/**
 * REGISTRO DE ESTUDANTE
 * @param {Object} data - { name, processNumber, role, schoolId, classId, year }
 * @param {Object} auditContext - { ip, userAgent }
 * @returns {Object} { user, wallet, token }
 */
export const registerStudent = async (data, auditContext = {}) => {
  const { name, processNumber, role = 'student', classId, year, schoolId } = data;

  // Verifica escola
  const schoolExists = await School.findById(schoolId);
  if (!schoolExists) {
    throw Object.assign(new Error('A escola informada não existe'), { status: 400 });
  }

  // Verifica turma
  const classExists = await Class.findById(classId);
  if (!classExists) {
    throw Object.assign(new Error('A turma informada não existe'), { status: 400 });
  }

  if (String(classExists.schoolId) !== String(schoolId)) {
    throw Object.assign(new Error('Esta turma não pertence à escola informada'), { status: 400 });
  }

  // Verifica aluno existente
  const existing = await User.findOne({ processNumber, schoolId });
  if (existing) {
    throw Object.assign(new Error('numero de processo já existe nesta escola'), { status: 400 });
  }

  // Cria usuário
  const user = await User.create({
    name,
    processNumber,
    password: '12345678',
    role,
    schoolId,
    classId,
    year,
    status: 'inativo',
  });

  if (user) {
    // Cria wallet
    const wallet = await Wallet.create({
      ownerId: user._id,
      ownerModel: 'User',
      balance: 0,
      totalCredits: 0,
      totalDebits: 0,
      currency: 'AOA',
      status: 'closed',
    });

    // Vincula wallet ao user
    user.walletId = wallet._id;
    await user.save();

    // Adiciona aluno à turma
    await Class.findByIdAndUpdate(classId, { $addToSet: { students: user._id } }, { new: true });

    return { ...user?._doc };
  }

  throw Object.assign(new Error('aluno nao cadastrado por conflito'), { status: 409 });
};

/**
 * LOGIN POR NÚMERO DE PROCESSO
 * @param {Object} data - { processNumber, schoolId, password }
 * @param {Object} auditContext - { ip, userAgent }
 * @returns {Object} { userObj, token }
 */
export const loginByProcessNumber = async (data, auditContext = {}) => {
  const { processNumber, schoolId, password } = data;

  const user = await User.findOne({ processNumber, schoolId })
    .populate('schoolId', '_id nif name')
    .populate('walletId', 'balance')
    .select('+password +pin');

  if (!user) {
    return { success: false, reason: 'NOT_FOUND' };
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return { success: false, reason: 'INVALID_PASSWORD' };
  }

  const userObj = user.toObject();
  userObj.schoolId = userObj.schoolId?._id ?? userObj.schoolId;
  userObj.role = 'student';
  userObj.pinConfigured = !!user.pin;
  delete userObj.pin;
  delete userObj.password;

  const token = signToken(userObj._id, 'student');

  return { success: true, userObj, token };
};

/**
 * LOGIN POR NIF (ESCOLA)
 * @param {Object} data - { nif, password }
 * @returns {Object} { success, school, token }
 */
export const loginSchoolByNIF = async (data) => {
  const { nif, password } = data;

  const school = await School.findOne({ nif }).select('+password');
  if (!school) {
    return { success: false, reason: 'NOT_FOUND' };
  }

  const match = await school.matchPassword(password);
  if (!match) {
    return { success: false, reason: 'INVALID_PASSWORD' };
  }

  const token = signToken(school._id, 'school');

  return {
    success: true,
    school: {
      _id: school._id,
      name: school.name,
      nif: school.nif,
      role: 'school',
    },
    token,
  };
};

/**
 * LOGIN POR NIF (MERCHANT)
 * @param {Object} data - { nif, password }
 * @returns {Object} { success, merchant, token }
 */
export const loginMerchantByNIF = async (data) => {
  const { nif, password } = data;

  const merchant = await Merchant.findOne({ nif }).select('+password');
  if (!merchant) {
    return { success: false, reason: 'NOT_FOUND' };
  }

  const match = await merchant.matchPassword(password);
  if (!match) {
    return { success: false, reason: 'INVALID_PASSWORD' };
  }

  const token = signToken(merchant._id, 'merchant');

  return {
    success: true,
    merchant: {
      _id: merchant._id,
      name: merchant.name,
      nif: merchant.nif,
      schoolId: merchant.schoolId,
      role: 'merchant',
    },
    token,
  };
};

/**
 * LOGIN POR EMAIL (ESTUDANTE)
 * @param {Object} data - { email, schoolId, password }
 * @returns {Object} { success, userObj, token }
 */
export const loginByEmail = async (data) => {
  const { email, schoolId, password } = data;

  const user = await User.findOne({ email, schoolId })
    .populate('schoolId', '_id name nif')
    .populate('walletId', 'balance')
    .select('+password +pin');

  if (!user) {
    return { success: false, reason: 'NOT_FOUND' };
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return { success: false, reason: 'INVALID_PASSWORD' };
  }

  const userObj = user.toObject();
  userObj.schoolId = userObj.schoolId?._id ?? userObj.schoolId;
  userObj.role = userObj.role || 'student';
  userObj.pinConfigured = !!user.pin;
  delete userObj.pin;
  delete userObj.password;

  const token = signToken(userObj._id, userObj.role);

  return { success: true, userObj, token };
};

/**
 * OBTER ALUNOS DA ESCOLA
 * @param {string} schoolId - ID da escola
 * @returns {Object} { students, classes }
 */
export const getStudentsBySchool = async (schoolId) => {
  const schoolExists = await School.findById(schoolId);
  if (!schoolExists) {
    throw Object.assign(new Error('Escola não encontrada'), { status: 404 });
  }

  const classes = await Class.find({ schoolId });
  const students = await User.find({ schoolId })
    .populate('walletId', 'balance')
    .select('-password');

  return { students, classes };
};

/**
 * OBTER PERFIL DO ESTUDANTE
 * @param {string} userId - ID do usuário
 * @returns {Object|null} Dados do estudante
 */
export const getStudentProfile = async (userId) => {
  return buildStudentUserData(userId);
};

/**
 * ATUALIZAR PERFIL DO ESTUDANTE
 * @param {string} userId - ID do usuário
 * @param {Object} updates - Campos a atualizar
 * @param {Object} auditContext - { ip, userAgent }
 * @returns {Object} userData atualizado
 */
export const updateStudentProfile = async (userId, updates, auditContext = {}) => {
  // Campos proibidos
  const forbiddenFields = ['name', 'processNumber', 'role', 'schoolId', 'classId'];
  for (const field of forbiddenFields) {
    if (updates[field]) {
      throw Object.assign(new Error(`O campo ${field} não pode ser alterado`), { status: 400 });
    }
  }

  const user = await User.findById(userId);
  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });
  }

  // Atualiza campos permitidos
  const allowedFields = ['email', 'phone', 'whatsapp', 'biNumber'];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      user[field] = updates[field];
    }
  }

  user.profileUpdatedAt = new Date();
  await user.save();

  return buildStudentUserData(user._id);
};

/**
 * ALTERAR SENHA DO ESTUDANTE
 * @param {string} userId - ID do usuário
 * @param {Object} data - { currentPassword, newPassword, confirmPassword }
 * @param {Object} auditContext - { ip, userAgent }
 * @returns {Object} userData atualizado
 */
export const changeStudentPassword = async (userId, data, auditContext = {}) => {
  const { currentPassword, newPassword, confirmPassword } = data;

  if (newPassword !== confirmPassword) {
    throw Object.assign(new Error('As senhas não coincidem'), { status: 400 });
  }

  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });
  }

  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    throw Object.assign(new Error('Senha atual incorreta'), { status: 400 });
  }

  // Verificar se nova senha é diferente
  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    throw Object.assign(new Error('A nova senha deve ser diferente da atual'), { status: 400 });
  }

  user.password = newPassword;
  await user.save();

  return buildStudentUserData(user._id);
};

/**
 * CONFIGURAR PIN DO ESTUDANTE
 * @param {string} userId - ID do usuário
 * @param {Object} data - { pin }
 * @param {Object} auditContext - { ip, userAgent }
 * @returns {Object} { wasActivated, userData }
 */
export const setStudentPin = async (userId, data, auditContext = {}) => {
  const { pin } = data;

  if (!pin || !/^\d{4}$/.test(pin)) {
    throw Object.assign(new Error('O PIN deve ter exatamente 4 dígitos numéricos'), {
      status: 400,
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });
  }

  // Evitar reutilização do PIN
  if (user.pin) {
    const isSame = await bcrypt.compare(pin, user.pin);
    if (isSame) {
      throw Object.assign(new Error('O novo PIN deve ser diferente do anterior'), { status: 400 });
    }
  }

  // Hash do PIN
  const salt = await bcrypt.genSalt(10);
  user.pin = await bcrypt.hash(pin, salt);

  // Ativar conta se estava inativa
  let wasActivated = false;
  if (user.status === 'inativo') {
    user.status = 'ativo';
    wasActivated = true;
  }else if( user.status == 'ativo' ) wasActivated = true

  // Log de segurança
  user.securityLogs.push({
    action: 'PIN_SET',
    ip: auditContext.ip,
  });

  await user.save();

  return { wasActivated, userData: await buildStudentUserData(user._id) };
};

/**
 * SOLICITAR VERIFICAÇÃO DE EMAIL
 * @param {string} userId - ID do usuário
 * @param {Object} data - { email }
 * @returns {boolean} true se solicitado com sucesso
 */
export const requestEmailVerification = async (userId, data) => {
  const { email } = data;

  // Verifica se email já está em uso por outro usuário verificado
  const existingUser = await User.findOne({ email, email_verified: true });
  if (existingUser && existingUser._id.toString() !== userId.toString()) {
    throw Object.assign(new Error('Este email já está em uso'), { status: 400 });
  }

  const user = await User.findById(userId);
  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });
  }

  // Gera código de 6 dígitos
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  user.pending_email = email;
  user.verification_code = hashedCode;
  user.code_expires_at = expiresAt;
  await user.save();

  await sendVerificationEmail(email, code);

  return true;
};

/**
 * VERIFICAR EMAIL
 * @param {string} userId - ID do usuário
 * @param {Object} data - { code }
 * @returns {boolean} true se verificado com sucesso
 */
export const verifyEmailCode = async (userId, data) => {
  const { code } = data;

  const user = await User.findById(userId);
  if (!user || !user.pending_email) {
    throw Object.assign(new Error('Nenhuma solicitação pendente'), { status: 400 });
  }

  if (user.code_expires_at < new Date()) {
    throw Object.assign(new Error('Código expirado'), { status: 400 });
  }

  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
  if (user.verification_code !== hashedCode) {
    throw Object.assign(new Error('Código inválido'), { status: 400 });
  }

  user.email = user.pending_email;
  user.email_verified = true;
  user.pending_email = null;
  user.verification_code = undefined;
  user.code_expires_at = undefined;
  await user.save();

  return true;
};

/**
 * SOLICITAR RECUPERAÇÃO DE SENHA
 * @param {Object} data - { email }
 * @returns {boolean} true se solicitado com sucesso
 */
export const requestPasswordReset = async (data) => {
  const { email } = data;

  const user = await User.findOne({ email, email_verified: true });
  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado ou email não verificado'), {
      status: 404,
    });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  user.verification_code = hashedCode;
  user.code_expires_at = expiresAt;
  await user.save();

  await sendPasswordResetEmail(email, code);

  return true;
};

/**
 * REDEFINIR SENHA
 * @param {Object} data - { email, code, newPassword }
 * @returns {boolean} true se redefinido com sucesso
 */
export const resetPasswordWithCode = async (data) => {
  const { email, code, newPassword } = data;

  const user = await User.findOne({ email, email_verified: true });
  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });
  }

  if (!user.verification_code || user.code_expires_at < new Date()) {
    throw Object.assign(new Error('Código inválido ou expirado'), { status: 400 });
  }

  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
  if (user.verification_code !== hashedCode) {
    throw Object.assign(new Error('Código inválido'), { status: 400 });
  }

  user.password = newPassword;
  user.verification_code = undefined;
  user.code_expires_at = undefined;
  await user.save();

  return true;
};
