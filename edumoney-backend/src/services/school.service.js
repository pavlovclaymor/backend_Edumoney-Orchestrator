/**
 * School Service
 * Contém toda a lógica de negócio relacionada a escolas.
 * Este arquivo NÃO deve ter dependências de req/res - apenas lógica pura.
 */

import School from '../models/school.model.js';
import Wallet from '../models/wallet.js';
import Class from '../models/class.model.js';
import Merchant from '../models/merchant.model.js';

/**
 * Criar escola
 * @param {Object} data - { name, nif, address, password }
 * @returns {Object} { school, wallet }
 */
export const createSchool = async (data) => {
  const { name, nif, address, password } = data;

  // Validar NIF
  if (!/^\d{9}$/.test(nif)) {
    throw Object.assign(new Error('O NIF deve conter exatamente 9 dígitos'), { status: 400 });
  }

  // Verificar duplicação
  const existingSchool = await School.findOne({
    $or: [{ name }, { nif }],
  });

  if (existingSchool) {
    if (existingSchool.nif === nif) {
      throw Object.assign(new Error('Já existe uma escola cadastrada com este NIF'), {
        status: 400,
      });
    }
    if (existingSchool.name === name) {
      throw Object.assign(new Error('Já existe uma escola cadastrada com este nome'), {
        status: 400,
      });
    }
    throw Object.assign(new Error('Escola já cadastrada'), { status: 400 });
  }

  // Criar escola
  const school = await School.create({
    name,
    nif,
    address,
    password,
  });

  // Criar wallet GLOBAL
  const wallet = await Wallet.create({
    ownerId: school._id,
    ownerModel: 'School',
    balance: 0,
  });

  school.walletId = wallet._id;
  await school.save();

  return { school };
};

/**
 * Atualizar dados da escola
 * @param {string} schoolId - ID da escola
 * @param {Object} updates - { phone, email, description, website }
 * @returns {Object} updatedSchool
 */
export const updateSchool = async (schoolId, updates) => {
  const { phone, email, description, website } = updates;

  // Montar objeto dinâmico
  const updateData = {};
  if (phone) updateData.phone = phone;
  if (email) updateData.email = email;
  if (description) updateData.description = description;
  if (website) updateData.website = website;

  if (Object.keys(updateData).length === 0) {
    throw Object.assign(new Error('Digite pelo menos um campo para atualizar'), { status: 400 });
  }

  const updatedSchool = await School.findByIdAndUpdate(
    schoolId,
    { $set: updateData },
    { new: true, runValidators: true },
  );

  if (!updatedSchool) {
    throw Object.assign(new Error('Escola não encontrada'), { status: 404 });
  }

  return updatedSchool;
};

/**
 * Obter uma escola
 * @param {string} schoolId - ID da escola
 * @returns {Object} school com wallet populada
 */
export const getOneSchool = async (schoolId) => {
  const school = await School.findById(schoolId).populate('walletId');

  if (!school) {
    throw Object.assign(new Error('Escola não encontrada'), { status: 404 });
  }

  return school;
};

/**
 * Listar todas as escolas
 * @returns {Array} Lista de escolas
 */
export const getAllSchools = async () => {
  const schools = await School.find();
  return schools;
};

/**
 * Obter wallet da escola
 * @param {string} schoolId - ID da escola
 * @returns {Object} wallet
 */
export const getSchoolWallet = async (schoolId) => {
  const wallet = await Wallet.findOne({
    ownerId: schoolId,
    ownerModel: 'School',
  });

  if (!wallet) {
    throw Object.assign(new Error('Carteira da escola não encontrada'), { status: 404 });
  }

  return wallet;
};

/**
 * Listar turmas da escola
 * @param {string} schoolId - ID da escola
 * @returns {Array} Lista de turmas
 */
export const getAllClasses = async (schoolId) => {
  const classes = await Class.find({ schoolId });

  if (!classes.length) {
    throw Object.assign(new Error('Nenhuma turma encontrada para esta escola'), { status: 404 });
  }

  return classes;
};

/**
 * Listar comerciantes da escola
 * @param {string} schoolId - ID da escola
 * @returns {Array} Lista de comerciantes
 */
export const getAllMerchantsForSchool = async (schoolId) => {
  const merchants = await Merchant.find({ schoolId });

  if (!merchants.length) {
    throw Object.assign(new Error('Nenhum comerciante encontrado'), { status: 404 });
  }

  return merchants;
};

/**
 * Adicionar folhas impressas
 * @param {string} schoolId - ID da escola
 * @param {number} quantity - Quantidade de folhas
 * @returns {Object} { sheetsPrinted }
 */
export const addSheetsPrinted = async (schoolId, quantity) => {
  if (!quantity || quantity <= 0) {
    throw Object.assign(new Error('Informe uma quantidade válida de folhas para adicionar'), {
      status: 400,
    });
  }

  const school = await School.findById(schoolId);
  if (!school) {
    throw Object.assign(new Error('Escola não encontrada'), { status: 404 });
  }

  school.sheetsPrinted += quantity;
  await school.save();

  return { sheetsPrinted: school.sheetsPrinted };
};

/**
 * Obter folhas impressas
 * @param {string} schoolId - ID da escola
 * @returns {Object} { sheetsPrinted, sheetsSold }
 */
export const getSheetsPrinted = async (schoolId) => {
  const school = await School.findById(schoolId, 'sheetsPrinted sheetsSold');

  if (!school) {
    throw Object.assign(new Error('Escola não encontrada'), { status: 404 });
  }

  return {
    sheetsPrinted: school.sheetsPrinted,
    sheetsSold: school.sheetsSold,
  };
};

/**
 * Atualizar taxa de saque
 * @param {string} schoolId - ID da escola
 * @param {number} feeRate - Taxa de saque (0-1)
 * @returns {Object} { feeRate }
 */
export const updateFeeRate = async (schoolId, feeRate) => {
  if (feeRate === undefined || feeRate === null) {
    throw Object.assign(new Error('feeRate é obrigatório'), { status: 400 });
  }

  const feeValue = parseFloat(feeRate);

  if (isNaN(feeValue) || feeValue < 0 || feeValue > 1) {
    throw Object.assign(new Error('feeRate deve ser um número entre 0 e 1 (ex: 0.025 para 2.5%)'), {
      status: 400,
    });
  }

  const school = await School.findByIdAndUpdate(
    schoolId,
    { $set: { feeRate: feeValue } },
    { new: true, runValidators: true },
  );

  if (!school) {
    throw Object.assign(new Error('Escola não encontrada'), { status: 404 });
  }

  return { feeRate: school.feeRate };
};

/**
 * Obter taxa de saque atual
 * @param {string} schoolId - ID da escola
 * @returns {Object} { feeRate }
 */
export const getFeeRate = async (schoolId) => {
  const school = await School.findById(schoolId, 'feeRate');

  if (!school) {
    throw Object.assign(new Error('Escola não encontrada'), { status: 404 });
  }

  return { feeRate: school.feeRate };
};

/**
 * Alterar senha da escola
 * @param {string} schoolId - ID da escola
 * @param {Object} data - { currentPassword, newPassword }
 * @returns {boolean} true
 */
export const changeSchoolPassword = async (schoolId, data) => {
  const { currentPassword, newPassword } = data;

  if (!currentPassword || !newPassword) {
    throw Object.assign(new Error('Preencha todos os campos'), { status: 400 });
  }

  // Validação forte da senha
  if (newPassword.length < 6) {
    throw Object.assign(new Error('A nova senha deve ter pelo menos 6 caracteres'), {
      status: 400,
    });
  }

  if (!/[A-Z]/.test(newPassword)) {
    throw Object.assign(new Error('Inclua pelo menos 1 letra maiúscula'), { status: 400 });
  }

  if (!/[0-9]/.test(newPassword)) {
    throw Object.assign(new Error('Inclua pelo menos 1 número'), { status: 400 });
  }

  const school = await School.findById(schoolId).select('+password');

  if (!school) {
    throw Object.assign(new Error('Escola não encontrada'), { status: 404 });
  }

  const isMatch = await school.matchPassword(currentPassword);
  if (!isMatch) {
    throw Object.assign(new Error('Senha atual incorreta'), { status: 400 });
  }

  const isSamePassword = await school.matchPassword(newPassword);
  if (isSamePassword) {
    throw Object.assign(new Error('A nova senha deve ser diferente da atual'), { status: 400 });
  }

  school.password = newPassword;
  school.passwordChangedAt = new Date();
  await school.save();

  return true;
};
