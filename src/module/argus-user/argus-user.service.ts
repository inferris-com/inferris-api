import { hashPassword } from "../auth/auth.crypto.js";
import { ArgusUserAlreadyExistsError, ArgusUserNotFoundError } from "./argus-user.errors.js";
import { toArgusUserResponse } from "./argus-user.mapper.js";
import type { ArgusUserPgRepository } from "./argus-user.pg-repository.js";
import type { ArgusUserResponse } from "./argus-user.response-types.js";
import type {
  CreateArgusUserBody,
  ListArgusUsersQuery,
  UpdateArgusUserBody,
} from "./argus-user.schemas.js";
import type { PaginatedResult } from "../../shared/pagination.schemas.js";

export class ArgusUserService {
  constructor(private readonly repo: ArgusUserPgRepository) {}

  async listUsers(query: ListArgusUsersQuery): Promise<PaginatedResult<ArgusUserResponse>> {
    const result = await this.repo.listUsers(query);
    return { ...result, rows: result.rows.map(toArgusUserResponse) };
  }

  async getUser(userId: string): Promise<ArgusUserResponse> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new ArgusUserNotFoundError(userId);
    return toArgusUserResponse(user);
  }

  async createUser(input: CreateArgusUserBody): Promise<ArgusUserResponse> {
    const user = await this.repo.createUser(
      input,
      input.password ? await hashPassword(input.password) : null,
    );
    if (!user) throw new ArgusUserAlreadyExistsError();
    return toArgusUserResponse(user);
  }

  async updateUser(userId: string, input: UpdateArgusUserBody): Promise<ArgusUserResponse> {
    const user = await this.repo.updateUser(userId, input);
    if (!user) throw new ArgusUserNotFoundError(userId);
    return toArgusUserResponse(user);
  }

  async disableUser(userId: string): Promise<ArgusUserResponse> {
    const user = await this.repo.disableUser(userId);
    if (!user) throw new ArgusUserNotFoundError(userId);
    return toArgusUserResponse(user);
  }
}
