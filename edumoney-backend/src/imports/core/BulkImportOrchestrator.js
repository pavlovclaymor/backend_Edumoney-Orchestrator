/**
 * Bulk Import Orchestrator (Simplified)
 * Apenas: Parse, Validate, Deduplicate, Insert, Events, Audit.
 * Sem interpretação acadêmica.
 * Turma tratada como string pura.
 */

import mongoose from 'mongoose';
import { excelCompatibilityEngine } from '../parsers/ExcelCompatibilityEngine.js';
import User from '../../models/user.model.js';
import Class from '../../models/class.model.js';
import Wallet from '../../models/wallet.js';
import School from '../../models/school.model.js';
import { redisPublisher } from '../../core/redis/index.js';
import { observability } from '../../core/observability/Observability.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export class BulkImportOrchestrator {
  constructor() {
    this.defaultBatchSize = 100;
  }

  /**
   * Orquestrar importação de estudantes
   * @param {Object} options - Opções da importação
   */
  async importStudents(options) {
    const importId = crypto.randomUUID();
    const startTime = Date.now();
    const traceId = observability.startTrace(importId, 'STUDENT_IMPORT');

    let session = null;

    try {
      // 1. Parse do Excel (apenas mapeamento de colunas)
      observability.addEvent(importId, 'excel.parse.start');
      const parseResult = excelCompatibilityEngine.parse(options.fileBuffer);

      if (!parseResult.success) {
        throw new Error(`Parse failed: ${parseResult.error}`);
      }

      observability.addEvent(importId, 'excel.parse.complete', {
        totalRows: parseResult.totalRows,
      });

      // 2. Preparar classes existentes na escola
      const classMap = await this.prepareClasses(options.schoolId, parseResult.data);

      // 3. Iniciar sessão e transação
      session = await mongoose.startSession();
      session.startTransaction();

      // 4. Validar escola
      const school = await School.findById(options.schoolId).session(session);
      if (!school) {
        throw new Error('Escola não encontrada');
      }

      // 5. Processar em lotes
      const results = await this.processStudentBatches(parseResult.data, classMap, {
        schoolId: options.schoolId,
        importId,
        session,
      });

      // 6. Commit
      await session.commitTransaction();

      // 7. Emitir eventos
      await this.emitImportEvents(importId, results, options.schoolId);

      // 8. Audit log
      await this.logImportAudit(importId, results, options, startTime);

      // Finalizar trace
      const duration = Date.now() - startTime;
      observability.endTrace(importId, 'COMPLETED');
      observability.recordPaymentMetric({
        latency: duration,
        amount: 0,
        type: 'student_import',
        status: 'success',
        userId: options.schoolId,
      });

      return {
        success: true,
        importId,
        ...results,
        duration,
      };
    } catch (error) {
      if (session) {
        await session.abortTransaction();
      }

      observability.endTrace(importId, 'FAILED', error);
      observability.log('ERROR', 'Student import failed', {
        importId,
        error: error.message,
      });

      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * Preparar mapa de classes da escola
   */
  async prepareClasses(schoolId, rows) {
    const classMap = new Map();

    // Extrair nomes de turmas únicos dos dados
    const uniqueClassNames = new Set();
    for (const row of rows) {
      if (row.className) {
        uniqueClassNames.add(row.className);
      }
    }

    // Buscar ou criar classes
    for (const className of uniqueClassNames) {
      let existingClass = await Class.findOne({
        name: className,
        schoolId,
      });

      if (!existingClass) {
        [existingClass] = await Class.create([
          {
            name: className, // STRING PURA - sem transformação
            year: new Date().getFullYear(),
            schoolId,
            students: [],
          },
        ]);
      }

      classMap.set(className, existingClass);
    }

    return classMap;
  }

  /**
   * Processar estudantes em lotes
   */
  async processStudentBatches(rows, classMap, options) {
    const { schoolId, importId, session } = options;

    const batchSize = options.batchSize || this.defaultBatchSize;
    const createdStudents = [];
    const skippedStudents = [];
    const errors = [];

    // Processar em lotes
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const batchId = `${importId}_batch_${Math.floor(i / batchSize)}`;

      observability.addEvent(importId, 'batch.start', {
        batchId,
        batchNumber: Math.floor(i / batchSize) + 1,
        rowsInBatch: batch.length,
      });
      let batchResult;

      try {
        batchResult = await this.processStudentBatch(batch, classMap, schoolId, session, batchId);

        createdStudents.push(...batchResult.created);
        skippedStudents.push(...batchResult.skipped);
      } catch (error) {
        errors.push({
          batch: Math.floor(i / batchSize),
          error: error.message,
        });
      }

      observability.addEvent(importId, 'batch.complete', {
        batchId,
        created: batchResult?.created?.length || 0,
        skipped: batchResult?.skipped?.length || 0,
      });
    }

    return {
      createdCount: createdStudents.length,
      skippedCount: skippedStudents.length,
      errorCount: errors.length,
      createdStudents,
      skippedStudents,
      errors,
    };
  }

  /**
   * Processar lote de estudantes
   */
  async processStudentBatch(batch, classMap, schoolId, session, batchId) {
    const created = [];
    const skipped = [];

    // Buscar estudantes existentes para deduplicação
    const processNumbers = batch.map((r) => r.processNumber).filter((pn) => pn);

    const existingStudents = await User.find({
      schoolId,
      processNumber: { $in: processNumbers },
    })
      .select('processNumber')
      .session(session);

    const existingSet = new Set(existingStudents.map((s) => s.processNumber));

    // Preparar usuários para inserção
    const usersToInsert = [];
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('12345678', salt);

    for (const row of batch) {
      // Validar campos obrigatórios
      const validation = excelCompatibilityEngine.validateRequiredFields(row);
      if (!validation.valid) {
        skipped.push({
          row: row._original,
          reasons: validation.errors,
        });
        continue;
      }

      // Verificar duplicado
      if (existingSet.has(row.processNumber)) {
        skipped.push({
          row: row._original,
          reasons: ['Estudante já existe'],
        });
        continue;
      }

      // Obter turma - STRING PURA
      const classObj = classMap.get(row.className);

      if (!classObj) {
        skipped.push({
          row: row._original,
          reasons: ['Turma não encontrada'],
        });
        continue;
      }

      // Criar usuário com apenas campos necessários
      usersToInsert.push({
        name: row.studentName,
        processNumber: row.processNumber,
        password: hashedPassword,
        role: 'student',
        schoolId,
        classId: classObj._id,
        year: row.academicYear || new Date().getFullYear(),
        status: 'inativo',
      });

      existingSet.add(row.processNumber);
    }

    // Inserir usuários
    if (usersToInsert.length > 0) {
      const insertedUsers = await User.insertMany(usersToInsert, { session });

      // Criar wallets
      const wallets = insertedUsers.map((user) => ({
        ownerId: user._id,
        ownerModel: 'User',
        balance: 0,
        currency: 'AOA',
        status: 'closed',
        totalCredits: 0,
        totalDebits: 0,
      }));

      const createdWallets = await Wallet.insertMany(wallets, { session });

      // Atualizar usuários com walletId
      const walletMap = new Map(createdWallets.map((w) => [w.ownerId.toString(), w._id]));

      const bulkUpdates = insertedUsers.map((user) => ({
        updateOne: {
          filter: { _id: user._id },
          update: { walletId: walletMap.get(user._id.toString()) },
        },
      }));

      await User.bulkWrite(bulkUpdates, { session });

      // Atualizar classes com estudantes
      const classStudentsMap = new Map();
      for (const user of insertedUsers) {
        const key = user.classId.toString();
        if (!classStudentsMap.has(key)) {
          classStudentsMap.set(key, []);
        }
        classStudentsMap.get(key).push(user._id);
      }

      for (const [classId, studentIds] of classStudentsMap.entries()) {
        await Class.findByIdAndUpdate(
          classId,
          { $addToSet: { students: { $each: studentIds } } },
          { session },
        );
      }

      created.push(
        ...insertedUsers.map((user) => ({
          id: user._id,
          name: user.name,
          processNumber: user.processNumber,
          classId: user.classId,
        })),
      );
    }

    return { created, skipped };
  }

  /**
   * Emitir eventos para Redis
   */
  async emitImportEvents(importId, results, schoolId) {
    try {
      await redisPublisher.publish('system:import_completed', {
        eventType: 'student.import.completed',
        importId,
        schoolId,
        createdCount: results.createdCount,
        skippedCount: results.skippedCount,
        errorCount: results.errorCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to emit import event:', error.message);
    }
  }

  /**
   * Log de auditoria da importação
   */
  async logImportAudit(importId, results, options, startTime) {
    try {
      await writeAuditLog({
        userId: options.schoolId,
        userModel: 'School',
        action: 'STUDENT_BULK_IMPORT',
        entity: 'Import',
        entityId: importId,
        status: 'success',
        schoolId: options.schoolId,
        metadata: {
          importId,
          createdCount: results.createdCount,
          skippedCount: results.skippedCount,
          errorCount: results.errorCount,
          duration: Date.now() - startTime,
        },
      });
    } catch (error) {
      console.error('Failed to write audit log:', error.message);
    }
  }
}

export const bulkImportOrchestrator = new BulkImportOrchestrator();
export default bulkImportOrchestrator;
