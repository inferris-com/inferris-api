import { createClient, type RedisClientOptions } from "redis";

import { config } from "@/config.js";
import { logger } from "@/logger.js";

export type RedisClient = ReturnType<typeof createClient>;

const connectionPromises = new WeakMap<RedisClient, Promise<RedisClient>>();

export function createRedisClient(redisUrl = config.redis.url, options: RedisClientOptions = {}) {
  const client = createClient({
    ...options,
    url: redisUrl,
    socket: {
      ...options.socket,
      connectTimeout: options.socket?.connectTimeout ?? config.redis.connectTimeoutMs,
      reconnectStrategy:
        options.socket?.reconnectStrategy ??
        ((retries) => Math.min(retries * 50, config.redis.reconnectMaxDelayMs)),
    },
  });

  client.on("error", (error) => {
    logger.error({ error }, "Redis client error");
  });

  client.on("ready", () => {
    logger.info("Redis client ready");
  });

  return client;
}

export async function connectRedis(client: RedisClient = redis) {
  if (client.isReady) {
    return client;
  }

  const existingPromise = connectionPromises.get(client);
  if (existingPromise) {
    return existingPromise;
  }

  const connectionPromise = client.connect().finally(() => {
    connectionPromises.delete(client);
  });

  connectionPromises.set(client, connectionPromise);

  return connectionPromise;
}

export async function disconnectRedis(client: RedisClient = redis) {
  if (client.isOpen) {
    await client.close();
  }
}

export const redis = createRedisClient();
