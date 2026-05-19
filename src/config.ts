import "dotenv/config";

import z from "zod";

const envSchema = z.object({
  NAME: z.string().default("inferris-api"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().min(1).default("debug"),
  DATABASE_URL: z.url().default("postgres://dev:dev@localhost:5432/devdb"),
  DB_POOL_SIZE: z.coerce.number().int().positive().default(10),
  REDIS_URL: z.url().default("redis://localhost:6379"),
});

const env = envSchema.parse(process.env);

export const config = {
  name: env.NAME,
  env: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,
  isDevelopment: env.NODE_ENV === "development",
  isProduction: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test",
  server: {
    host: env.HOST,
    port: env.PORT,
  },
  database: {
    url: env.DATABASE_URL,
    poolSize: env.DB_POOL_SIZE,
  },
  redis: {
    url: env.REDIS_URL,
  },
} as const;

export type Config = typeof config;
