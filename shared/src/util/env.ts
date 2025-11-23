import { config } from 'dotenv';
import * as process from 'process';

config(); // load root .env

export const ENV = {
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: Number(process.env.DB_PORT) || 3306,
  DB_USER: process.env.DB_USER || 'root',
  DB_PASS: process.env.DB_PASS || 'password',
  DB_NAME: process.env.DB_NAME || 'hirehub',

  API_GATEWAY_PORT: Number(process.env.API_GATEWAY_PORT) || 3000,
  AUTH_SERVICE_PORT: Number(process.env.AUTH_SERVICE_PORT) || 3001,

  API_GATEWAY_HOST: process.env.API_GATEWAY_HOST || 'localhost',
  AUTH_SERVICE_HOST: process.env.AUTH_SERVICE_HOST || 'localhost',
};
