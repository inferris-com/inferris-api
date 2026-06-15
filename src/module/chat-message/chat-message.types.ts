export type ChatMessageRecord = {
  id: string;
  producerMessageId: string;
  ingestStreamId: string | null;
  actorId: string;
  playerId: string | null;
  originServerId: string;
  channelKey: string;
  message: string;
  isFlagged: boolean;
  occurredAtMs: string;
  persistenceState: "pending" | "persisted";
};

export type BufferedChatMessage = {
  id: string;
  producerMessageId: string;
  actorId: string;
  playerId: string | null;
  originServerId: string;
  channelKey: string;
  message: string;
  occurredAtMs: string;
  ingestStreamId: string | null;
};

export type ChatMessageWriteInput = Omit<BufferedChatMessage, "ingestStreamId">;

export type ChatMessageListFilters = {
  limit: number;
  beforeMs?: number;
  afterMs?: number;
  channelKey?: string;
  originServerId?: string;
  actorId?: string;
  playerId?: string;
};
