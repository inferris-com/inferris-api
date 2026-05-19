import pino, { type LoggerOptions } from "pino";
import { config } from "./config.js";

const options: LoggerOptions = {
  name: config.name,
  level: config.logLevel,
  enabled: config.logLevel !== "silent",
  base: {
    service: config.name,
    env: config.env,
  },
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "body.password", "body.token"],
    censor: "[REDACTED]",
  },
  ...(config.isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            singleLine: false,
          },
        },
      }),
};

export const logger = pino(options);
