/**
 * PDF Worker
 * Gera PDFs de invoices de forma assíncrona.
 * Escuta eventos e processa geração de PDFs.
 */

import { eventBus, EVENTS } from '../core/events/EventBus.js';

class PDFWorker {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.initialize();
  }

  initialize() {
    // Registrar listener para invoice paga
    eventBus.on(EVENTS.INVOICE_PAID, async (data) => {
      await this.handleInvoicePaid(data);
    });

    console.log('✅ PDFWorker initialized');
  }

  async handleInvoicePaid(data) {
    const { invoiceId, amount } = data;

    console.log(`📄 PDFWorker: Processing invoice ${invoiceId}`);

    try {
      // Importar Invoice model e pdf service dinamicamente
      const Invoice = (await import('../models/invoice.model.js')).default;
      const { generateInvoicePDF } = await import('./pdf.service.js');

      const invoice = await Invoice.findById(invoiceId);

      if (!invoice) {
        console.error(`❌ PDFWorker: Invoice ${invoiceId} not found`);
        return;
      }

      // Gerar PDF
      const pdfUrl = await generateInvoicePDF(invoice);

      // Atualizar invoice com URL do PDF
      invoice.pdfUrl = pdfUrl;
      await invoice.save();

      // Emitir evento de PDF pronto
      eventBus.emit(EVENTS.INVOICE_PDF_READY, {
        invoiceId,
        pdfUrl,
      });

      console.log(`✅ PDFWorker: PDF generated for invoice ${invoiceId}`);
    } catch (error) {
      console.error(`❌ PDFWorker: Failed to generate PDF - ${error.message}`);
    }
  }

  async addToQueue(invoiceId) {
    this.queue.push({ invoiceId, addedAt: Date.now() });
    this.processQueue();
  }

  async processQueue() {
    if (this.isProcessing) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      try {
        await this.handleInvoicePaid({ invoiceId: job.invoiceId });
      } catch (error) {
        console.error('PDF queue error:', error);
      }
    }

    this.isProcessing = false;
  }
}

// Singleton
export const pdfWorker = new PDFWorker();
export default pdfWorker;
