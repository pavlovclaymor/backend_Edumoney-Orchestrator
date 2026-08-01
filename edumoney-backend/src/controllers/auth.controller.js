/**
 * Auth Controller
 * Delega toda a lógica de negócio para auth.service.js
 * O controller apenas recebe req/res e passa para o service.
 *
 * Uses Contract-First pattern:
 * - DTO for data transformation
 * - ResponseWrapper for standardization
 */

import { writeAuditLog } from '../utils/auditLogger.js';
import { createNotification } from './notification.controller.js';
import * as authService from '../services/auth.service.js';
import { AuthDTO, UserDTO } from '../utils/dto/index.js';
import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';

// Helper para extrair contexto de auditoria do req
const getAuditContext = (req) => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

// =========================================================
// REGISTER - Registrar estudante
// =========================================================
export const register = async (req, res) => {
  try {
    const { name, processNumber, role = 'student', classId, year, schoolId } = req.body;

    if (!name || !processNumber || !schoolId || !classId || !year) {
      return res
        .status(400)
        .json(
          ErrorResponse.badRequest(
            'name, processNumber, schoolId, classId e year são obrigatórios',
          ),
        );
    }

    const result = await authService.registerStudent(
      { name, processNumber, role, classId, year, schoolId },
      getAuditContext(req),
    );

    await writeAuditLog({
      userId: result._id,
      userModel: 'User',
      action: 'Estudante criado',
      entity: 'User',
      entityId: result._id,
      status: 'success',
      schoolId: result.schoolId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: result.name,
    }).catch(() => {});
    // Apply DTO transformation
    const dto = AuthDTO.registrationResult(result);
    console.log(dto);

    return res.status(201).json(ApiResponse.created(dto, `Aluno ${dto.name} criado com sucesso`));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 400
        ? ErrorResponse.badRequest(error.message)
        : status === 404
          ? ErrorResponse.notFound('Escola')
          : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// LOGIN - Login de usuário, escola ou comerciante
// =========================================================
export const login = async (req, res) => {
  // Impede cache
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  try {
    const { nif = '', processNumber, password, schoolId = '', email = '' } = req.body;
    const auditContext = getAuditContext(req);

    // ================================
    // LOGIN POR NÚMERO DE PROCESSO
    // ================================
    if (processNumber && schoolId) {
      const result = await authService.loginByProcessNumber(
        { processNumber, schoolId, password },
        auditContext,
      );

      if (!result.success) {
        await writeAuditLog({
          userId: null,
          userModel: 'User',
          action:
            result.reason === 'NOT_FOUND'
              ? 'STUDENT_LOGIN_FAILED_NOT_FOUND'
              : 'STUDENT_FAILED_LOGIN',
          entity: 'User',
          entityId: null,
          status: 'failed',
          schoolId: schoolId,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: { processNumber },
        }).catch(() => {});

        return res.status(401).json(ErrorResponse.unauthorized('Credenciais invalidas'));
      }

      await writeAuditLog({
        userId: result.userObj._id,
        userModel: 'User',
        action: 'STUDENT_LOGIN_SUCCESS',
        entity: 'User',
        entityId: result.userObj._id,
        status: 'success',
        schoolId: schoolId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: result.userObj.name,
      }).catch(() => {});

      // Apply DTO transformation
      const dto = AuthDTO.loginSuccess(result, 'student');

      return res.status(200).json(ApiResponse.success(dto, 'Login successful'));
    }

    // ================================
    // LOGIN POR NIF (ESCOLA OU MERCHANT)
    // ================================
    if (nif && password) {
      // Tenta Escola primeiro
      const schoolResult = await authService.loginSchoolByNIF({ nif, password });
      if (schoolResult.success) {
        await writeAuditLog({
          userId: schoolResult.school._id,
          userModel: 'School',
          action: 'SCHOOL_LOGIN_SUCCESS',
          entity: 'LOGIN',
          entityId: schoolResult.school._id,
          status: 'success',
          schoolId: schoolResult.school._id,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: { name: schoolResult.school.name },
        }).catch(() => {});

        // Apply DTO transformation
        const dto = AuthDTO.loginSuccess(schoolResult, 'school');
        return res.status(200).json(ApiResponse.success(dto, 'Login successful'));
      }

      // Tenta Merchant
      const merchantResult = await authService.loginMerchantByNIF({ nif, password });
      if (merchantResult.success) {
        await writeAuditLog({
          userId: merchantResult.merchant._id,
          userModel: 'Merchant',
          action: 'MERCHANT_LOGIN_SUCCESS',
          entity: 'LOGIN',
          entityId: merchantResult.merchant._id,
          status: 'success',
          schoolId: merchantResult.merchant.schoolId,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: { name: merchantResult.merchant.name },
        }).catch(() => {});

        // Apply DTO transformation
        const dto = AuthDTO.loginSuccess(merchantResult, 'merchant');

        return res.status(200).json(ApiResponse.success(dto, 'Login successful'));
      }

      return res.status(401).json(ErrorResponse.unauthorized('Credenciais invalidas'));
    }

    // ================================
    // LOGIN POR EMAIL
    // ================================
    if (email && password) {
      // Tentar Admin primeiro (role=admin)
      const adminResult = await authService.loginAdminByEmail({ email, password });
      if (adminResult.success) {
        await writeAuditLog({
          userId: adminResult.userObj._id,
          userModel: 'User',
          action: 'ADMIN_LOGIN_SUCCESS',
          entity: 'User',
          entityId: adminResult.userObj._id,
          status: 'success',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: adminResult.userObj.name,
        }).catch(() => {});

        const dto = AuthDTO.loginSuccess(adminResult, 'admin');
        return res.status(200).json(ApiResponse.success(dto, 'Login successful'));
      }

      // Tentar Student
      const emailResult = await authService.loginByEmail({ email, schoolId, password });

      if (!emailResult.success) {
        return res.status(401).json(ErrorResponse.unauthorized('Credenciais invalidas'));
      }

      await writeAuditLog({
        userId: emailResult.userObj._id,
        userModel: 'User',
        action: 'STUDENT_EMAIL_LOGIN',
        entity: 'User',
        entityId: emailResult.userObj._id,
        status: 'success',
        schoolId: emailResult.userObj.schoolId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: emailResult.userObj.name,
      }).catch(() => {});

      // Apply DTO transformation
      const dto = AuthDTO.loginSuccess(emailResult, 'student');

      return res.status(200).json(ApiResponse.success(dto, 'Login successful'));
    }

    // ================================
    // REQUEST INVÁLIDA
    // ================================
    return res
      .status(400)
      .json(ErrorResponse.badRequest('Verifique o NIF, número de processo ou password'));
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json(ErrorResponse.internal('Server error'));
  }
};

// =========================================================
// GET STUDENTS BY SCHOOL
// =========================================================
export const getSudentsBySchool = async (req, res) => {
  try {
    const { schoolId } = req.params;

    if (!schoolId) {
      return res.status(400).json(ErrorResponse.badRequest('schoolId é obrigatório'));
    }

    const result = await authService.getStudentsBySchool(schoolId);

    // Apply DTO transformation
    const dto = {
      students: result.students ? UserDTO.fromArray(result.students) : [],
      classes: result.classes || [],
    };

    return res.status(200).json(ApiResponse.success(dto, 'Estudantes recuperados'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// =========================================================
// GET STUDENT PROFILE
// =========================================================
export const getStudentProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const userData = await authService.getStudentProfile(userId);

    if (!userData) {
      return res.status(404).json(ErrorResponse.notFound('Usuário'));
    }

    // Apply DTO transformation
    const dto = UserDTO.fromDocument(userData);

    return res.status(200).json(ApiResponse.success(dto, 'Perfil recuperado'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// =========================================================
// UPDATE STUDENT
// =========================================================
export const updateStudent = async (req, res) => {
  try {
    const userId = req.user._id;
    const updates = req.body;

    const userData = await authService.updateStudentProfile(userId, updates, getAuditContext(req));

    // Apply DTO transformation
    const dto = UserDTO.fromDocument(userData);

    return res.status(200).json(ApiResponse.success(dto, 'Perfil atualizado com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404 ? ErrorResponse.notFound('Usuário') : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// CHANGE PASSWORD
// =========================================================
export const changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res
        .status(400)
        .json(
          ErrorResponse.badRequest(
            'currentPassword, newPassword e confirmPassword são obrigatórios',
          ),
        );
    }

    const userData = await authService.changeStudentPassword(
      userId,
      { currentPassword, newPassword, confirmPassword },
      getAuditContext(req),
    );

    await writeAuditLog({
      userId: userId,
      userModel: 'User',
      action: 'USER_PASSWORD_CHANGED',
      entity: 'User',
      entityId: userId,
      status: 'success',
      schoolId: userData.schoolId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    await createNotification(
      userId,
      'User',
      'Senha Atualizada',
      'A sua senha de acesso foi alterada com sucesso.',
      'security',
      'normal',
    );

    return res
      .status(200)
      .json(ApiResponse.success({ success: true }, 'Senha atualizada com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 400
        ? ErrorResponse.badRequest(error.message)
        : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// SET PIN
// =========================================================
export const setPin = async (req, res) => {
  try {
    const userId = req.user._id;
    const { pin } = req.body;

    if (!pin || !/^\d{4}$/.test(pin)) {
      return res
        .status(400)
        .json(ErrorResponse.validation('O PIN deve ter exatamente 4 dígitos numéricos'));
    }

    const result = await authService.setStudentPin(userId, { pin }, getAuditContext(req));

    await writeAuditLog({
      userId: userId,
      userModel: 'User',
      action: result.wasActivated ? 'USER_PIN_SET_ACTIVATED' : 'USER_PIN_SET',
      entity: 'User',
      entityId: userId,
      status: 'success',
      schoolId: req.user.schoolId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    await createNotification(
      userId,
      'User',
      'PIN Configurado',
      'Seu PIN foi configurado com sucesso.',
      'security',
      'normal',
    );

    const dto = UserDTO.fromDocument(result.userData);

    return res.status(200).json(
      ApiResponse.success(
        {
          wasActivated: result.wasActivated,
          userData: dto
        },
        'PIN configurado com sucesso',
      ),
    );
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 400
        ? ErrorResponse.badRequest(error.message)
        : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// EMAIL VERIFICATION
// =========================================================
export const requestEmailVerification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json(ErrorResponse.badRequest('Email é obrigatório'));
    }

    await authService.requestEmailVerification(userId, { email });

    return res
      .status(200)
      .json(ApiResponse.success({ sent: true }, 'Código enviado para o seu email'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const userId = req.user._id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json(ErrorResponse.badRequest('Código é obrigatório'));
    }

    await authService.verifyEmailCode(userId, { code });

    return res
      .status(200)
      .json(ApiResponse.success({ verified: true }, 'Email verificado com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 400
        ? ErrorResponse.badRequest(error.message)
        : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// FORGOT PASSWORD / RESET PASSWORD
// =========================================================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json(ErrorResponse.badRequest('Email é obrigatório'));
    }

    await authService.requestPasswordReset({ email });

    return res
      .status(200)
      .json(ApiResponse.success({ sent: true }, 'Código enviado para o seu email'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res
        .status(400)
        .json(ErrorResponse.badRequest('Email, código e nova senha são obrigatórios'));
    }

    await authService.resetPasswordWithCode({ email, code, newPassword });

    return res
      .status(200)
      .json(ApiResponse.success({ reset: true }, 'Senha redefinida com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 400
        ? ErrorResponse.badRequest(error.message)
        : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};
