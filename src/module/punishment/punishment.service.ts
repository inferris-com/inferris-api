import { randomInt } from "node:crypto";

import { PgErrorCode, isPgErrorCode } from "../../shared/db/pg-error.utils.js";
import {
  ActivePunishmentConflictError,
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

const punishmentCodeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const punishmentCodeLength = 10;
const maxPunishmentCodeCreateAttempts = 5;

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

  async getPunishmentByCode(code: string): Promise<PunishmentResponse> {
    const punishment = await this.repo.findPunishmentByCode(code);

    if (!punishment) {
      throw new PunishmentNotFoundError(code);
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

    await this.expirePunishments(subjectActorId, input.type);
    if (
      (input.type === "ban" || input.type === "mute") &&
      (await this.repo.findActivePunishment(subjectActorId, input.type))
    ) {
      throw new ActivePunishmentConflictError(input.type, subjectActorId);
    }

    const punishment = await this.createPunishmentWithUniqueCode(
      input,
      subjectActorId,
      issuerActorId,
    );
    const response = toPunishmentResponse(punishment);

    await this.publisher.publish({
      event: "punishment.created",
      punishment: response,
    });

    return response;
  }

  private async createPunishmentWithUniqueCode(
    input: CreatePunishmentBody,
    subjectActorId: string,
    issuerActorId: string,
  ) {
    for (let attempt = 1; attempt <= maxPunishmentCodeCreateAttempts; attempt += 1) {
      try {
        return await this.repo.createPunishment({
          ...input,
          code: generatePunishmentCode(),
          subjectActorId,
          issuerActorId,
        });
      } catch (err) {
        if (
          isPgErrorCode(err, PgErrorCode.UniqueViolation) &&
          err.constraint === "uq_punishments_code" &&
          attempt < maxPunishmentCodeCreateAttempts
        ) {
          continue;
        }

        throw err;
      }
    }

    throw new Error("Failed to generate a unique punishment code.");
  }

  async revokePunishment(
    id: string,
    input: RevokePunishmentBody,
    liftedByActorId: string,
  ): Promise<PunishmentResponse> {
    const punishment = await this.repo.revokePunishment({
      punishmentId: id,
      liftedByActorId,
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

    if ((input.type === "mute" || input.type === "ban") && input.endsAtMs != null) {
      if (BigInt(input.endsAtMs) <= BigInt(Date.now())) {
        throw new InvalidPunishmentDurationError("Punishment end time must be in the future.");
      }
    }
  }

  async expirePunishments(
    subjectActorId?: string,
    type?: CreatePunishmentBody["type"],
    punishmentId?: string,
  ): Promise<PunishmentResponse[]> {
    const expiredPunishments = await this.repo.expirePunishments(
      subjectActorId,
      type,
      punishmentId,
    );
    const responses = expiredPunishments.map(toPunishmentResponse);

    await Promise.all(
      responses.map((punishment) =>
        this.publisher.publish({
          event: "punishment.expired",
          punishment,
        }),
      ),
    );

    return responses;
  }
}

function generatePunishmentCode(): string {
  let code = "";

  for (let index = 0; index < punishmentCodeLength; index += 1) {
    code += punishmentCodeAlphabet.charAt(randomInt(punishmentCodeAlphabet.length));
  }

  return code;
}
