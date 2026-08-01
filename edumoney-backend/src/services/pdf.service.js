import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { generateInvoiceQRCode } from './qr.service.js';

/**
 * Gera o PDF da fatura utilizando PDFKit (Substituição do Puppeteer)
 * @param {Object} invoice - Dados da fatura
 * @returns {Promise<string>} - Caminho do arquivo gerado
 */
export const generateInvoicePDF = async (invoice) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Gera o QR Code em base64
      const qrCodeDataURL = await generateInvoiceQRCode(invoice);
      const qrImageBuffer = Buffer.from(qrCodeDataURL.split(',')[1], 'base64');

      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      const dir = path.resolve('uploads/invoice', invoice.merchantId.toString());
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const filePath = path.join(dir, `${invoice.invoiceNumber}.pdf`);
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // --- CABEÇALHO ---
      doc
        .fillColor('#1f2937')
        .fontSize(20)
        .text('EDU MONEY', 50, 50, { characterSpacing: 1 })
        .fontSize(10)
        .text('Sistema de Gestão', 50, 75)
        .moveDown();

      const infoX = 400;
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Fatura:', infoX, 50, { continued: true })
        .font('Helvetica')
        .text(` ${invoice.invoiceNumber}`, { align: 'right' })
        .font('Helvetica-Bold')
        .text('Data:', infoX, 65, { continued: true })
        .font('Helvetica')
        .text(` ${new Date(invoice.issuedAt).toLocaleDateString()}`, { align: 'right' })
        .font('Helvetica-Bold')
        .text('Status:', infoX, 80, { continued: true })
        .font('Helvetica')
        .text(` ${invoice.status.toUpperCase()}`, { align: 'right' });

      // Linha separadora
      doc.moveTo(50, 110).lineTo(550, 110).lineWidth(1).stroke('#e5e7eb');

      // --- TÍTULO E CLIENTE ---
      doc.moveDown(2);
      doc.fontSize(24).font('Helvetica-Bold').text('FATURA', 50, 130);
      doc.moveDown();

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Cliente: ', { continued: true })
        .font('Helvetica')
        .text(invoice.clientName || 'Consumidor Final')
        .font('Helvetica-Bold')
        .text('Email: ', { continued: true })
        .font('Helvetica')
        .text(invoice.clientEmail || '-');

      doc.moveDown(2);

      // --- TABELA DE ITENS ---
      const tableTop = 220;
      doc.font('Helvetica-Bold').fontSize(10);

      // Cabeçalho da Tabela
      doc.text('Produto', 50, tableTop);
      doc.text('Qtd', 250, tableTop, { width: 50, align: 'right' });
      doc.text('Preço', 310, tableTop, { width: 100, align: 'right' });
      doc.text('Subtotal', 420, tableTop, { width: 130, align: 'right' });

      doc
        .moveTo(50, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .lineWidth(1)
        .stroke('#e5e7eb');

      // Linhas da Tabela
      let currentY = tableTop + 25;
      doc.font('Helvetica');

      const formatCurrency = (value) =>
        new Intl.NumberFormat('pt-AO', {
          style: 'currency',
          currency: invoice.currency || 'AOA',
        }).format(value);

      invoice.items.forEach((item) => {
        // Verifica se precisa de nova página (simplificado)
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }

        doc.text(item.description, 50, currentY, { width: 190 });
        doc.text(item.quantity.toString(), 250, currentY, { width: 50, align: 'right' });
        doc.text(formatCurrency(item.price), 310, currentY, { width: 100, align: 'right' });
        doc.text(formatCurrency(item.subtotal), 420, currentY, { width: 130, align: 'right' });

        currentY += 20;
      });

      doc.moveTo(50, currentY).lineTo(550, currentY).lineWidth(0.5).stroke('#e5e7eb');

      // --- RESUMO ---
      currentY += 20;
      doc.font('Helvetica').text('Subtotal', 350, currentY, { width: 100, align: 'left' });
      doc.text(formatCurrency(invoice.subtotalAmount), 450, currentY, {
        width: 100,
        align: 'right',
      });

      currentY += 15;
      doc.text('Desconto', 350, currentY, { width: 100, align: 'left' });
      doc.text(formatCurrency(invoice.discountAmount), 450, currentY, {
        width: 100,
        align: 'right',
      });

      currentY += 25;
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('Total', 350, currentY, { width: 100, align: 'left' });
      doc.text(formatCurrency(invoice.totalAmount), 450, currentY, { width: 100, align: 'right' });

      // --- RODAPÉ ---
      const footerY = 730;
      doc.moveTo(50, footerY).lineTo(550, footerY).lineWidth(1).stroke('#e5e7eb');

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#6b7280')
        .text('Obrigado pela preferência.', 50, footerY + 15)
        .text('Documento gerado eletronicamente.', 50, footerY + 28);

      doc.image(qrImageBuffer, 460, footerY + 10, { width: 70 });

      doc.end();

      stream.on('finish', () => {
        resolve(filePath);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      console.error('Erro ao gerar PDF com PDFKit:', error);
      reject(error);
    }
  });
};
