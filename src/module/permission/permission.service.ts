import type { PermissionPgRepository } from "./permission.pg-repository.js";
import type { CreatePermissionNodeBody, ReplacePermissionRuleBody } from "./permission.schemas.js";
import {
  PermissionKeyAlreadyExistsError,
  PermissionKeyNotFoundError, PermissionRuleNotFoundError,
} from "./permission.errors.js";
import { RankNotFoundError } from "../player/player.errors.js";
import { toPermissionNodeResponse, toPermissionRuleResponse} from "./permission.mapper.js";

export class PermissionService {
  constructor(private readonly repo: PermissionPgRepository) {}

  async createPermissionNode(input: CreatePermissionNodeBody) {
    const permissionNode = await this.repo.createPermissionNode(input);

    if (permissionNode.status === "conflict") {
      throw new PermissionKeyAlreadyExistsError(input.key);
    }

    return toPermissionNodeResponse(permissionNode.data);
  }

  async replacePermissionRule(
    permissionKey: string,
    minRankKey: string,
    input: ReplacePermissionRuleBody,
  ) {
    const permissionRule = await this.repo.replacePermissionRule(permissionKey, minRankKey, input);

    if (permissionRule.status === "permission_key_not_found") {
      throw new PermissionKeyNotFoundError(permissionKey);
    }
    if (permissionRule.status === "min_rank_key_not_found") {
      throw new RankNotFoundError(minRankKey);
    }

    return toPermissionRuleResponse(permissionRule.rule);
  }

  async findPermissionByKey(key: string) {
    const permissionNode = await this.repo.findPermissionNodeByKey(key);

    if(!permissionNode){
      throw new PermissionKeyNotFoundError(key);
    }

    return toPermissionNodeResponse(permissionNode);
  }

  async findPermissionRuleByMinRank(permissionKey: string){
    const permissionRule = await this.repo.findPermissionRuleByMinRank(permissionKey);

    if(!permissionRule){
      throw new PermissionRuleNotFoundError(permissionKey);
    }

    return toPermissionRuleResponse(permissionRule);
  }
}
