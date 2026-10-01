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

    console.log(' Insertando las facultades y carreras iniciales...');

    // 1. Arquitectura e Ingenierías
    const facultadIng = await Faculty.create({ nombre: 'Arquitectura e Ingenierías' });
    await Career.bulkCreate([
      { nombre: 'Técnico en Desarrollo de Software (no presencial) (nueva)', faculty_id: facultadIng.id },
      { nombre: 'Arquitectura', faculty_id: facultadIng.id },
      { nombre: 'Ingeniería de Alimentos', faculty_id: facultadIng.id },
      { nombre: 'Ingeniería Civil', faculty_id: facultadIng.id },
      { nombre: 'Ingeniería Eléctrica', faculty_id: facultadIng.id },
      { nombre: 'Ingeniería Energética', faculty_id: facultadIng.id },
      { nombre: 'Ingeniería Industrial', faculty_id: facultadIng.id },
      { nombre: 'Ingeniería Informática', faculty_id: facultadIng.id },
      { nombre: 'Ingeniería Mecánica', faculty_id: facultadIng.id },
      { nombre: 'Ingeniería Química', faculty_id: facultadIng.id },
    ]);

    // 2. Ciencias Sociales y Humanidades
    const facultadSociales = await Faculty.create({ nombre: 'Ciencias Sociales y Humanidades' });
    await Career.bulkCreate([
      { nombre: 'Licenciatura en Ciencias Sociales (semipresencial)', faculty_id: facultadSociales.id },
      { nombre: 'Licenciatura en Filosofía (semipresencial)', faculty_id: facultadSociales.id },
      { nombre: 'Licenciatura en Idioma Inglés', faculty_id: facultadSociales.id },
      { nombre: 'Licenciatura en Psicología', faculty_id: facultadSociales.id },
      { nombre: 'Licenciatura en Teología', faculty_id: facultadSociales.id },
      { nombre: 'Licenciatura en Ciencias Jurídicas', faculty_id: facultadSociales.id },
    ]);

    // 3. Comunicación y Mercadeo (ajustado al texto de tu botón)
    const facultadComs = await Faculty.create({ nombre: 'Comunicación y Mercadeo' });
    await Career.bulkCreate([
      { nombre: 'Técnico en Marketing Digital (semipresencial)', faculty_id: facultadComs.id },
      { nombre: 'Técnico en Producción Multimedia (semipresencial)', faculty_id: facultadComs.id },
      { nombre: 'Licenciatura en Mercadeo', faculty_id: facultadComs.id },
      { nombre: 'Licenciatura en Comunicación Social (semipresencial)', faculty_id: facultadComs.id },
    ]);

    console.log('✅ ¡Las facultades y sus carreras fueron insertadas con éxito!');
  } catch (error) {
    console.error('❌ Error al insertar las facultades y carreras iniciales:', error);
  }
};