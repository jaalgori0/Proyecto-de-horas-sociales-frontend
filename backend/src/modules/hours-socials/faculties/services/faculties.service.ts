import Faculty from '../../../../models/faculty.model.js';
import Career from '../../../../models/career.model.js';

class FacultiesService {
  public listFacultiesWithCareers = async () => {
    return await Faculty.findAll({
      include: [
        {
          model: Career,
          as: 'careers',
          required: false,
        },
      ],
      order: [['nombre', 'ASC']],
    });
  };

  public getById = async (id: string) => {
    return await Faculty.findByPk(id, {
      include: [{ model: Career, as: 'careers', required: false }],
    });
  };

  public create = async (body: { nombre: string }) => {
    return await Faculty.create({ nombre: body.nombre.trim() });
  };

  public update = async (id: string, body: { nombre?: string }) => {
    const faculty = await Faculty.findByPk(id);
    if (!faculty) return null;

    const updatePayload: { nombre?: string } = {};
    if (typeof body.nombre === 'string' && body.nombre.trim()) {
      updatePayload.nombre = body.nombre.trim();
    }

    await faculty.update(updatePayload);
    return this.getById(id);
  };

  public delete = async (id: string) => {
    const faculty = await Faculty.findByPk(id);
    if (!faculty) return false;

    await faculty.destroy();
    return true;
  };
}

export const facultiesService = new FacultiesService();
export default FacultiesService;