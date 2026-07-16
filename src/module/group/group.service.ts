import { GroupAlreadyExistsError, GroupNotFoundError } from "./group.errors.js";
import { toGroupResponse } from "./group.mapper.js";
import type { GroupPgRepository } from "./group.pg-repository.js";
import type { GroupResponse } from "./group.response-types.js";
import type { CreateGroupBody, ListGroupsQuery, UpdateGroupBody } from "./group.schemas.js";

export class GroupService {
  constructor(private readonly repo: GroupPgRepository) {}

  async listGroups(query: ListGroupsQuery): Promise<GroupResponse[]> {
    return (await this.repo.listGroups(query)).map(toGroupResponse);
  }

  async getGroup(groupKey: string): Promise<GroupResponse> {
    const group = await this.repo.findGroupByKey(groupKey);

    if (!group) {
      throw new GroupNotFoundError(groupKey);
    }

    return toGroupResponse(group);
  }

  async createGroup(input: CreateGroupBody): Promise<GroupResponse> {
    const group = await this.repo.createGroup(input);

    if (!group) {
      throw new GroupAlreadyExistsError(input.key);
    }

    return toGroupResponse(group);
  }

  async updateGroup(groupKey: string, input: UpdateGroupBody): Promise<GroupResponse> {
    const group = await this.repo.updateGroup(groupKey, input);

    if (!group) {
      throw new GroupNotFoundError(groupKey);
    }

    return toGroupResponse(group);
  }

  async deleteGroup(groupKey: string): Promise<void> {
    if (!(await this.repo.deleteGroup(groupKey))) {
      throw new GroupNotFoundError(groupKey);
    }
  }
}
