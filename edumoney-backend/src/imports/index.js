/**
 * Imports Module Index (Universal)
 * Exports centralizados do sistema de importação.
 *
 * Regras:
 * - Excel Compatibility Engine: mapeamento de colunas fixas
 * - Universal Context Extractor: inferência de contexto
 * - Bulk Import Orchestrator: execução
 */

export { excelCompatibilityEngine } from './parsers/ExcelCompatibilityEngine.js';
export { universalContextExtractor } from './universal/UniversalContextExtractor.js';
export { bulkImportOrchestrator } from './core/BulkImportOrchestrator.js';
