import { ConflictError, NotFoundError } from "@/error/app-error.js";

export class ServerNotFoundError extends NotFoundError {
  readonly serverId: string;

  constructor(serverId: string) {
    super({
      code: "SERVER_NOT_FOUND",
      message: "Server not found.",
    });

    this.serverId = serverId;
  }
}

export class ServerAlreadyExistsError extends ConflictError {
  readonly serverName: string;

  constructor(serverId: string) {
    super({
      code: "SERVER_ALREADY_EXISTS",
      message: "Server name already exists.",
    });

    this.serverName = serverId;
  }
}

export class ServerLockdownAlreadyExistsError extends ConflictError {
  readonly serverId: string;

  constructor(serverId: string) {
    super({
      code: "SERVER_LOCKDOWN_ALREADY_EXISTS",
      message: "Server lockdown already exists.",
    });

    this.serverId = serverId;
  }
}
