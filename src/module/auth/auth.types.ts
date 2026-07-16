import type {
  ArgusAccountRole,
  Platform,
  PrincipalType,
  UserPrivilegeRole,
} from "../../db/types.js";

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
  | "staff:write"
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
  argus?: {
    userId: string;
    role: ArgusAccountRole;
  };
  minecraftSession?: {
    playerId: string;
    mojangId: string;
    serverId: string;
    sessionEventId: string;
  };
  privileged?: {
    id: string;
    role: UserPrivilegeRole;
  };
};

export const privilegedRoleRank: Record<UserPrivilegeRole, number> = {
  none: 0,
  collaborator: 1,
  moderator: 2,
  administrator: 3,
  superadmin: 4,
};

export const argusRoleRank: Record<ArgusAccountRole, number> = {
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
