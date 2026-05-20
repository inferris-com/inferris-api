import type {AccessResponse, LockdownResponse, ServerResponse} from "./server.response.types.js";
import type {
  CreateLockdownBody,
  CreateServerBody,
  ReplaceServerAccessBody, UpdateLockdownBody, UpdateServerAccessBody,
  UpdateServerBody
} from "./server.schemas.js";

export interface ServerRepository {
  findServerById(id: string): Promise<ServerResponse | null>;
  findAccessPolicyByServerId(id: string): Promise<AccessResponse | null>;
  findLockdownById(id: string): Promise<LockdownResponse | null>;

  createServer(input: CreateServerBody): Promise<ServerResponse | null>;
  createAccessPolicy(input: ReplaceServerAccessBody): Promise<AccessResponse | null>;
  createLockdown(input: CreateLockdownBody): Promise<LockdownResponse | null>;

  updateServer(input: UpdateServerBody): Promise<ServerResponse | null>;
  updateAccessPolicy(input: UpdateServerAccessBody): Promise<AccessResponse | null>;
  updateLockdown(input: UpdateLockdownBody): Promise<LockdownResponse | null>;

  deleteServer(id: string): Promise<boolean>;
  deleteAccessPolicy(id: string): Promise<boolean>;
  deleteLockdown(id: string): Promise<boolean>;

  // listPlayers(query: ListPlayersQuery): Promise<PlayerSummaryResponse[]>;
  // findPlayerById(id: string): Promise<PlayerResponse | null>;
  // createPlayer(input: CreatePlayerBody): Promise<CreatePlayerResult>;
  // updatePlayer(id: string, input: UpdatePlayerBody): Promise<PlayerResponse | null>;
  // deletePlayer(id: string, options: DeletePlayerOptions): Promise<boolean>;
}
