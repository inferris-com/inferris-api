import { randomUUID } from "node:crypto";

import { config } from "../../config.js";
import {
  ChatActorNotFoundError,
  ChatBatchTooLargeError,
  ChatChannelNotFoundError,
  ChatRedisUnavailableError,
  ChatServerNotFoundError,
} from "./chat-message.errors.js";
import { toChatMessageResponse } from "./chat-message.mapper.js";
import type { ChatMessagePgRepository } from "./chat-message.pg-repository.js";
import type { ChatMessageRedisBuffer } from "./chat-message.redis-buffer.js";
import type { ChatMessageResponse } from "./chat-message.response-types.js";
import type {
  CreateChatMessageBatchBody,
  CreateChatMessageBody,
  ListChatMessagesQuery,
} from "./chat-message.schemas.js";
import type {
  ChatMessageListFilters,
  ChatMessageRecord,
  ChatMessageWriteInput,
} from "./chat-message.types.js";

export type ChatMessageListResponse = {
  data: ChatMessageResponse[];
  meta: {
    count: number;
    limit: number;
    includePending: boolean;
  };
};

export class ChatMessageService {
  constructor(
    private readonly repo: ChatMessagePgRepository,
    private readonly buffer: ChatMessageRedisBuffer,
  ) {}

  async createMessage(input: CreateChatMessageBody): Promise<ChatMessageResponse> {
    const duplicate = await this.repo.findByProducerMessageId(
      input.originServerId,
      input.producerMessageId,
    );

    if (duplicate) {
      return toChatMessageResponse(duplicate);
    }

    const writeInput = await this.toWriteInput(input);

    try {
      const result = await this.buffer.enqueue(writeInput);

      if (result.status === "duplicate") {
        return this.findDuplicate(input.originServerId, input.producerMessageId, result.messageId);
      }

      return toChatMessageResponse({
        ...writeInput,
        ingestStreamId: result.ingestStreamId,
        isFlagged: false,
        persistenceState: "pending",
      });
    } catch (error) {
      throw new ChatRedisUnavailableError(error);
    }
  }

  async createBatch(input: CreateChatMessageBatchBody): Promise<ChatMessageResponse[]> {
    if (input.messages.length > config.chat.maxBatchSize) {
      throw new ChatBatchTooLargeError(config.chat.maxBatchSize);
    }

    const responses: ChatMessageResponse[] = [];

    for (const message of input.messages) {
      responses.push(await this.createMessage(message));
    }

    return responses;
  }

  async listMessages(query: ListChatMessagesQuery): Promise<ChatMessageListResponse> {
    const filters = toFilters(query);
    const persisted = await this.repo.listMessages(filters);
    const pending = query.includePending ? await this.safeListPending(filters) : [];
    const merged = mergeChatMessages(persisted, pending, filters.limit).map(toChatMessageResponse);

    return {
      data: merged,
      meta: {
        count: merged.length,
        limit: filters.limit,
        includePending: query.includePending,
      },
    };
  }

  private async toWriteInput(input: CreateChatMessageBody): Promise<ChatMessageWriteInput> {
    const [actorId] = await Promise.all([
      this.resolveActorId(input.actorId, input.playerId),
      this.ensureServerExists(input.originServerId),
      this.ensureChannelExists(input.channelKey),
    ]);

    return {
      id: randomUUID(),
      producerMessageId: input.producerMessageId,
      actorId,
      playerId: input.playerId ?? null,
      originServerId: input.originServerId,
      channelKey: input.channelKey,
      message: input.message,
      occurredAtMs: String(input.occurredAtMs ?? Date.now()),
    };
  }

  private async resolveActorId(actorId: string | undefined, playerId: string | undefined) {
    if (actorId) {
      if (!(await this.repo.actorExists(actorId))) {
        throw new ChatActorNotFoundError(actorId);
      }

      return actorId;
    }

    if (!playerId) {
      throw new ChatActorNotFoundError("unknown");
    }

    const resolvedActorId = await this.repo.findActorIdByPlayerId(playerId);

    if (!resolvedActorId) {
      throw new ChatActorNotFoundError(playerId);
    }

    return resolvedActorId;
  }

  private async ensureServerExists(serverId: string): Promise<void> {
    if (!(await this.repo.serverExists(serverId))) {
      throw new ChatServerNotFoundError(serverId);
    }
  }

  private async ensureChannelExists(channelKey: string): Promise<void> {
    if (!(await this.repo.channelExists(channelKey))) {
      throw new ChatChannelNotFoundError(channelKey);
    }
  }

  private async findDuplicate(
    originServerId: string,
    producerMessageId: string,
    messageId: string,
  ): Promise<ChatMessageResponse> {
    const pending = await this.buffer.getPendingMessage(messageId);

    if (pending) {
      return toChatMessageResponse(pending);
    }

    const persisted = await this.repo.findByProducerMessageId(originServerId, producerMessageId);

    if (persisted) {
      return toChatMessageResponse(persisted);
    }

    throw new ChatRedisUnavailableError();
  }

  private async safeListPending(filters: ChatMessageListFilters): Promise<ChatMessageRecord[]> {
    try {
      return await this.buffer.listPendingMessages(filters);
    } catch (error) {
      throw new ChatRedisUnavailableError(error);
    }
  }
}

export function mergeChatMessages(
  persisted: ChatMessageRecord[],
  pending: ChatMessageRecord[],
  limit: number,
): ChatMessageRecord[] {
  const byId = new Map<string, ChatMessageRecord>();

  for (const message of [...persisted, ...pending]) {
    byId.set(message.id, message);
  }

  return [...byId.values()].sort((left, right) => compareChatMessages(left, right)).slice(0, limit);
}

function compareChatMessages(left: ChatMessageRecord, right: ChatMessageRecord): number {
  const occurredDiff = BigInt(right.occurredAtMs) - BigInt(left.occurredAtMs);

  if (occurredDiff !== 0n) {
    return occurredDiff > 0n ? 1 : -1;
  }

  const leftTieBreaker = left.ingestStreamId ?? left.id;
  const rightTieBreaker = right.ingestStreamId ?? right.id;

  return rightTieBreaker.localeCompare(leftTieBreaker);
}

function toFilters(query: ListChatMessagesQuery): ChatMessageListFilters {
  const filters: ChatMessageListFilters = {
    limit: query.limit,
  };

  if (query.beforeMs !== undefined) {
    filters.beforeMs = query.beforeMs;
  }

  if (query.afterMs !== undefined) {
    filters.afterMs = query.afterMs;
  }

  if (query.channelKey !== undefined) {
    filters.channelKey = query.channelKey;
  }

  if (query.originServerId !== undefined) {
    filters.originServerId = query.originServerId;
  }

  if (query.actorId !== undefined) {
    filters.actorId = query.actorId;
  }

  if (query.playerId !== undefined) {
    filters.playerId = query.playerId;
  }

  return filters;
}
