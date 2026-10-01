import { app } from './core/server/app.js';
import { env } from './core/config/env.js';
import sequelize from './core/config/database.js';
import './models/index.js';
import { seedInitialFacultiesAndCareers } from './database/initialData.js';

const MAX_PORT_RETRIES = 10;

async function startServer(port: number, retriesLeft = MAX_PORT_RETRIES) {
  try {
    // Verificar conexión
    await sequelize.authenticate();
    console.log('Database connected');

    // 2. Sincroniza las tablas en la base de datos antes de levantar el servidor
    await sequelize.sync({ alter: true });
    console.log('¡Tablas sincronizadas con éxito!');

    await seedInitialFacultiesAndCareers();

    const server = app.listen(port, () => {
      console.log(`Horas Sociales API running on http://localhost:${port}`);
      console.log(`Swagger available at http://localhost:${port}/api-docs`);
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' && retriesLeft > 0) {
        const nextPort = port + 1;
        console.warn(`Port ${port} is already in use. Retrying on port ${nextPort}...`);
        startServer(nextPort, retriesLeft - 1);
        return;
      }

      throw error;
    });
  } catch (error) {
    console.error('Error starting server:', error);
  }
}

startServer(env.port);