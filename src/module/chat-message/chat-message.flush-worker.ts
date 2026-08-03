import { config } from "@/config.js";
import { logger } from "@/logger.js";
import type { RedisClient } from "@/redis/index.js";
import type { ChatMessagePgRepository } from "@/module/chat-message/chat-message.pg-repository.js";
import type { ChatMessageRedisBuffer } from "@/module/chat-message/chat-message.redis-buffer.js";

const consumerGroup = "chat-pg-writers";
const consumerName = `${config.name}-${process.pid}`;

type StreamEntry = {
  streamId: string;
  messageId: string;
};

export class ChatMessageFlushWorker {
  private stopped = true;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly redis: RedisClient,
    private readonly buffer: ChatMessageRedisBuffer,
    private readonly repo: ChatMessagePgRepository,
  ) {}

  start(): void {
    if (!this.stopped) {
      return;
    }

    this.stopped = false;
    this.loopPromise = this.loop();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await this.loopPromise;
  }

  private async loop(): Promise<void> {
    await this.ensureConsumerGroup();

    while (!this.stopped) {
      try {
        const entries = await this.readEntries();

        if (entries.length === 0) {
          continue;
        }

        await this.flush(entries);
      } catch (error) {
        logger.error({ error }, "Chat message flush failed");
        await sleep(config.chat.flushIntervalMs);
      }
    }
  }

  private async ensureConsumerGroup(): Promise<void> {
    try {
      await this.redis.xGroupCreate(this.buffer.streamKey, consumerGroup, "0", {
        MKSTREAM: true,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("BUSYGROUP")) {
        return;
      }

      throw error;
    }
  }

  private async readEntries(): Promise<StreamEntry[]> {
    const result = (await this.redis.sendCommand([
      "XREADGROUP",
      "GROUP",
      consumerGroup,
      consumerName,
      "COUNT",
      String(config.chat.flushBatchSize),
      "BLOCK",
      String(config.chat.flushIntervalMs),
      "STREAMS",
      this.buffer.streamKey,
      ">",
    ])) as unknown;

    return parseStreamEntries(result);
  }

  private async flush(entries: StreamEntry[]): Promise<void> {
    const messages = await this.buffer.getBufferedMessages(entries.map((entry) => entry.messageId));

    if (messages.length > 0) {
      await this.repo.insertMany(messages);
    }

    const messagesById = new Map(messages.map((message) => [message.id, message]));

    for (const entry of entries) {
      const message = messagesById.get(entry.messageId);

      if (message) {
        await this.buffer.cleanup(message);
      }

      await this.buffer.ack(entry.streamId);
    }
  }
}

function parseStreamEntries(value: unknown): StreamEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: StreamEntry[] = [];

  for (const stream of value) {
    if (!Array.isArray(stream) || !Array.isArray(stream[1])) {
      continue;
    }

    for (const rawEntry of stream[1]) {
      if (
        !Array.isArray(rawEntry) ||
        typeof rawEntry[0] !== "string" ||
        !Array.isArray(rawEntry[1])
      ) {
        continue;
      }

      const fields = rawEntry[1] as unknown[];
      const messageIdIndex = fields.findIndex((field) => field === "messageId");
      const messageId = fields[messageIdIndex + 1];

      if (typeof messageId === "string") {
        entries.push({ streamId: rawEntry[0], messageId });
      }
    }
  }

  return entries;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
