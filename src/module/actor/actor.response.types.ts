export type ActorResponse = {
  id: string;
  name: string | null;
  type: "system" | "application" | "user" | "unspecified";
  playerId: string | null;
  createdAtMs: string;
  lastUpdatedAtMs: string | null;
};
