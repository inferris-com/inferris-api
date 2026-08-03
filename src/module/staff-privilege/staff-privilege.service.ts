import type { PaginatedResult } from "@/shared/pagination.schemas.js";
import { StaffPrivilegeNotFoundError } from "@/module/staff-privilege/staff-privilege.errors.js";
import { toStaffPrivilegeResponse } from "@/module/staff-privilege/staff-privilege.mapper.js";
import type { StaffPrivilegePgRepository } from "@/module/staff-privilege/staff-privilege.pg-repository.js";
import type { StaffPrivilegeResponse } from "@/module/staff-privilege/staff-privilege.response-types.js";
import type {
  CreateStaffPrivilegeBody,
  ListStaffPrivilegesQuery,
  UpdateStaffPrivilegeBody,
} from "@/module/staff-privilege/staff-privilege.schemas.js";

export class StaffPrivilegeService {
  constructor(private readonly repo: StaffPrivilegePgRepository) {}

  async listPrivileges(
    query: ListStaffPrivilegesQuery,
  ): Promise<PaginatedResult<StaffPrivilegeResponse>> {
    const result = await this.repo.listPrivileges(query);
    return { ...result, rows: result.rows.map(toStaffPrivilegeResponse) };
  }

  async getPrivilege(privilegeId: string): Promise<StaffPrivilegeResponse> {
    const privilege = await this.repo.findPrivilegeById(privilegeId);
    if (!privilege) throw new StaffPrivilegeNotFoundError(privilegeId);
    return toStaffPrivilegeResponse(privilege);
  }

  async listPrivilegesByActorId(actorId: string): Promise<StaffPrivilegeResponse[]> {
    return (await this.repo.listPrivilegesByActorId(actorId)).map(toStaffPrivilegeResponse);
  }

  async createPrivilege(
    input: CreateStaffPrivilegeBody,
    enrolledByActorId: string | null,
  ): Promise<StaffPrivilegeResponse> {
    return toStaffPrivilegeResponse(await this.repo.createPrivilege(input, enrolledByActorId));
  }

  async updatePrivilege(
    privilegeId: string,
    input: UpdateStaffPrivilegeBody,
  ): Promise<StaffPrivilegeResponse> {
    const privilege = await this.repo.updatePrivilege(privilegeId, input);
    if (!privilege) throw new StaffPrivilegeNotFoundError(privilegeId);
    return toStaffPrivilegeResponse(privilege);
  }

  async revokePrivilege(
    privilegeId: string,
    revokedByActorId: string | null,
  ): Promise<StaffPrivilegeResponse> {
    const privilege = await this.repo.revokePrivilege(privilegeId, revokedByActorId);
    if (!privilege) throw new StaffPrivilegeNotFoundError(privilegeId);
    return toStaffPrivilegeResponse(privilege);
  }
}
