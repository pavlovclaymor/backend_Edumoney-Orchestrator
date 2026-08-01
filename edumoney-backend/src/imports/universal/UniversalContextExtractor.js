/**
 * Universal Context Extractor
 *
 * Extrai contexto de qualquer formato de Excel escolar.
 * Prioridade:
 * 1. Coluna explícita (turma, ano)
 * 2. Nome da sheet
 * 3. Headers
 * 4. Primeiras linhas
 * 5. Fallback
 *
 * Regra: "Se existir em qualquer forma, extrair. Se não existir, null."
 */
import XLSX from 'xlsx';

export class UniversalContextExtractor {
  constructor() {
    // Mapeamento universal de headers (fuzzy)
    this.headerMappings = {
      name: [
        'name',
        'Name',
        'Nome',
        'nome',
        'Nome do Aluno',
        'nome do aluno',
        'Aluno',
        'aluno',
        'Estudante',
        'estudante',
        'Discente',
        'discente',
        'student',
        'Student',
        'student_name',
        'studentName',
        'full_name',
        'fullName',
        'nome_completo',
        'Nombre',
        'NOMBRE',
      ],
      processNumber: [
        'processNumber',
        'process_number',
        'Process Number',
        'Numero de Processo',
        'numero de processo',
        'Processo',
        'processo',
        'Nº Processo',
        'N° Processo',
        'N_Processo',
        'matricula',
        'Matricula',
        'Matrícula',
        'matrícula',
        'student_id',
        'studentId',
        'STUDENT_ID',
        'id',
        'ID',
        'Id',
        'numero',
        'Número',
        'numero',
        'Nº',
        'reg_number',
        'regnumber',
      ],
      className: [
        'turma',
        'Turma',
        'classe',
        'Classe',
        'class',
        'Class',
        'CLASS',
        'sala',
        'Sala',
        'grupo',
        'Grupo',
        'group',
        'Group',
        'secção',
        'seccao',
        'Secção',
        'Secao',
        'turma_name',
        'Turma Name',
        'class_name',
        'className',
        'class_name',
      ],
      academicYear: [
        'ano',
        'Ano',
        'ano_letivo',
        'ano_letivo',
        'Ano Letivo',
        'Ano Lectivo',
        'anoLectivo',
        'anoLetivo',
        'year',
        'Year',
        'academic_year',
        'Academic Year',
        'ANO',
        'YEAR',
      ],
      phone: [
        'telefone',
        'Telefone',
        'phone',
        'Phone',
        'telemovel',
        'Telemovel',
        'telemóvel',
        'mobile',
        'celular',
        'Celular',
        'contacto',
        'Contato',
      ],
      email: ['email', 'Email', 'e-mail', 'E-mail', 'mail', 'Mail', 'EMAIL'],
      bi: [
        'bi',
        'BI',
        'nbi',
        'NBI',
        'documento',
        'Documento',
        'bilhete',
        'Bilhete',
        'passaporte',
        'Passaporte',
      ],
    };

    // Padrões para detectar turma no nome da sheet
    this.classNamePatterns = [
      /([A-Z]{2,4}\d{2}[A-Z])/i, // II12A, MT10B, INF11A
      /(\d{1,2}[ªº]?\s*[Cc]lasse\s*[A-Z]?)/i, // 12ª Classe A, 10 Classe
      /([Cc]lasse\s*[A-Z]\d?)/i, // Classe A, Classe 12A
      /([Tt]urma\s*[A-Z]\d?)/i, // Turma A, Turma 12A
      /([A-Z]\d{2}[A-Z]?)/i, // A12A, B10C
    ];

    // Padrões para detectar ano no nome da sheet
    this.yearPatterns = [
      /(\d{4})/, // 2026, 2025
      /\((\d{4})\)/, // (2026)
      /_(\d{4})_/, // _2026_
    ];

    // Fallbacks
    this.fallbackClassName = 'UNKNOWN_CLASS';
    this.fallbackYear = new Date().getFullYear();
  }

  /**
   * Extrair contexto universal de um arquivo Excel
   * @param {Buffer} buffer - Buffer do Excel
   * @returns {Object} Contexto extraído
   */
  extract(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { success: false, error: 'Arquivo sem sheets' };
    }

    // Analisar todas as sheets
    const sheets = workbook.SheetNames.map((sheetName) =>
      this.analyzeSheet(workbook.Sheets[sheetName], sheetName),
    );

    return {
      success: true,
      sheets,
      totalRows: sheets.reduce((sum, s) => sum + s.data.length, 0),
    };
  }

  /**
   * Analisar uma sheet
   */
  analyzeSheet(sheet, sheetName) {
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (jsonData.length === 0) {
      return { success: false, sheetName, data: [] };
    }

    // Extrair contexto da sheet
    const context = this.extractSheetContext(jsonData, sheetName);

    // Normalizar dados
    const normalizedData = jsonData.map((row) => this.normalizeRow(row, context));

    return {
      success: true,
      sheetName,
      context,
      data: normalizedData,
    };
  }

  /**
   * Extrair contexto da sheet
   */
  extractSheetContext(rows, sheetName) {
    const firstRow = rows[0] || {};
    const headers = Object.keys(firstRow);

    return {
      className: this.extractClassName(headers, sheetName, rows),
      academicYear: this.extractAcademicYear(headers, sheetName),
      detectedHeaders: this.detectHeaders(headers),
      sourceSheet: sheetName,
    };
  }

  /**
   * Extrair nome da turma de qualquer fonte
   */
  extractClassName(headers, sheetName, rows) {
    // 1. Procurar em headers
    for (const header of headers) {
      const normalized = this.normalizeHeader(header);
      if (this.matchesHeader(normalized, 'className')) {
        // Encontrou coluna de turma, retornar valor da primeira linha
        const value = rows[0]?.[header];
        if (value) {
          return String(value).trim();
        }
      }
    }

    // 2. Procurar no nome da sheet
    const sheetClass = this.extractFromSheetName(sheetName);
    if (sheetClass) {
      return sheetClass;
    }

    // 3. Procurar na primeira linha (caso headers estejam na segunda)
    const firstRow = rows[0] || {};
    for (const value of Object.values(firstRow)) {
      const strValue = String(value || '').trim();
      if (strValue && this.looksLikeClassName(strValue)) {
        return strValue;
      }
    }

    // 4. Fallback
    return this.fallbackClassName;
  }

  /**
   * Extrair turma do nome da sheet
   */
  extractFromSheetName(sheetName) {
    for (const pattern of this.classNamePatterns) {
      const match = sheetName.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    return null;
  }

  /**
   * Verificar se string parece nome de turma
   */
  looksLikeClassName(str) {
    // Curtas, com letras e números
    if (str.length < 2 || str.length > 20) return false;
    if (!/[A-Za-z]/.test(str) || !/\d/.test(str)) return false;
    if (str.includes(' ') && str.length > 15) return false;
    return true;
  }

  /**
   * Extrair ano letivo de qualquer fonte
   */
  extractAcademicYear(headers, sheetName) {
    // 1. Procurar em headers
    for (const header of headers) {
      const normalized = this.normalizeHeader(header);
      if (this.matchesHeader(normalized, 'academicYear')) {
        const value = Object.values(headers)[0]; // Primeira linha
        if (value && /\d{4}/.test(String(value))) {
          const yearMatch = String(value).match(/\d{4}/);
          if (yearMatch) return yearMatch[1];
        }
      }
    }

    // 2. Procurar no nome da sheet
    for (const pattern of this.yearPatterns) {
      const match = sheetName.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // 3. Fallback
    return this.fallbackYear;
  }

  /**
   * Detectar headers universais
   */
  detectHeaders(headers) {
    const detected = {};

    for (const header of headers) {
      const normalized = this.normalizeHeader(header);

      for (const [fieldType, patterns] of Object.entries(this.headerMappings)) {
        if (patterns.some((p) => this.fuzzyMatch(normalized, p.toLowerCase()))) {
          detected[normalized] = fieldType;
          break;
        }
      }
    }

    return detected;
  }

  /**
   * Normalizar header
   */
  normalizeHeader(header) {
    if (!header) return '';
    return String(header)
      .toLowerCase()
      .replace(/[_\-\s\.\,\;]+/g, '')
      .trim();
  }

  /**
   * Match fuzzy
   */
  fuzzyMatch(str1, str2) {
    if (str1 === str2) return true;
    if (str1.includes(str2) || str2.includes(str1)) return true;
    if (this.levenshtein(str1, str2) <= 2) return true;
    return false;
  }

  /**
   * Levenshtein distance
   */
  levenshtein(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Verificar se header corresponde a tipo
   */
  matchesHeader(header, fieldType) {
    const patterns = this.headerMappings[fieldType] || [];
    const normalized = header.toLowerCase();
    return patterns.some((p) => this.fuzzyMatch(normalized, p.toLowerCase()));
  }

  /**
   * Normalizar uma linha
   */
  normalizeRow(row, context) {
    const normalized = {};
    const rawRow = { ...row };

    // Para cada campo esperado
    const fields = ['name', 'processNumber', 'className', 'academicYear', 'phone', 'email', 'bi'];

    for (const field of fields) {
      let value = null;

      // Procurar em headers
      for (const [header, headerType] of Object.entries(context.detectedHeaders || {})) {
        if (headerType === field) {
          // Header encontrado na sheet
          const originalHeader = Object.keys(row).find((h) => this.normalizeHeader(h) === header);
          if (originalHeader && row[originalHeader]) {
            value = String(row[originalHeader]).trim();
          }
        }
      }

      // Fallback para className e academicYear (vem do contexto)
      if (field === 'className' && !value) {
        value = context.className;
      }
      if (field === 'academicYear' && !value) {
        value = context.academicYear;
      }

      normalized[field] = value || null;
    }

    // Metadados
    normalized._context = {
      sourceSheet: context.sourceSheet,
      detectedHeaders: Object.keys(context.detectedHeaders || {}),
    };
    normalized._original = rawRow;

    return normalized;
  }
}

export const universalContextExtractor = new UniversalContextExtractor();
export default universalContextExtractor;
