import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';
import { SchoolDTO } from '../utils/dto/index.js';
import SchoolRegistry from '../models/schoolRegistry.model.js';

export const getByNif = async (req, res) => {
  try {
    const { nif } = req.params;
    const school = await SchoolRegistry.findOne({ nif: Number(nif) });

    if (!school) {
      return res.status(404).json(ErrorResponse.notFound('Registro institucional da escola'));
    }

    const dto = SchoolDTO.forRegistry(school);
    return res.status(200).json(ApiResponse.success(dto, 'Registro escolar encontrado'));
  } catch (error) {
    return res.status(500).json(ErrorResponse.internal(error.message));
  }
};

export const searchSchools = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(200).json(ApiResponse.ok([]));

    const schools = await SchoolRegistry.find({
      name: { $regex: q, $options: 'i' },
    }).limit(10);

    const dto = SchoolDTO.fromArray(schools);
    return res.status(200).json(ApiResponse.ok(dto));
  } catch (error) {
    return res.status(500).json(ErrorResponse.internal(error.message));
  }
};
