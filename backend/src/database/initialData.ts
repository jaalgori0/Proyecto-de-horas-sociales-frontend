// src/database/initialData.ts
import Faculty from '../models/faculty.model.js';
import Career from '../models/career.model.js';

export const seedInitialFacultiesAndCareers = async () => {
  try {
    const count = await Faculty.count();
    if (count > 0) {
      console.log('Las facultades y carreras ya están inicializadas. Omitiendo seeder.');
      return;
    }

    console.log('Insertando las facultades y carreras iniciales...');

    // 1. Facultad de Ingeniería y Arquitectura
    const facultadIng = await Faculty.create({ nombre: 'Ingeniería y Arquitectura' });
    await Career.bulkCreate([
      { nombre: 'Arquitectura', faculty_id: facultadIng.id },
      { nombre: 'Ingeniería Civil', faculty_id: facultadIng.id },
      { nombre: 'Ingeniería de Alimentos', faculty_id: facultadIng.id },
      { nombre: 'Ingeniería Eléctrica', faculty_id: facultadIng.id },
      { nombre: 'Ingeniería Energética', faculty_id: facultadIng.id },
      { nombre: 'Ingeniería Industrial', faculty_id: facultadIng.id },
      { nombre: 'Ingeniería Informática', faculty_id: facultadIng.id },
      { nombre: 'Ingeniería Mecánica', faculty_id: facultadIng.id },
      { nombre: 'Ingeniería Química', faculty_id: facultadIng.id },
      { nombre: 'Licenciatura en Diseño', faculty_id: facultadIng.id },
      { nombre: 'Técnico en Desarrollo de Software', faculty_id: facultadIng.id },
    ]);

    // 2. Facultad de Ciencias Sociales y Humanidades
    const facultadSociales = await Faculty.create({ nombre: 'Ciencias Sociales y Humanidades' });
    await Career.bulkCreate([
      { nombre: 'Licenciatura en Ciencias Jurídicas', faculty_id: facultadSociales.id },
      { nombre: 'Licenciatura en Ciencias Sociales', faculty_id: facultadSociales.id },
      { nombre: 'Licenciatura en Comunicación Social', faculty_id: facultadSociales.id },
      { nombre: 'Licenciatura en Filosofía', faculty_id: facultadSociales.id },
      { nombre: 'Licenciatura en Idioma Inglés', faculty_id: facultadSociales.id },
      { nombre: 'Licenciatura en Mercadeo', faculty_id: facultadSociales.id },
      { nombre: 'Licenciatura en Psicología', faculty_id: facultadSociales.id },
      { nombre: 'Licenciatura en Teología', faculty_id: facultadSociales.id },
      { nombre: 'Técnico en Marketing Digital', faculty_id: facultadSociales.id },
      { nombre: 'Técnico en Producción Multimedia', faculty_id: facultadSociales.id },
    ]);

    // 3. Facultad de Ciencias Económicas y Empresariales
    const facultadEconómicas = await Faculty.create({ nombre: 'Ciencias Económicas y Empresariales' });
    await Career.bulkCreate([
      { nombre: 'Administración de Empresas', faculty_id: facultadEconómicas.id },
      { nombre: 'Contaduría Pública', faculty_id: facultadEconómicas.id },
      { nombre: 'Economía', faculty_id: facultadEconómicas.id },
      { nombre: 'Finanzas', faculty_id: facultadEconómicas.id },
    ]);

    console.log('✅ ¡Las facultades y sus carreras fueron insertadas con éxito!');
  } catch (error) {
    console.error('❌ Error al insertar las facultades y carreras iniciales:', error);
  }
};