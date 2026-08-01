/**
 * Merchant Service
 * Contém toda a lógica de negócio relacionada a comerciantes.
 */

import Merchant from '../models/merchant.model.js';
import School from '../models/school.model.js';
import Wallet from '../models/wallet.js';
import Category from '../models/Category.model.js';
import Produt from '../models/Produt.model.js';
import mongoose from 'mongoose';

/**
 * Criar comerciante
 * @param {Object} data - { name, category, schoolId, nif, password }
 * @returns {Object} { merchant, wallet }
 */
export const createMerchant = async (data) => {
  const { name, category, schoolId, nif, password } = data;

  const school = await School.findById(schoolId);
  if (!school) {
    throw Object.assign(new Error('Escola nao encontrada'), { status: 400 });
  }

  const merchant = await Merchant.create({
    name,
    category,
    schoolId,
    nif,
    password,
  });

  const wallet = await Wallet.create({
    ownerId: merchant._id,
    ownerModel: 'Merchant',
    balance: 0,
    currency: 'AOA',
    status: 'active',
  });

  merchant.walletId = wallet._id;
  await merchant.save();

  return { merchant, wallet };
};

/**
 * Obter comerciantes por escola
 * @param {string} schoolId
 * @returns {Array} Lista de comerciantes
 */
export const getMerchantsBySchool = async (schoolId) => {
  const merchants = await Merchant.find({ schoolId }).populate('walletId');
  return merchants;
};

/**
 * Atualizar comerciante
 * @param {string} id - ID do comerciante
 * @param {Object} updates - Campos a atualizar
 * @returns {Object} merchant atualizado
 */
export const updateMerchant = async (id, updates) => {
  const allowedFields = [
    'name',
    'email',
    'category',
    'phone',
    'description',
    'address',
    'profilePicture',
    'preferences',
    'notificationSettings',
  ];

  const forbiddenFields = [
    '_id',
    'nif',
    'password',
    'schoolId',
    'walletId',
    'role',
    'isActive',
    'termsAccepted',
    'termsAcceptedAt',
  ];

  // Validar campos proibidos
  for (const field of Object.keys(updates)) {
    if (forbiddenFields.includes(field)) {
      throw Object.assign(new Error(`Campo "${field}" não pode ser atualizado`), { status: 400 });
    }
  }

  // Filtrar campos permitidos
  const filteredUpdates = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      filteredUpdates[field] = updates[field];
    }
  }

  if (Object.keys(filteredUpdates).length === 0) {
    throw Object.assign(new Error('Nenhum campo válido para atualizar'), { status: 400 });
  }

  const merchant = await Merchant.findById(id);
  if (!merchant) {
    throw Object.assign(new Error('Comerciante não encontrado'), { status: 404 });
  }

  Object.assign(merchant, filteredUpdates);
  await merchant.save();

  return {
    merchant,
    updatedFields: Object.keys(filteredUpdates),
  };
};

/**
 * Validar se usuário pode atualizar comerciante
 * @param {string} requesterId - ID do solicitante
 * @param {string} requesterModel - Modelo do solicitante
 * @param {string} merchantId - ID do comerciante
 * @returns {boolean}
 */
export const canUpdateMerchant = async (requesterId, requesterModel, merchantId) => {
  if (requesterId.toString() === merchantId.toString()) {
    return true;
  }

  if (requesterModel === 'School') {
    const merchant = await Merchant.findById(merchantId);
    if (merchant && merchant.schoolId.toString() === requesterId.toString()) {
      return true;
    }
  }

  return false;
};

/**
 * Deletar comerciante
 * @param {string} id
 * @returns {Object} comerciante deletado
 */
export const deleteMerchant = async (id) => {
  const deleted = await Merchant.findByIdAndDelete(id);
  if (!deleted) {
    throw Object.assign(new Error('Comerciante nao encontrado'), { status: 404 });
  }

  // Eliminar wallet vinculada
  await Wallet.findOneAndDelete({
    ownerId: deleted._id,
    ownerModel: 'Merchant',
  });

  return deleted;
};

/**
 * Atualizar status do comerciante
 * @param {string} id - ID do comerciante
 * @param {boolean} isActive
 * @param {string} schoolId - ID da escola solicitante
 * @returns {Object} merchant atualizado
 */
export const updateMerchantStatus = async (id, isActive, schoolId) => {
  if (typeof isActive !== 'boolean') {
    throw Object.assign(new Error('O campo isActive deve ser um boolean'), { status: 400 });
  }

  const merchant = await Merchant.findById(id);
  if (!merchant) {
    throw Object.assign(new Error('Comerciante nao encontrado'), { status: 404 });
  }

  if (String(merchant.schoolId) !== String(schoolId)) {
    throw Object.assign(new Error('Nao autorizado a alterar este comerciante'), { status: 403 });
  }

  merchant.isActive = isActive;
  await merchant.save();

  return merchant;
};

/**
 * Listar categorias do comerciante
 * @param {string} merchantId
 * @returns {Array} Lista de categorias
 */
export const getCategories = async (merchantId) => {
  const categories = await Category.find({ merchantId }).sort({ name: 1 });
  return categories;
};

/**
 * Criar categoria
 * @param {string} merchantId
 * @param {Object} data - { name, description }
 * @returns {Object} categoria criada
 */
export const createCategory = async (merchantId, data) => {
  const { name, description } = data;

  if (!name) {
    throw Object.assign(new Error('Nome da categoria é obrigatório'), { status: 400 });
  }

  const existing = await Category.findOne({ merchantId, name });
  if (existing) {
    throw Object.assign(new Error('Já existe uma categoria com este nome'), { status: 400 });
  }

  const category = await Category.create({
    merchantId,
    name,
    description: description || '',
  });

  return category;
};

/**
 * Deletar categoria
 * @param {string} merchantId
 * @param {string} categoryId
 * @returns {Object} categoria deletada
 */
export const deleteCategory = async (merchantId, categoryId) => {
  const deletedCategory = await Category.findOneAndDelete({
    _id: categoryId,
    merchantId,
  });

  if (!deletedCategory) {
    throw Object.assign(new Error('Categoria não encontrada'), { status: 404 });
  }

  // Deletar produtos vinculados
  await Produt.deleteMany({ categoryId: deletedCategory._id });

  return deletedCategory;
};

/**
 * Criar produto
 * @param {string} merchantId
 * @param {Object} data - { schoolId, name, price, quantity, categoryName, img }
 * @returns {Object} produto criado
 */
export const createProduct = async (merchantId, data) => {
  const { schoolId, name, price, quantity, categoryName, img } = data;

  if (!name || !price || !quantity || !schoolId) {
    throw Object.assign(new Error('Campos obrigatorios faltando'), { status: 400 });
  }

  if (!mongoose.Types.ObjectId.isValid(merchantId)) {
    throw Object.assign(new Error('MerchantId invalido'), { status: 400 });
  }

  const existingProduct = await Produt.findOne({
    merchantId,
    name: { $regex: `^${name.trim()}$`, $options: 'i' },
  });

  if (existingProduct) {
    throw Object.assign(new Error('Já existe um produto com esse nome'), { status: 400 });
  }

  let categoryId = null;
  if (categoryName) {
    const category = await Category.findOne({ merchantId, name: categoryName });
    if (!category) {
      throw Object.assign(new Error('Categoria não encontrada. Crie a categoria primeiro'), {
        status: 400,
      });
    }
    categoryId = category._id;
  }

  const newProduct = await Produt.create({
    merchantId,
    schoolId,
    name: name.trim(),
    price,
    quantity,
    categoryId,
    img: img || null,
  });

  return newProduct;
};

/**
 * Obter produtos do comerciante
 * @param {string} merchantId
 * @returns {Array} Lista de produtos
 */
export const getProductsByMerchant = async (merchantId) => {
  if (!mongoose.Types.ObjectId.isValid(merchantId)) {
    throw Object.assign(new Error('MerchantId invalido'), { status: 400 });
  }

  const products = await Produt.find({ merchantId })
    .populate('categoryId', 'name')
    .sort({ createdAt: -1 });

  return products;
};

/**
 * Atualizar produto
 * @param {string} productId
 * @param {Object} data - { name, price, quantity, categoryName, img, isActive }
 * @returns {Object} produto atualizado
 */
export const updateProduct = async (productId, data) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw Object.assign(new Error('Produto inválido'), { status: 400 });
  }

  const product = await Produt.findById(productId);
  if (!product) {
    throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
  }

  const { name, price, quantity, categoryName, img, isActive } = data;

  if (name && name.trim() !== product.name) product.name = name.trim();
  if (price !== undefined && price !== product.price) product.price = price;
  if (quantity !== undefined && quantity !== product.quantity) product.quantity = quantity;
  if (img !== undefined && img !== product.img) product.img = img;
  if (isActive !== undefined && isActive !== product.isActive) product.isActive = isActive;

  if (categoryName) {
    const category = await Category.findOne({
      merchantId: product.merchantId,
      name: categoryName,
    });

    if (!category) {
      throw Object.assign(new Error('Categoria não encontrada'), { status: 404 });
    }

    if (!product.categoryId.equals(category._id)) {
      product.categoryId = category._id;
    }
  }

  if (!product.isModified()) {
    return { unchanged: true, product };
  }

  await product.save();
  await product.populate('categoryId');

  return { product };
};

/**
 * Deletar produto
 * @param {string} productId
 * @returns {Object} produto deletado
 */
export const deleteProduct = async (productId) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw Object.assign(new Error('Produto inválido'), { status: 400 });
  }

  const product = await Produt.findByIdAndDelete(productId);
  if (!product) {
    throw Object.assign(new Error('Produto não encontrado'), { status: 404 });
  }

  return product;
};

/**
 * Alterar senha do comerciante
 * @param {string} merchantId
 * @param {Object} data - { currentPassword, newPassword }
 * @returns {boolean} true
 */
export const changeMerchantPassword = async (merchantId, data) => {
  const { currentPassword, newPassword } = data;

  if (!currentPassword || !newPassword) {
    throw Object.assign(new Error('Preencha todos os campos'), { status: 400 });
  }

  if (newPassword.length < 8) {
    throw Object.assign(new Error('A senha deve ter pelo menos 8 caracteres'), { status: 400 });
  }

  const merchant = await Merchant.findById(merchantId).select('+password');
  if (!merchant) {
    throw Object.assign(new Error('Comerciante não encontrado'), { status: 404 });
  }

  const isMatch = await merchant.matchPassword(currentPassword);
  if (!isMatch) {
    throw Object.assign(new Error('Senha atual incorreta'), { status: 400 });
  }

  const isSamePassword = await merchant.matchPassword(newPassword);
  if (isSamePassword) {
    throw Object.assign(new Error('A nova senha deve ser diferente da atual'), { status: 400 });
  }

  merchant.password = newPassword;
  await merchant.save();

  return true;
};
