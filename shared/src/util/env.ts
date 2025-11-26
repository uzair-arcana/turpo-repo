import { config } from "dotenv";
import * as process from "process";
import * as path from "path";
import * as fs from "fs";

// Find project root by looking for turbo.json or package.json with workspaces
// This works from any execution context (monorepo, bundled, etc.)
function findProjectRoot(): string {
  let currentDir = process.cwd();

  // Navigate up the directory tree to find project root
  // Look for turbo.json (monorepo marker) or package.json with workspaces
  for (let i = 0; i < 10; i++) {
    const turboJsonPath = path.join(currentDir, 'turbo.json');
    const packageJsonPath = path.join(currentDir, 'package.json');
    const envPath = path.join(currentDir, '.env');

    // Check for turbo.json (strong indicator of monorepo root)
    if (fs.existsSync(turboJsonPath)) {
      return currentDir;
    }

    // Check for package.json with workspaces field
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (pkg.workspaces) {
          return currentDir;
        }
      } catch {
        // If we can't read package.json, continue
      }
    }

    // If we find .env file, assume this is the root
    if (fs.existsSync(envPath)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }
    currentDir = parentDir;
  }

  // Fallback to process.cwd()
  return process.cwd();
}

// Load .env file from project root
const projectRoot = findProjectRoot();
const envPath = path.join(projectRoot, '.env');
const result = config({ path: envPath });

// Log result for debugging
if (result.error) {
  if (!fs.existsSync(envPath)) {
    console.warn(`⚠️  .env file not found at ${envPath}`);
    console.warn(`   Using environment variables from system or defaults.`);
    console.warn(`   Project root detected: ${projectRoot}`);
  } else {
    console.warn(`⚠️  Error loading .env file from ${envPath}:`, result.error.message);
  }
} else if (result.parsed) {
  const loadedVars = Object.keys(result.parsed).length;
  console.log(`✓ Loaded .env file from ${envPath} (${loadedVars} variables)`);
}

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


  // AWS SES Configuration
  AWS_REGION: process.env.AWS_REGION || "us-east-1",
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "",
  AWS_SES_FROM_EMAIL: process.env.AWS_SES_FROM_EMAIL || "noreply@example.com",
  AWS_SES_FROM_NAME: process.env.AWS_SES_FROM_NAME || "Turpo",

  // Frontend URLs
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
};
