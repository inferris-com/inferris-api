export type ChatMessageResponse = {
  id: string;
  producerMessageId: string;
  ingestStreamId: string | null;
  actorId: string;
  playerId: string | null;
  originServerId: string;
  channelKey: string;
  message: string;
  verdict: "allow" | "warn" | "deny";
  moderationReason: string | null;
  moderationMetadata: unknown;
  isFlagged: boolean;
  occurredAtMs: string;
  persistenceState: "pending" | "persisted";
};
