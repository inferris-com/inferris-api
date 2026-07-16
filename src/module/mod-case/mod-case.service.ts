import { ModCaseNotFoundError } from "./mod-case.errors.js";
import { toModCaseActorResponse, toModCaseResponse } from "./mod-case.mapper.js";
import type { ModCasePgRepository } from "./mod-case.pg-repository.js";
import type { ModCasePublisher } from "./mod-case.publisher.js";
import type { ModCaseActorResponse, ModCaseResponse } from "./mod-case.response-types.js";
import type {
  CreateModCaseActorBody,
  CreateModCaseBody,
  ListModCasesQuery,
  UpdateModCaseBody,
} from "./mod-case.schemas.js";

export type ModCaseListResponse = {
  data: ModCaseResponse[];
  meta: {
    count: number;
    total: number;
    limit: number;
    offset: number;
  };
};

const terminalModCaseStatuses = new Set(["resolved", "dismissed", "closed"]);

export class ModCaseService {
  constructor(
    private readonly repo: ModCasePgRepository,
    private readonly publisher: ModCasePublisher,
  ) {}

  async listModCases(query: ListModCasesQuery): Promise<ModCaseListResponse> {
    const result = await this.repo.listModCases(query);

    return {
      data: result.rows.map(toModCaseResponse),
      meta: {
        count: result.rows.length,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
  }

  async getModCase(id: string): Promise<ModCaseResponse> {
    const modCase = await this.repo.findModCaseById(id);

    if (!modCase) {
      throw new ModCaseNotFoundError(id);
    }

    return toModCaseResponse(modCase);
  }

  async createModCase(
    input: CreateModCaseBody,
    openedByActorId: string,
    openedByArgusUserId?: string | null,
  ): Promise<ModCaseResponse> {
    const modCase = await this.repo.createModCase({
      ...input,
      openedByActorId,
      ...(openedByArgusUserId === undefined ? {} : { openedByArgusUserId }),
    });
    const response = toModCaseResponse(modCase);

    await this.publisher.publish({
      event: "mod_case.created",
      modCase: response,
    });

    return response;
  }

  async updateModCase(
    id: string,
    input: UpdateModCaseBody,
    actorId: string,
    argusUserId?: string | null,
  ): Promise<ModCaseResponse> {
    const updateInput = {
      ...input,
    };

    if (input.status && terminalModCaseStatuses.has(input.status)) {
      Object.assign(updateInput, { closedByActorId: actorId, closedByArgusUserId: argusUserId });
    }

    const modCase = await this.repo.updateModCase(id, updateInput);

    if (!modCase) {
      throw new ModCaseNotFoundError(id);
    }

    return toModCaseResponse(modCase);
  }

  async listActors(caseId: string): Promise<ModCaseActorResponse[]> {
    if (!(await this.repo.findModCaseById(caseId))) {
      throw new ModCaseNotFoundError(caseId);
    }

    return (await this.repo.listActors(caseId)).map(toModCaseActorResponse);
  }

  async createActor(
    caseId: string,
    input: CreateModCaseActorBody,
    addedByActorId: string,
  ): Promise<ModCaseActorResponse> {
    if (!(await this.repo.findModCaseById(caseId))) {
      throw new ModCaseNotFoundError(caseId);
    }

    return toModCaseActorResponse(
      await this.repo.createActor({
        ...input,
        caseId,
        addedByActorId,
      }),
    );
  }
}
