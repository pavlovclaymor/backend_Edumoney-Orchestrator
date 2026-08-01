import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

/**
 * Gera um QR Code único com base no entityId, type e amount.
 * @param {{ entityId: string, type?: string, amount: number }} referenceId
 * @returns {Promise<{ reference: string, qrCodeDataURL: string, payload: object }>}
 */
export const generateQrCode = async (referenceId) => {
  try {
    const reference = uuidv4();

    const payload = {
      reference,
      type: referenceId.type || 'merchant',
      entityId: referenceId.entityId,
      amount: referenceId.amount,
      state: referenceId.state || '',
    };

    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(payload));

    return {
      reference,
      qrCodeDataURL,
      payload,
    };
  } catch (error) {
    throw new Error('Erro ao gerar o QR Code: ' + error.message);
  }
};

/**
 * Valida e faz parse de dados recebidos via QR Code.
 * @param {string} qrData - JSON string recebida do QR
 * @returns {object} Objecto parseado com reference, entityId, type e amount
 */
export const validateQrCodeData = (qrData) => {
  try {
    return JSON.parse(qrData);
  } catch (error) {
    throw new Error('Dados de QR Code inválidos: ' + error.message);
  }
};
