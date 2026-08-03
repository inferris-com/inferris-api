import type { Platform, PrincipalType } from "@/db/types.js";
import type { AccountRole } from "@/module/argus/account/account.schemas.js";
import type { StaffPrivilegeRole } from "@/module/staff-privilege/staff-privilege.schemas.js";

export type ApiScope =
  | "*"
  | "actors:read"
  | "actors:write"
  | "players:read"
  | "players:write"
  | "players:bypass-sensitive-fields"
  | "servers:read"
  | "servers:write"
  | "permissions:read"
  | "permissions:write"
  | "staff:read"
  | "staff:write"
  | "argus:read"
  | "argus:write"
  | "audit:read"
  | "chat:read"
  | "chat:write"
  | "moderation:read"
  | "moderation:write"
  | "minecraft:sessions:manage"
  | "minecraft:permission-check";

export type AuthContext = {
  principalType: PrincipalType;
  principalId: string;
  actorId: string | null;
  credentialOwnerActorId?: string | null;
  platform: Platform;
  apiKey?: {
    id: string;
    scopes: ApiScope[];
    isSuperKey: boolean;
  };
  serverInstance?: {
    id: string;
    serverId: string;
    serverType: string;
    state: string;
  };
  argus?: {
    userId: string;
    role: AccountRole;
    sessionId?: string;
  };
  minecraftSession?: {
    playerId: string;
    mojangId: string;
    proxyServerId: string;
    networkSessionId: string;
  };
  privileged?: {
    id: string;
    role: StaffPrivilegeRole;
  };
};

export const privilegedRoleRank: Record<StaffPrivilegeRole, number> = {
  none: 0,
  collaborator: 1,
  moderator: 2,
  administrator: 3,
  superadmin: 4,
};

export const argusRoleRank: Record<AccountRole, number> = {
  moderator: 1,
  admin: 2,
};

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
