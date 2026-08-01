/**
 * Redis PDF Worker
 * Worker que consome eventos do Redis e gera PDFs de invoices.
 */

import { redisSubscriber } from '../core/redis/RedisSubscriber.js';
import { CHANNELS } from '../core/redis/RedisPublisher.js';
import { redisPublisher } from '../core/redis/RedisPublisher.js';
import { observability } from '../core/observability/Observability.js';

class PDFWorker {
  constructor() {
    this.processedCount = 0;
    this.queue = [];
    this.isProcessing = false;
  }

  async start() {
    console.log('🚀 Starting PDF Worker...');

    await redisSubscriber.subscribeMany({
      [CHANNELS.INVOICE_PAID]: this.handleInvoicePaid.bind(this),
    });

    console.log('✅ PDF Worker: Subscribed to PDF channels');
  }

  async handleInvoicePaid(payload) {
    const { data, eventId } = payload;
    const startTime = Date.now();

    try {
      console.log(`📄 PDFWorker: Processing invoice paid`, { eventId, invoiceId: data.invoiceId });

      // Adicionar à queue
      this.queue.push({
        invoiceId: data.invoiceId,
        amount: data.amount,
        eventId,
        addedAt: Date.now(),
      });

      // Processar queue
      await this.processQueue();

      this.processedCount++;
      observability.log('INFO', 'PDF queued for invoice', {
        eventId,
        invoiceId: data.invoiceId,
        latency: Date.now() - startTime,
      });
    } catch (error) {
      observability.log('ERROR', 'PDF worker failed', { eventId, error: error.message });
    }
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();

      try {
        await this.generatePDF(job);
      } catch (error) {
        console.error(`❌ PDFWorker: PDF generation failed for ${job.invoiceId}`, error.message);

        // Re-queue para retry
        this.queue.push({
          ...job,
          retryCount: (job.retryCount || 0) + 1,
          lastError: error.message,
        });
      }
    }

    this.isProcessing = false;
  }

  async generatePDF(job) {
    console.log(`📄 PDFWorker: Generating PDF for ${job.invoiceId}`);

    // Simular geração de PDF
    // Em produção, usar pdfkit ou similar
    await new Promise((resolve) => setTimeout(resolve, 100));

    const pdfUrl = `/invoices/${job.invoiceId}.pdf`;

    // Emitir evento de PDF pronto
    await redisPublisher.emitInvoicePDFReady({
      invoiceId: job.invoiceId,
      pdfUrl,
      generatedAt: new Date().toISOString(),
    });

    console.log(`✅ PDFWorker: PDF generated for ${job.invoiceId}`, { pdfUrl });
  }

  getStats() {
    return {
      worker: 'PDFWorker',
      processedCount: this.processedCount,
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
    };
  }
}

export const pdfWorker = new PDFWorker();
export default pdfWorker;
