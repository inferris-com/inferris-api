import { RankAlreadyExistsError, RankNotFoundError } from "./rank.errors.js";
import { toRankResponse } from "./rank.mapper.js";
import type { RankPgRepository } from "./rank.pg-repository.js";
import type { RankResponse } from "./rank.response-types.js";
import type { CreateRankBody, ListRanksQuery, UpdateRankBody } from "./rank.schemas.js";

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
