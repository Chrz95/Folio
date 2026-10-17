import { defineConfig } from 'drizzle-kit';
import { parseDatabaseEnvironment } from './src/app/config/environment.js';
export default defineConfig({
  dialect: 'sqlite',
  schema: './backend/src/db/schema/*.ts',
  out: './backend/src/db/migrations',
  dbCredentials: { url: parseDatabaseEnvironment().filePath },
});
