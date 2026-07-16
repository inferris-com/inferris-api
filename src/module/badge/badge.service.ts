import { BadgeAlreadyExistsError, BadgeNotFoundError } from "./badge.errors.js";
import { toBadgeResponse } from "./badge.mapper.js";
import type { BadgePgRepository } from "./badge.pg-repository.js";
import type { BadgeResponse } from "./badge.response-types.js";
import type { CreateBadgeBody, ListBadgesQuery, UpdateBadgeBody } from "./badge.schemas.js";

export class BadgeService {
  constructor(private readonly repo: BadgePgRepository) {}

  async listBadges(query: ListBadgesQuery): Promise<BadgeResponse[]> {
    return (await this.repo.listBadges(query)).map(toBadgeResponse);
  }

  async getBadge(badgeId: number): Promise<BadgeResponse> {
    const badge = await this.repo.findBadgeById(badgeId);

    if (!badge) {
      throw new BadgeNotFoundError(badgeId);
    }

    return toBadgeResponse(badge);
  }

  async createBadge(input: CreateBadgeBody): Promise<BadgeResponse> {
    const badge = await this.repo.createBadge(input);

    if (!badge) {
      throw new BadgeAlreadyExistsError(input.key);
    }

    return toBadgeResponse(badge);
  }

  async updateBadge(badgeId: number, input: UpdateBadgeBody): Promise<BadgeResponse> {
    const badge = await this.repo.updateBadge(badgeId, input);

    if (!badge) {
      throw new BadgeNotFoundError(badgeId);
    }

    return toBadgeResponse(badge);
  }

  async deleteBadge(badgeId: number): Promise<void> {
    if (!(await this.repo.deleteBadge(badgeId))) {
      throw new BadgeNotFoundError(badgeId);
    }
  }
}
