export type ChatChannel = "global" | "staff" | "testing";

export type PlayerSummaryResponse = {
  id: string;
  username: string;
  flags: string;
  orbs: string;
  chatChannel: ChatChannel;
};

export type ServerResponse = {
  id: string;
  name: string;
  type: string,
  environment: string,
  status: string,
  port: number | null,
  version: string,
  lastStartedAtMs: string | null,
  lastHeartbeatAtMs: string | null,
  createdAtMs: string,
  lastUpdatedAtMs: string | null
};

export type AccessResponse = {
  id: string
  mode: string,
  requiredPermissionId: string | null,
  requiredRankKey: string | null,
  note: string | null,
  createdAtMs: string,
  updatedAtMs: string | null,
};

export type LockdownResponse = {
  id: string,
  scope: string,
  serverId: string | null,
  requiredRankKey: string | null,
  reason: string,
  issuedByActorId: string,
  isActive: boolean,
  startedAtMs: string,
  endsAtMs: string | null
};
