/**
 * Excel Compatibility Engine (Simplified)
 * Apenas mapeia colunas, NÃO interpreta valores.
 * Turma é tratada como string pura.
 */

import XLSX from 'xlsx';

export class ExcelCompatibilityEngine {
  constructor() {
    // Mapeamento de nomes de colunas - apenas para detecção
    this.columnMappings = {
      // Nome do aluno
      studentName: [
        'name',
        'Name',
        'nome',
        'Nome',
        'Nome do Aluno',
        'Nome do Estudante',
        'Aluno',
        'Estudante',
        'Discente',
        'Nome Completo',
        'Nome Completo do Aluno',
        'NOME',
        'NOMBRE',
      ],

      // Número de processo / matrícula
      processNumber: [
        'processNumber',
        'ProcessNumber',
        'Process Number',
        'Número de Processo',
        'Numero de Processo',
        'numero de processo',
        'Nº Processo',
        'N° Processo',
        'Processo',
        'Matrícula',
        'Matricula',
        'Codigo Aluno',
        'Código Aluno',
        'Código do Aluno',
        'student_id',
        'studentId',
        'STUDENT_ID',
      ],

      // Turma - STRING PURA, sem interpretação
      className: [
        'turma',
        'Turma',
        'Classe',
        'classe',
        'Sala',
        'sala',
        'Grupo',
        'grupo',
        'Seção',
        'Secção',
        'Secao',
        'Class',
        'CLASS',
        'turma_name',
        'Turma Name',
      ],

      // Ano letivo - mantém formato original
      academicYear: [
        'ano',
        'Ano',
        'Ano Escolar',
        'Ano Lectivo',
        'Ano Letivo',
        'anoLectivo',
        'anoLetivo',
        'year',
        'Year',
        'Academic Year',
        'academic_year',
      ],

      // Contato (apenas para referência, não obrigatório)
      phone: [
        'telefone',
        'Telefone',
        'Telemovel',
        'Telemóvel',
        'phone',
        'Phone',
        'mobile',
        'celular',
        'Celular',
        'Contacto',
        'Contato',
      ],

      // Email (apenas para referência, não obrigatório)
      email: ['email', 'Email', 'e-mail', 'E-mail', 'EMAIL', 'mail', 'Mail'],

      // BI (apenas para referência, não obrigatório)
      bi: [
        'bi',
        'BI',
        'NBI',
        'nbi',
        'Bilhete de Identidade',
        'Bilhete',
        'documento',
        'Documento',
        'Passaporte',
        'passaporte',
      ],
    };

    // Cache de mapeamentos resolvidos
    this.resolvedMappings = new Map();
  }

  /**
   * Parsear arquivo Excel e detectar colunas automaticamente
   * @param {Buffer} buffer - Buffer do arquivo Excel
   * @returns {Object} Dados parseados com mapeamento de colunas
   */
  parse(buffer) {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      const allRows = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (sheetRows.length) allRows.push(...sheetRows);
      }

      if (allRows.length === 0) {
        return { success: false, error: 'Arquivo vazio' };
      }

      // Detectar mapeamentos das colunas
      const firstRow = allRows[0];
      const detectedColumns = this.detectColumns(firstRow);

      // Normalizar todas as linhas
      const normalizedRows = allRows.map((row) => this.normalizeRow(row, detectedColumns));

      return {
        success: true,
        data: normalizedRows,
        totalRows: normalizedRows.length,
        detectedColumns,
        sheetNames: workbook.SheetNames,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Detectar colunas automaticamente
   * @param {Object} sampleRow - Primeira linha para detecção
   * @returns {Object} Mapeamento de colunas detectadas
   */
  detectColumns(sampleRow) {
    const cacheKey = JSON.stringify(Object.keys(sampleRow));

    if (this.resolvedMappings.has(cacheKey)) {
      return this.resolvedMappings.get(cacheKey);
    }

    const detected = {};
    const availableColumns = Object.keys(sampleRow);

    for (const [fieldType, alternatives] of Object.entries(this.columnMappings)) {
      for (const alt of alternatives) {
        if (availableColumns.includes(alt)) {
          detected[fieldType] = alt;
          break;
        }
      }

      // Fallback: buscar partial match
      if (!detected[fieldType]) {
        for (const availableCol of availableColumns) {
          const normalizedAvailable = availableCol.toLowerCase().replace(/[_\s-]/g, '');
          for (const alt of alternatives) {
            const normalizedAlt = alt.toLowerCase().replace(/[_\s-]/g, '');
            if (
              normalizedAvailable.includes(normalizedAlt) ||
              normalizedAlt.includes(normalizedAvailable)
            ) {
              detected[fieldType] = availableCol;
              break;
            }
          }
          if (detected[fieldType]) break;
        }
      }
    }

    this.resolvedMappings.set(cacheKey, detected);
    return detected;
  }

  /**
   * Normalizar uma linha usando mapeamentos detectados
   * @param {Object} row - Linha original
   * @param {Object} columns - Mapeamento de colunas
   * @returns {Object} Linha normalizada
   */
  normalizeRow(row, columns) {
    const normalized = {};

    for (const [fieldType, columnName] of Object.entries(columns)) {
      if (columnName && row[columnName] !== undefined) {
        // Manter valor EXATAMENTE como recebido - sem transformação
        normalized[fieldType] = String(row[columnName]).trim() || null;
      }
    }

    // Manter também valores originais para referência
    normalized._original = { ...row };

    return normalized;
  }

  /**
   * Validar se linha tem campos mínimos obrigatórios
   * @param {Object} row - Linha normalizada
   * @returns {Object} Resultado da validação
   */
  validateRequiredFields(row) {
    const errors = [];

    if (!row.studentName) {
      errors.push('Nome do aluno é obrigatório');
    }

    if (!row.processNumber) {
      errors.push('Número de processo é obrigatório');
    }

    // Turma é OBRIGATÓRIA - tratada como string pura
    if (!row.className) {
      errors.push('Turma é obrigatória');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Limpar cache de mapeamentos
   */
  clearCache() {
    this.resolvedMappings.clear();
  }
}

export const excelCompatibilityEngine = new ExcelCompatibilityEngine();
export default excelCompatibilityEngine;
