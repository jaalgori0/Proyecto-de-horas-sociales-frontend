import { Sequelize } from 'sequelize';
import { env } from './env.js';

const isProduction = env.nodeEnv === 'production';
const isLocal = env.databaseUrl.includes('localhost') || env.databaseUrl.includes('127.0.0.1') || env.databaseUrl.includes('@db');

const needsSsl = isProduction && !isLocal;

const sequelize = new Sequelize(env.databaseUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: needsSsl
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : {},
});

await sequelize.sync({ alter: true }); 
console.log('¡Tablas sincronizadas con éxito!');

export default sequelize;