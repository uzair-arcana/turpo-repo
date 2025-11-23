import { config } from "dotenv";
import * as process from "process";

config(); // load root .env

export const ENV = {
  // Postgres / DB
  DB_HOST: process.env.DB_HOST || "localhost",
  DB_PORT: Number(process.env.DB_PORT) || 5432, // change to your default Postgres port
  DB_USER: process.env.DB_USER || "postgres",
  DB_PASS: process.env.DB_PASS || "password",
  DB_NAME: process.env.DB_NAME || "mydb",

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined, // if you have a password

  // Services Ports
  API_GATEWAY_PORT: Number(process.env.API_GATEWAY_PORT) || 3000,
  AUTH_SERVICE_PORT: Number(process.env.AUTH_SERVICE_PORT) || 3001,
  EMAIL_SERVICE_PORT: Number(process.env.EMAIL_SERVICE_PORT) || 3002,

  // Services Hosts
  API_GATEWAY_HOST: process.env.API_GATEWAY_HOST || "localhost",
  AUTH_SERVICE_HOST: process.env.AUTH_SERVICE_HOST || "localhost",
  EMAIL_SERVICE_HOST: process.env.EMAIL_SERVICE_HOST || "localhost",

  // JWT Configuration
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "your-access-secret-key",
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key",
  JWT_REFRESH_TTL_SECONDS:
    Number(process.env.JWT_REFRESH_TTL_SECONDS) || 60 * 60 * 24 * 7, // 7 days
};
