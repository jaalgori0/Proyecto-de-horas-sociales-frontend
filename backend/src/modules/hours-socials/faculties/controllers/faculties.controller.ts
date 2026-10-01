import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../../../utils/httpError.js';
import { facultiesService } from '../services/faculties.service.js';

class FacultiesController {
  public listFaculties = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await facultiesService.listFacultiesWithCareers());
    } catch (error) {
      next(error);
    }
  };

  public getFacultyById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const faculty = await facultiesService.getById(String(req.params.id));
      if (!faculty) throw new HttpError(404, 'Faculty not found');
      res.json(faculty);
    } catch (error) {
      next(error);
    }
  };

  public createFaculty = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { nombre } = req.body as { nombre?: string };
      if (!nombre || !nombre.trim()) {
        throw new HttpError(400, 'El nombre de la facultad es obligatorio');
      }
      const newFaculty = await facultiesService.create({ nombre });
      res.status(201).json(newFaculty);
    } catch (error) {
      next(error);
    }
  };

  public updateFaculty = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { nombre } = req.body as { nombre?: string };
      const updated = await facultiesService.update(String(req.params.id), { nombre });
      if (!updated) throw new HttpError(404, 'Faculty not found');
      res.json(updated);
    } catch (error) {
      next(error);
    }
  };

  public deleteFaculty = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deleted = await facultiesService.delete(String(req.params.id));
      if (!deleted) throw new HttpError(404, 'Faculty not found');
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

const facultiesController = new FacultiesController();

export const listFacultiesController = facultiesController.listFaculties;
export const getFacultyByIdController = facultiesController.getFacultyById;
export const createFacultyController = facultiesController.createFaculty;
export const updateFacultyController = facultiesController.updateFaculty;
export const deleteFacultyController = facultiesController.deleteFaculty;

export default FacultiesController;