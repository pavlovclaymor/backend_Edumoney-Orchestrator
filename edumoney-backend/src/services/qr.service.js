import QRCode from 'qrcode';

export const generateInvoiceQRCode = async (invoice) => {
  const qrData = JSON.stringify({
    invoiceNumber: invoice.invoiceNumber,
    total: invoice.totalAmount,
    issuedAt: invoice.issuedAt,
  });

  return await QRCode.toDataURL(qrData);
};
