import { Sequelize } from 'sequelize';
import { env } from './env.js';

const isProduction = env.nodeEnv === 'production';
const isRemoteDb   = !env.databaseUrl.includes('localhost') && !env.databaseUrl.includes('127.0.0.1');
const needsSsl     = isProduction || isRemoteDb;

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