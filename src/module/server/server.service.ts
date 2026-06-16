import {
  ServerAlreadyExistsError,
  ServerLockdownAlreadyExistsError,
  ServerNotFoundError,
} from "./server.errors.js";
import { toAccessResponse, toLockdownResponse, toServerResponse } from "./server.mapper.js";
import type { AccessResponse, LockdownResponse, ServerResponse } from "./server.response.types.js";
import type { ServerPgRepository } from "./server.pg-repository.js";
import type {
  AuthenticatedCreateLockdownBody,
  CreateServerBody,
  ReplaceServerAccessBody,
  UpdateLockdownBody,
  UpdateServerBody,
} from "./server.schemas.js";

export class ServerService {
  constructor(private readonly repo: ServerPgRepository) {}

  async registerServer(input: CreateServerBody): Promise<ServerResponse> {
    const server = await this.repo.registerServer(input);

    return toServerResponse(server);
  }

  async createServer(input: CreateServerBody): Promise<ServerResponse> {
    const result = await this.repo.createServer(input);

    if (result.status === "conflict") {
      throw new ServerAlreadyExistsError(input.name);
    }

    return toServerResponse(result.data);
  }

  async createAccessPolicy(
    serverId: string,
    input: ReplaceServerAccessBody,
  ): Promise<AccessResponse> {
    const result = await this.repo.createAccessPolicy(serverId, input);

    return toAccessResponse(result);
  }

  async createLockdown(
    serverId: string,
    input: AuthenticatedCreateLockdownBody,
  ): Promise<LockdownResponse> {
    const result = await this.repo.createLockdown(serverId, input);

    if (result.status === "conflict") {
      throw new ServerLockdownAlreadyExistsError(serverId);
    }

    return toLockdownResponse(result.data);
  }

  async patchServer(id: string, input: UpdateServerBody): Promise<ServerResponse> {
    const server = await this.repo.updateServerById(id, input);

    if (!server) {
      throw new ServerNotFoundError(id);
    }

    return toServerResponse(server);
  }

  async updateAccessPolicy(id: string, input: ReplaceServerAccessBody): Promise<AccessResponse> {
    const policy = await this.repo.updateAccessPolicyByServerId(id, input);

    if (!policy) {
      throw new ServerNotFoundError(id);
    }
    return toAccessResponse(policy);
  }

  async patchLockdown(id: string, input: UpdateLockdownBody): Promise<LockdownResponse> {
    const lockdown = await this.repo.updateLockdownByServerId(id, input);

    if (!lockdown) {
      throw new ServerNotFoundError(id);
    }

    return toLockdownResponse(lockdown);
  }

  async getServer(id: string): Promise<ServerResponse> {
    const server = await this.repo.findServerById(id);

    if (!server) {
      throw new ServerNotFoundError(id);
    }

    return toServerResponse(server);
  }

  async getServerByName(name: string): Promise<ServerResponse> {
    const server = await this.repo.findServerByName(name);

    if (!server) {
      throw new ServerNotFoundError(name);
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

  async getLockdownByServer(id: string): Promise<LockdownResponse> {
    const server = await this.repo.findLockdownByServerId(id);

    if (!server) {
      throw new ServerNotFoundError(id);
    }
    return toLockdownResponse(server);
  }

  async getActiveGlobalLockdown(): Promise<LockdownResponse> {
    const server = await this.repo.findActiveGlobalLockdown();

    if (!server) {
      throw new ServerNotFoundError("global");
    }
    return toLockdownResponse(server);
  }

  async getLockdownById(id: string): Promise<LockdownResponse> {
    const server = await this.repo.findLockdownByLockdownId(id);

    if (!server) {
      throw new ServerNotFoundError(id);
    }
    return toLockdownResponse(server);
  }

  async deleteServer(id: string): Promise<boolean> {
    const server = await this.repo.deleteServerById(id);

    if (!server) {
      throw new ServerNotFoundError(id);
    }
    return true;
  }

  async deletePolicy(serverId: string): Promise<boolean> {
    const server = await this.repo.deletePolicyByServerId(serverId);

    if (!server) {
      throw new ServerNotFoundError(serverId);
    }
    return true;
  }

  async deleteLockdown(serverId: string): Promise<boolean> {
    const server = await this.repo.deleteLockdownByServerId(serverId);

    if (!server) {
      throw new ServerNotFoundError(serverId);
    }
    return true;
  }
}
