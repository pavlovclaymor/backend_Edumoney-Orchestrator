import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';
import ServicePrice from '../models/servicePrice.model.js';

/**
 * GET /service-prices/:schoolId
 * Retorna todos os serviços configurados de uma escola
 * Cria serviços padrão se não existirem
 */
export const getServicePricesBySchool = async (req, res) => {
  const { schoolId } = req.params;
  const actorId = req.user?._id?.toString();
  const actorModel = req.userModel;

  if (actorModel === 'School' && actorId !== schoolId) {
    return res.status(403).json({ message: 'Acesso negado' });
  }

  try {
    let services = await ServicePrice.find({ schoolId });

    // Se não houver serviços, cria padrão
    if (services.length === 0) {
      const defaultServices = [
        { tipoServico: 'CERTIFICADO', valor: 5000, quantidade: 1, active: true },
        { tipoServico: 'DECLARACAO_COM_NOTA', valor: 1500, quantidade: 1, active: true },
        { tipoServico: 'DECLARACAO_SEM_NOTA', valor: 1000, quantidade: 1, active: true },
        { tipoServico: 'FOLHA_PROVA', valor: 500, quantidade: 10, active: true },
      ];

      // Cria todos para a escola
      services = await ServicePrice.insertMany(defaultServices.map((s) => ({ ...s, schoolId })));
    }

    res.status(200).json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao buscar ou criar serviços' });
  }
};

/**
 * PUT /service-prices/:id
 * Atualiza valor, quantidade e ativo de um serviço
 */
export const updateServicePrice = async (req, res) => {
  const { id } = req.params;
  const { valor, quantidade, active } = req.body;

  try {
    const service = await ServicePrice.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    if (req.user?._id?.toString() !== service.schoolId.toString()) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    if (valor !== undefined) service.valor = valor;
    if (quantidade !== undefined) service.quantidade = quantidade;
    if (active !== undefined) service.active = active;

    await service.save();

    res.status(200).json(service);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao atualizar serviço' });
  }
};
