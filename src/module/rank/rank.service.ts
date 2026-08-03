import { RankAlreadyExistsError, RankNotFoundError } from "@/module/rank/rank.errors.js";
import { toRankResponse } from "@/module/rank/rank.mapper.js";
import type { RankPgRepository } from "@/module/rank/rank.pg-repository.js";
import type { RankResponse } from "@/module/rank/rank.response-types.js";
import type { CreateRankBody, ListRanksQuery, UpdateRankBody } from "@/module/rank/rank.schemas.js";

export class RankService {
  constructor(private readonly repo: RankPgRepository) {}

  async listRanks(query: ListRanksQuery): Promise<RankResponse[]> {
    return (await this.repo.listRanks(query)).map(toRankResponse);
  }

  async getRank(rankKey: string): Promise<RankResponse> {
    const rank = await this.repo.findRankByKey(rankKey);

    if (!rank) {
      throw new RankNotFoundError(rankKey);
    }

    return toRankResponse(rank);
  }

  async createRank(input: CreateRankBody): Promise<RankResponse> {
    const rank = await this.repo.createRank(input);

    if (!rank) {
      throw new RankAlreadyExistsError(input.key);
    }

    return toRankResponse(rank);
  }

  async updateRank(rankKey: string, input: UpdateRankBody): Promise<RankResponse> {
    const rank = await this.repo.updateRank(rankKey, input);

    if (!rank) {
      throw new RankNotFoundError(rankKey);
    }

    return toRankResponse(rank);
  }

  async deleteRank(rankKey: string): Promise<void> {
    if (!(await this.repo.deleteRank(rankKey))) {
      throw new RankNotFoundError(rankKey);
    }
  }
}
