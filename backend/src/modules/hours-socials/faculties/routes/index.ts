import { Router } from 'express';
import FacultiesController from '../controllers/faculties.controller.js';

const router: Router = Router();
const controller = new FacultiesController();

/**
 * @swagger
 * tags:
 *   - name: Faculties
 *     description: Facultades y carreras asociadas
 */

/**
 * @swagger
 * /api/faculties:
 *   get:
 *     summary: Lista las facultades con sus carreras
 *     tags: [Faculties]
 *     responses:
 *       200:
 *         description: Lista de facultades obtenida exitosamente
 */
router.get('/', controller.listFaculties);

export default router;