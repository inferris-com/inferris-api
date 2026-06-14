import {
  InvalidPunishmentDurationError,
  PunishmentAlreadyRevokedError,
  PunishmentNotFoundError,
} from "./punishment.errors.js";
import { toPunishmentResponse } from "./punishment.mapper.js";
import type { PunishmentPgRepository } from "./punishment.pg-repository.js";
import type { PunishmentPublisher } from "./punishment.publisher.js";
import type { PunishmentResponse } from "./punishment.response-types.js";
import type {
  CreatePunishmentBody,
  ListPunishmentsQuery,
  RevokePunishmentBody,
} from "./punishment.schemas.js";

export type PunishmentListResponse = {
  data: PunishmentResponse[];
  meta: {
    count: number;
    total: number;
    limit: number;
    offset: number;
  };
};

export class PunishmentService {
  constructor(
    private readonly repo: PunishmentPgRepository,
    private readonly publisher: PunishmentPublisher,
  ) {}

  async listPunishments(query: ListPunishmentsQuery): Promise<PunishmentListResponse> {
    const result = await this.repo.listPunishments(query);

    return {
      data: result.rows.map(toPunishmentResponse),
      meta: {
        count: result.rows.length,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
  }

  async getPunishment(id: string): Promise<PunishmentResponse> {
    const punishment = await this.repo.findPunishmentById(id);

    if (!punishment) {
      throw new PunishmentNotFoundError(id);
    }

    return toPunishmentResponse(punishment);
  }

  async createPunishment(
    input: CreatePunishmentBody,
    issuerActorId: string,
  ): Promise<PunishmentResponse> {
    this.validateDuration(input);

    const subjectActorId =
      input.subjectActorId ?? (await this.resolveSubjectActorId(input.subjectPlayerId));

    const punishment = await this.repo.createPunishment({
      ...input,
      subjectActorId,
      issuerActorId,
    });
    const response = toPunishmentResponse(punishment);

    await this.publisher.publish({
      event: "punishment.created",
      punishment: response,
    });

    return response;
  }

  async revokePunishment(
    id: string,
    input: RevokePunishmentBody,
    revokedByActorId: string,
  ): Promise<PunishmentResponse> {
    const punishment = await this.repo.revokePunishment({
      punishmentId: id,
      revokedByActorId,
      reason: input.reason ?? null,
    });

    if (!punishment) {
      if (await this.repo.punishmentExists(id)) {
        throw new PunishmentAlreadyRevokedError(id);
      }

      throw new PunishmentNotFoundError(id);
    }

    const response = toPunishmentResponse(punishment);

    await this.publisher.publish({
      event: "punishment.revoked",
      punishment: response,
    });

    return response;
  }

  private async resolveSubjectActorId(subjectPlayerId: string | undefined): Promise<string> {
    if (!subjectPlayerId) {
      throw new PunishmentNotFoundError("unknown");
    }

    const actorId = await this.repo.findActorIdByPlayerId(subjectPlayerId);

    if (!actorId) {
      throw new PunishmentNotFoundError(subjectPlayerId);
    }

    return actorId;
  }

  private validateDuration(input: CreatePunishmentBody): void {
    if ((input.type === "warn" || input.type === "kick") && input.endsAtMs !== undefined) {
      throw new InvalidPunishmentDurationError("Warnings and kicks cannot have an end time.");
    }

    if ((input.type === "mute" || input.type === "ban") && input.endsAtMs !== null) {
      return;
    }
  }
}
