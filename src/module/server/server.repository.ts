import type { Servers } from "../../db/types.js";
import type { AccessResponse, LockdownResponse } from "./server.response.types.js";
import type {
  CreateLockdownBody,
  CreateServerBody,
  ReplaceServerAccessBody,
  UpdateLockdownBody,
  UpdateServerBody,
} from "./server.schemas.js";

export interface ServerRepository {
  findServerById(id: string): Promise<Servers | null>;
  findAccessPolicyByServerId(id: string): Promise<AccessResponse | null>;
  findLockdownById(id: string): Promise<LockdownResponse | null>;

  createServer(input: CreateServerBody): Promise<Servers | null>;
  createAccessPolicy(input: ReplaceServerAccessBody): Promise<AccessResponse | null>;
  createLockdown(input: CreateLockdownBody): Promise<LockdownResponse | null>;

  updateServer(input: UpdateServerBody): Promise<Servers | null>;
  updateAccessPolicy(input: ReplaceServerAccessBody): Promise<AccessResponse | null>;
  updateLockdown(input: UpdateLockdownBody): Promise<LockdownResponse | null>;

  deleteServer(id: string): Promise<boolean>;
  deleteAccessPolicy(id: string): Promise<boolean>;
  deleteLockdown(id: string): Promise<boolean>;
}
