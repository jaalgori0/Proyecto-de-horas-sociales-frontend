import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../../../utils/httpError.js';
import { careersService } from '../services/careers.service.js';

class CareersController {
  public listCareers = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await careersService.listCareers());
    } catch (error) {
      next(error);
    }
  };

  public getCareerById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const career = await careersService.getCareerById(String(req.params.id));
      if (!career) throw new HttpError(404, 'Career not found');
      res.json(career);
    } catch (error) {
      next(error);
    }
  };

  public createCareer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { nombre, faculty_id } = req.body as { nombre?: string; faculty_id?: number };
      if (!nombre || !nombre.trim() || !faculty_id) {
        throw new HttpError(400, 'El nombre y el faculty_id son obligatorios');
      }
      const newCareer = await careersService.create({ nombre, faculty_id });
      if (!newCareer) throw new HttpError(404, 'La facultad especificada no existe');
      res.status(201).json(newCareer);
    } catch (error) {
      next(error);
    }
  };

  public updateCareer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { nombre, faculty_id } = req.body as { nombre?: string; faculty_id?: number };
      const updated = await careersService.update(String(req.params.id), { nombre, faculty_id });
      if (!updated) throw new HttpError(404, 'Career not found');
      res.json(updated);
    } catch (error) {
      next(error);
    }
  };

  public deleteCareer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deleted = await careersService.delete(String(req.params.id));
      if (!deleted) throw new HttpError(404, 'Career not found');
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

const careersController = new CareersController();

export const listCareersController = careersController.listCareers;
export const getCareerByIdController = careersController.getCareerById;
export const createCareerController = careersController.createCareer;
export const updateCareerController = careersController.updateCareer;
export const deleteCareerController = careersController.deleteCareer;

export default CareersController;