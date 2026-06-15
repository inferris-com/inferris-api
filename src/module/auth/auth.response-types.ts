import type { ArgusAccountRole, UserPrivilegeRole } from "../../db/types.js";

export type AuthUserResponse = {
  id: string;
  username: string;
  role: ArgusAccountRole;
  actorId: string | null;
  privilegedRole: UserPrivilegeRole | null;
};

export type AuthTokenResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  user: AuthUserResponse;
};
