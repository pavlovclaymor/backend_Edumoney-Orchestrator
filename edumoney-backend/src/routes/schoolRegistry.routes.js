import { Router } from 'express';
import { getByNif, searchSchools } from '../controllers/schoolRegistry.controller.js';

const router = Router();

router.get('/schools/:nif', getByNif);
router.get('/schools/search', searchSchools);

export default router;
