import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';
import { generateQrCode } from '../utils/generateQr.utils.js';
import Merchant from '../models/merchant.model.js';
import School from '../models/school.model.js';

export const createPaymentQR = async (req, res) => {
  try {
    const { entityId, type, amount } = req.body;

    if (!entityId || !type || !amount)
      return res.status(400).json(ErrorResponse.badRequest('Dados insuficientes'));

    const entity =
      type == 'merchant' ? await Merchant.findById(entityId) : await School.findById(entityId);

    if (!entity) return res.status(404).json(ErrorResponse.notFound(type));

    //gera o qr
    const { reference, qrCodeDataURL, payload } = await generateQrCode({
      entityId,
      type,
      amount,
    });

    // Apply DTO transformation
    const dto = {
      reference,
      qrCode: qrCodeDataURL,
      payload,
      amount,
      type,
      entityId,
    };

    return res.status(200).json(ApiResponse.success(dto, 'QR Code gerado com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};
