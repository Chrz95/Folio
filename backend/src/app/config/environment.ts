import 'dotenv/config';
import { resolve, isAbsolute } from 'node:path';
import { z } from 'zod';
import { LIMIT } from '../../constants/http.constants.js';
const databaseSchema = z.object({
  DATABASE_FILE_PATH: z
    .string()
    .min(1)
    .refine((value) => value !== ':memory:' && !value.includes('://')),
  DATABASE_BUSY_TIMEOUT_IN_MILLISECONDS: z.coerce.number().int().min(0).max(LIMIT.maxBusy).default(LIMIT.busy),
  TEST_DATABASE_DIRECTORY: z.string().default('./.test-data'),
});
/** Parse database settings independently for command-line tools.
 * @param {NodeJS.ProcessEnv} input - Environment values.
 * @returns {object} Validated paths and lock timeout. */
export function parseDatabaseEnvironment(input: NodeJS.ProcessEnv = process.env) {
  const parsed = databaseSchema.parse(input);
  if (input.NODE_ENV === 'production' && !isAbsolute(parsed.DATABASE_FILE_PATH)) {
    throw new Error('Production storage requires an absolute local path.');
  }
  return {
    mode: z.enum(['development', 'test', 'production']).default('development').parse(input.NODE_ENV),
    filePath: resolve(parsed.DATABASE_FILE_PATH),
    busyTimeout: parsed.DATABASE_BUSY_TIMEOUT_IN_MILLISECONDS,
    testDirectory: resolve(parsed.TEST_DATABASE_DIRECTORY),
  };
}
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(LIMIT.minPort).max(LIMIT.maxPort).default(LIMIT.port),
  HOST: z.string().default('127.0.0.1'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  API_PREFIX: z
    .string()
    .regex(/^\/api\/v[1-9]\d*$/)
    .default('/api/v1'),
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z
    .string()
    .regex(/^(mailto:|https:\/\/)/)
    .default('mailto:operator@example.com'),
});
/** Validate HTTP configuration once at process bootstrap.
 * @returns {object} Typed HTTP and push configuration. */
export function loadEnvironment() {
  const parsed = serverSchema.parse(process.env);
  if (Boolean(parsed.VAPID_PUBLIC_KEY) !== Boolean(parsed.VAPID_PRIVATE_KEY)) {
    throw new Error('Configure both VAPID keys or neither.');
  }
  return {
    mode: parsed.NODE_ENV,
    port: parsed.PORT,
    host: parsed.HOST,
    origins: parsed.CORS_ALLOWED_ORIGINS.split(',').map((origin) => z.url().parse(origin.trim())),
    logLevel: parsed.LOG_LEVEL,
    apiPrefix: parsed.API_PREFIX,
    database: parseDatabaseEnvironment(),
    push: { publicKey: parsed.VAPID_PUBLIC_KEY, privateKey: parsed.VAPID_PRIVATE_KEY, subject: parsed.VAPID_SUBJECT },
  };
}
