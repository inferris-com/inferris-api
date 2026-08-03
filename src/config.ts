import "dotenv/config";

import z from "zod";
import { accountStateSchema } from "@/module/argus/account/account.schemas.js";

const envSchema = z
  .object({
    NAME: z.string().default("inferris-api"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().min(1).default("0.0.0.0"),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.string().min(1).default("debug"),
    DATABASE_URL: z.url().default("postgres://dev:dev@localhost:5432/devdb"),
    DB_POOL_SIZE: z.coerce.number().int().positive().default(10),
    REDIS_URL: z.url().default("redis://localhost:6379"),
    REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    REDIS_RECONNECT_MAX_DELAY_MS: z.coerce.number().int().nonnegative().default(3000),
    AUTH_JWT_SECRET: z
      .string()
      .min(3) // allows 3 in dev; enforced 32 in app code
      .default("development-auth-secret-change-me-at-least-32-chars"),
    AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    AUTH_REFRESH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24 * 14),
    AUTH_API_KEY_PEPPER: z.string().default("development-api-key-pepper-change-me-32-chars"),
    CHAT_FLUSH_BATCH_SIZE: z.coerce.number().int().positive().default(500),
    CHAT_FLUSH_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
    CHAT_MAX_BATCH_SIZE: z.coerce.number().int().positive().default(500),
    CHAT_DEDUPE_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24 * 7),
    CHAT_ALLOWED_CLOCK_SKEW_MS: z.coerce.number().int().nonnegative().default(300000),
    MINECRAFT_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    MINECRAFT_HEARTBEAT_STALE_SECONDS: z.coerce.number().int().positive().default(120),
    MINECRAFT_PLAYER_IDENTITY_CACHE_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60),
    ARGUS_NOTIFY_DATA_BREACH: z.stringbool().default(true),
    ARGUS_LOGIN_ALLOWED_ACCOUNT_STATES: z
      .string()
      .default("active,suspended")
      .transform((value) => value.split(",").map((item) => item.trim()))
      .pipe(z.array(accountStateSchema)),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") {
      return;
    }

    if (env.AUTH_JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: "too_small",
        minimum: 32,
        inclusive: true,
        origin: "string",
        path: ["AUTH_JWT_SECRET"],
        message: "Production AUTH_JWT_SECRET must be at least 32 characters.",
      });
    }

    if (env.AUTH_API_KEY_PEPPER.length < 32) {
      ctx.addIssue({
        code: "too_small",
        minimum: 32,
        inclusive: true,
        origin: "string",
        path: ["AUTH_API_KEY_PEPPER"],
        message: "Production AUTH_API_KEY_PEPPER must be at least 32 characters.",
      });
    }

    if (!env.ARGUS_LOGIN_ALLOWED_ACCOUNT_STATES.includes("active")) {
      ctx.addIssue({
        code: "invalid_value",
        values: ["active", "suspended", "disabled", "verify_email"],
        path: ["ARGUS_LOGIN_ALLOWED_ACCOUNT_STATES"],
        message: '"active" must be included in denied login account states.',
      });
    }
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
    connectTimeoutMs: env.REDIS_CONNECT_TIMEOUT_MS,
    reconnectMaxDelayMs: env.REDIS_RECONNECT_MAX_DELAY_MS,
  },
  auth: {
    jwtSecret: env.AUTH_JWT_SECRET,
    accessTokenTtlSeconds: env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlSeconds: env.AUTH_REFRESH_TOKEN_TTL_SECONDS,
    apiKeyPepper: env.AUTH_API_KEY_PEPPER,
  },
  argus: {
    notifyDataBreach: env.ARGUS_NOTIFY_DATA_BREACH,
    loginAllowedAccountStates: env.ARGUS_LOGIN_ALLOWED_ACCOUNT_STATES,
  },
  minecraft: {
    sessionTtlSeconds: env.MINECRAFT_SESSION_TTL_SECONDS,
    heartbeatStaleSeconds: env.MINECRAFT_HEARTBEAT_STALE_SECONDS,
    playerIdentityCacheTtlSeconds: env.MINECRAFT_PLAYER_IDENTITY_CACHE_TTL_SECONDS,
  },
  chat: {
    flushBatchSize: env.CHAT_FLUSH_BATCH_SIZE,
    flushIntervalMs: env.CHAT_FLUSH_INTERVAL_MS,
    maxBatchSize: env.CHAT_MAX_BATCH_SIZE,
    dedupeTtlSeconds: env.CHAT_DEDUPE_TTL_SECONDS,
    allowedClockSkewMs: env.CHAT_ALLOWED_CLOCK_SKEW_MS,
  },
} as const;

export type Config = typeof config;
