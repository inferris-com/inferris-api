export type ChatMessageResponse = {
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
