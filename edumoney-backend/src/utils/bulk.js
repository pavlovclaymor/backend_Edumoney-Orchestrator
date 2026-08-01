import XLSX from 'xlsx';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../models/user.model.js';
import Class from '../models/class.model.js';
import Wallet from '../models/wallet.js';
import School from '../models/school.model.js';

import { writeAuditLog } from './auditLogger.js';

export const bulkUploadStudents = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Arquivo não enviado' });
    }

    const { schoolId } = req.body;
    if (!schoolId) {
      return res.status(400).json({ message: 'schoolId é obrigatório' });
    }

    const schoolExists = await School.findById(schoolId).session(session);
    if (!schoolExists) {
      return res.status(400).json({ message: 'Escola não existe' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const rows = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const sheetRows = XLSX.utils.sheet_to_json(sheet);
      if (sheetRows.length) rows.push(...sheetRows);
    }

    if (!rows.length) {
      return res.status(400).json({ message: 'Arquivo vazio' });
    }

    const existingStudents = await User.find({ schoolId }).select('processNumber').session(session);
    const existingSet = new Set(existingStudents.map((s) => s.processNumber));

    const createdStudents = [];
    const skippedStudents = [];
    const classStudentsMap = new Map();
    const batchSize = 100;

    const getColumn = (row, keys) => {
      for (const key of keys) {
        if (row[key] !== undefined) return row[key];
      }
      return undefined;
    };

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const usersToInsert = [];

      for (const row of batch) {
        const name = getColumn(row, ['name', 'Name', 'nome', 'Nome'])?.toString().trim();
        const processNumber = getColumn(row, [
          'processNumber',
          'ProcessNumber',
          'Process Number',
          'Número de Processo',
          'Numero de Processo',
          'numero de processo',
        ])
          ?.toString()
          .trim();
        const turmaName = getColumn(row, ['turma', 'Turma'])?.toString().trim();

        if (!name || !processNumber || !turmaName) {
          skippedStudents.push({ row, reason: 'Campos obrigatórios ausentes' });
          continue;
        }

        if (existingSet.has(processNumber)) {
          skippedStudents.push({ row, reason: 'Aluno já existe' });
          continue;
        }

        let classe = await Class.findOne({ name: turmaName, schoolId }).session(session);
        if (!classe) {
          classe = await Class.create(
            [
              {
                name: turmaName,
                year: new Date().getFullYear(),
                schoolId,
                students: [],
              },
            ],
            { session },
          );
          classe = classe[0];
        }

        // Hash manual da senha padrão
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('12345678', salt);

        usersToInsert.push({
          name,
          processNumber,
          password: hashedPassword, // já hashada
          role: 'student',
          schoolId,
          classId: classe._id,
          year: classe.year,
          status: 'inativo',
        });

        existingSet.add(processNumber);
      }

      if (usersToInsert.length > 0) {
        const insertedUsers = await User.insertMany(usersToInsert, { session });

        const walletsToCreate = insertedUsers.map((user) => ({
          ownerId: user._id,
          ownerModel: 'User',
          balance: 0,
          currency: 'AOA',
          status: 'closed',
          totalCredits: 0,
          totalDebits: 0,
        }));

        const createdWallets = await Wallet.insertMany(walletsToCreate, {
          session,
        });

        const walletMap = new Map();
        createdWallets.forEach((wallet) => walletMap.set(wallet.ownerId.toString(), wallet._id));

        const bulkUpdates = insertedUsers.map((user) => ({
          updateOne: {
            filter: { _id: user._id },
            update: { walletId: walletMap.get(user._id.toString()) },
          },
        }));
        if (bulkUpdates.length) {
          await User.bulkWrite(bulkUpdates, { session });
        }

        for (const user of insertedUsers) {
          const key = user.classId.toString();
          if (!classStudentsMap.has(key)) classStudentsMap.set(key, []);
          classStudentsMap.get(key).push(user._id);
        }

        createdStudents.push(
          ...insertedUsers.map((user) => ({
            ...user.toObject(),
            walletId: walletMap.get(user._id.toString()),
          })),
        );
      }
    }

    for (const [classId, studentIds] of classStudentsMap.entries()) {
      await Class.findByIdAndUpdate(
        classId,
        { $addToSet: { students: { $each: studentIds } } },
        { session },
      );
    }

    await writeAuditLog({
      userId: schoolId,
      userModel: 'School',
      action: 'Student_CREATED',
      entity: 'Student',
      entityId: schoolId,
      status: 'success',
      schoolId: schoolId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: 'Upload finalizado com sucesso',
      totalCreated: createdStudents.length,
      totalSkipped: skippedStudents.length,
      students: createdStudents,
      skippedStudents,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Erro no bulk upload:', error);
    return res.status(500).json({
      message: 'Erro ao processar arquivo',
      error: error.message,
    });
  }
};
