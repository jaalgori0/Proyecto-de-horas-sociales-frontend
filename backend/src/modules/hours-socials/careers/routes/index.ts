import { Router } from 'express';
import CareersController from '../controllers/careers.controller.js';

const router: Router = Router();
const controller = new CareersController();

/**
 * @swagger
 * tags:
 *   - name: Careers
 *     description: Catálogo de carreras universitarias
 */

/**
 * @swagger
 * /api/careers:
 *   get:
 *     summary: Lista todas las carreras con su facultad correspondiente
 *     tags: [Careers]
 *     responses:
 *       200:
 *         description: Lista de carreras obtenida con éxito
 */
router.get('/', controller.listCareers);

/**
 * @swagger
 * /api/careers/{id}:
 *   get:
 *     summary: Obtiene una carrera por su ID
 *     tags: [Careers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Carrera encontrada
 *       404:
 *         description: Carrera no encontrada
 */
router.get('/:id', controller.getCareerById);

export default router;