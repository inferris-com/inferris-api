import { ServerNotFoundError } from "./server.errors.js";
import { toAccessResponse, toLockdownResponse, toServerResponse } from "./server.mapper.js";
import type { AccessResponse, LockdownResponse, ServerResponse } from "./server.response.types.js";
import type { PgServerRepository } from "./server.pg-repository.js";

export class ServerService {
  constructor(private readonly repo: PgServerRepository) {}

  async getServer(id: string): Promise<ServerResponse> {
    const server = await this.repo.findServerById(id);

    if (!server) {
      throw new ServerNotFoundError(id);
    }

    return toServerResponse(server);
  }

  async getAccessPolicy(id: string): Promise<AccessResponse> {
    const server = await this.repo.findAccessPolicyByServerId(id);

    if (!server) {
      throw new ServerNotFoundError(id);
    }
    return toAccessResponse(server);
  }

  async getLockdown(id: string): Promise<LockdownResponse> {
    const server = await this.repo.findLockdownByServerId(id);

    if (!server) {
      throw new ServerNotFoundError(id);
    }
    return toLockdownResponse(server);
  }
}
