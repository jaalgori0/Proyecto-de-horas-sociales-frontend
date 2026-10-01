import Career from '../../../../models/career.model.js';
import Faculty from '../../../../models/faculty.model.js';

class CareersService {
  public listCareers = async () => {
    return await Career.findAll({
      include: [{ model: Faculty, as: 'faculty', attributes: ['id', 'nombre'] }],
      order: [['nombre', 'ASC']],
    });
  };

  public getCareerById = async (id: string) => {
    return await Career.findByPk(id, {
      include: [{ model: Faculty, as: 'faculty', attributes: ['id', 'nombre'] }],
    });
  };

  public create = async (body: { nombre: string; faculty_id: number }) => {
    // Validar que la facultad exista antes de crear la carrera
    const faculty = await Faculty.findByPk(body.faculty_id);
    if (!faculty) return null;

    return await Career.create({
      nombre: body.nombre.trim(),
      faculty_id: body.faculty_id,
    });
  };

  public update = async (id: string, body: { nombre?: string; faculty_id?: number }) => {
    const career = await Career.findByPk(id);
    if (!career) return null;

    const updatePayload: { nombre?: string; faculty_id?: number } = {};
    if (typeof body.nombre === 'string' && body.nombre.trim()) {
      updatePayload.nombre = body.nombre.trim();
    }
    if (typeof body.faculty_id === 'number') {
      const faculty = await Faculty.findByPk(body.faculty_id);
      if (!faculty) throw new Error('Faculty not found');
      updatePayload.faculty_id = body.faculty_id;
    }

    await career.update(updatePayload);
    return this.getCareerById(id);
  };

  public delete = async (id: string) => {
    const career = await Career.findByPk(id);
    if (!career) return false;

    await career.destroy();
    return true;
  };
}

export const careersService = new CareersService();
export default CareersService;