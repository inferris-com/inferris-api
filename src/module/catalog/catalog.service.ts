import {
  toBadgeResponse,
  toGroupResponse,
  toRankResponse,
} from "@/module/catalog/catalog.mapper.js";
import type { CatalogPgRepository } from "@/module/catalog/catalog.pg-repository.js";
import type {
  BadgeResponse,
  GroupResponse,
  RankResponse,
} from "@/module/catalog/catalog.response-types.js";
import type {
  ListBadgesQuery,
  ListGroupsQuery,
  ListRanksQuery,
} from "@/module/catalog/catalog.schemas.js";

export class CatalogService {
  constructor(private readonly repo: CatalogPgRepository) {}

  async listGroups(query: ListGroupsQuery): Promise<GroupResponse[]> {
    return (await this.repo.listGroups(query)).map(toGroupResponse);
  }

  async listRanks(query: ListRanksQuery): Promise<RankResponse[]> {
    return (await this.repo.listRanks(query)).map(toRankResponse);
  }

  async listBadges(query: ListBadgesQuery): Promise<BadgeResponse[]> {
    return (await this.repo.listBadges(query)).map(toBadgeResponse);
  }
}
