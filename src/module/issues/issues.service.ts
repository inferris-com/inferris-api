import type { IssuesPgRepository } from "@/module/issues/issues.pg-repository.js";
import { toIssueResponse } from "@/module/issues/issues.mapper.js";
import { IssueNotFoundError, IssueActorNotFoundError } from "@/module/issues/issues.errors.js";
import { isForeignKeyViolation } from "@/shared/db/pg-error.utils.js";
import type {
  CreateIssueBody,
  UpdateIssueBody,
  ListIssuesQuery,
} from "@/module/issues/issues.schemas.js";

export class IssueService {
  constructor(private readonly repo: IssuesPgRepository) {}
  async getIssueById(id: string) {
    const issue = await this.repo.findIssueById(id);
    if (!issue) throw new IssueNotFoundError(id);
    return toIssueResponse(issue);
  }
  async listIssues(query: ListIssuesQuery) {
    const result = await this.repo.listIssues(query);
    return {
      data: result.rows.map(toIssueResponse),
      meta: {
        count: result.rows.length,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
  }
  async createIssue(input: CreateIssueBody, actorId: string) {
    try {
      return toIssueResponse(await this.repo.createIssue(input, actorId));
    } catch (error) {
      if (isForeignKeyViolation(error)) throw new IssueActorNotFoundError();
      throw error;
    }
  }
  async updateIssue(id: string, input: UpdateIssueBody, actorId: string) {
    try {
      const issue = await this.repo.updateIssue(id, input, actorId);
      if (!issue) throw new IssueNotFoundError(id);
      return toIssueResponse(issue);
    } catch (error) {
      if (isForeignKeyViolation(error)) throw new IssueActorNotFoundError();
      throw error;
    }
  }
}
export default IssueService;
