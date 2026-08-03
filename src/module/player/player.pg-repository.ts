import { type Kysely, sql } from "kysely";

import type { DB } from "@/db/types.js";
import type { PlayerFlagDefinition } from "@/module/player/player-flags.js";
import type {
  CreatePlayerResult,
  DeletePlayerOptions,
  PlayerDetailsRecord,
  PlayerProfileRow,
  PlayerRepository,
} from "@/module/player/player.repository.js";
import type {
  CreatePlayerBody,
  CreatePlayerBadgeAssignmentBody,
  ListPlayersQuery,
  ReplaceRankAssignmentInput,
  SearchPlayersQuery,
  UpdatePlayerBody,
  UpdateProfileBody,
} from "@/module/player/player.schemas.js";
import type { DbExecutor } from "@/db/index.js";
import { isPgErrorCode, PgErrorCode } from "@/shared/db/pg-error.utils.js";

export class PlayerPgRepository implements PlayerRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listPlayers({ limit, offset, username }: ListPlayersQuery) {
    return this.db
      .selectFrom("players")
      .select([
        "players.id",
        "players.mojang_id",
        "players.actor_id",
        "players.username",
        "players.flags",
        "players.orbs",
        "players.active_channel_key",
      ])
      .$if(username !== undefined, (qb) => qb.where("players.username", "ilike", `%${username}%`))
      .where("players.deleted_at_ms", "is", null)
      .orderBy("players.username", "asc")
      .limit(limit)
      .offset(offset)
      .execute();
  }

  async searchPlayers({ q, limit, sensitive }: SearchPlayersQuery) {
    const pattern = `%${q}%`;
    const prefixPattern = `${q}%`;

    return this.db
      .selectFrom("players")
      .leftJoin("player_nicknames as active_nicknames", (join) =>
        join
          .onRef("active_nicknames.player_id", "=", "players.id")
          .on("active_nicknames.is_active", "=", true),
      )
      .select([
        "players.id",
        "players.mojang_id",
        "players.actor_id",
        "players.username",
        "players.deleted_at_ms",
        "active_nicknames.nickname as active_nickname",
        "active_nicknames.cover_rank_key as active_nickname_cover_rank_key",
      ])
      .where("players.username", "ilike", pattern)
      .$if(!sensitive, (qb) => qb.where("players.deleted_at_ms", "is", null))
      .orderBy(
        sql<number>`case
          when lower(players.username) = lower(${q}) then 0
          when players.username ilike ${prefixPattern} then 1
          else 2
        end`,
        "asc",
      )
      .orderBy("players.username", "asc")
      .orderBy("players.id", "asc")
      .limit(limit)
      .execute();
  }

  async listFlagDefinitions(includeInactive: boolean): Promise<PlayerFlagDefinition[]> {
    return this.db
      .selectFrom("player_flag_definitions")
      .selectAll()
      .$if(!includeInactive, (qb) => qb.where("is_active", "=", true))
      .orderBy("bit_position", "asc")
      .execute();
  }

  async findPlayerById(id: string): Promise<PlayerDetailsRecord | null> {
    return this.loadPlayerDetails(this.db, id);
  }

  async findProfileByPlayerId(id: string): Promise<PlayerProfileRow | null> {
    return await this.db.transaction().execute(async (trx) => {
      const profile = await trx
        .selectFrom("player_profiles")
        .selectAll()
        .where("player_id", "=", id)
        .executeTakeFirst();

      if (!profile) return null;

      return profile;
    });
  }

  async listBadgeAssignments(playerId: string) {
    return this.db.transaction().execute(async (trx) => {
      const playerExists = await trx
        .selectFrom("players")
        .select("id")
        .where("id", "=", playerId)
        .where("deleted_at_ms", "is", null)
        .executeTakeFirst();

      if (!playerExists) {
        return null;
      }

      return await trx
        .selectFrom("player_badges")
        .selectAll()
        .where("player_id", "=", playerId)
        .orderBy("badge_id", "asc")
        .execute();
    });
  }

  async createPlayer(input: CreatePlayerBody): Promise<CreatePlayerResult> {
    return this.db.transaction().execute(async (trx) => {
      const { username, flags, chatChannel } = input;

      const existingPlayer = await trx
        .selectFrom("players")
        .select(["id", "deleted_at_ms"])
        .where("mojang_id", "=", input.mojangId)
        .executeTakeFirst();

      if (existingPlayer && existingPlayer.deleted_at_ms === null) {
        return { status: "player_exists" };
      }

      const existingActor = await trx
        .selectFrom("actors")
        .select("id")
        .where("name", "=", username)
        .executeTakeFirst();

      const actor =
        existingActor ??
        (await trx
          .insertInto("actors")
          .values({ name: username, type: "user" })
          .returning("id")
          .executeTakeFirstOrThrow());

      const playerInsert: {
        id?: string;
        mojang_id: string;
        actor_id: string;
        username: string;
        flags: string;
        orbs?: string;
        active_channel_key: CreatePlayerBody["chatChannel"];
      } = {
        ...(input.id ? { id: input.id } : {}),
        mojang_id: input.mojangId,
        actor_id: actor.id,
        username,
        flags,
        active_channel_key: chatChannel,
      };

      if (input.orbs !== undefined) {
        playerInsert.orbs = input.orbs;
      }

      if (existingPlayer) {
        await trx
          .updateTable("players")
          .set({
            ...playerInsert,
            deleted_at_ms: null,
            deleted_reason: null,
          })
          .where("id", "=", existingPlayer.id)
          .executeTakeFirstOrThrow();
      } else {
        await trx.insertInto("players").values(playerInsert).executeTakeFirstOrThrow();
      }

      const playerId =
        existingPlayer?.id ??
        input.id ??
        (
          await trx
            .selectFrom("players")
            .select("id")
            .where("mojang_id", "=", input.mojangId)
            .executeTakeFirstOrThrow()
        ).id;

      await trx
        .insertInto("player_profiles")
        .values({ player_id: playerId })
        .onConflict((oc) => oc.column("player_id").doNothing())
        .executeTakeFirstOrThrow();

      return { status: "created", player: await this.loadPlayerDetailsOrThrow(trx, playerId) };
    });
  }

  async ensureMinecraftPlayerIdentity(input: {
    mojangId: string;
    username: string;
    serverId: string;
  }) {
    return this.db.transaction().execute(async (trx) => {
      const existing = await trx
        .selectFrom("players")
        .select(["id", "mojang_id", "actor_id", "username"])
        .where("mojang_id", "=", input.mojangId)
        .executeTakeFirst();

      if (existing) {
        await trx
          .updateTable("players")
          .set({
            username: input.username,
            last_seen_at_ms: sql`get_unix_ms()`,
            last_server_id: input.serverId,
            deleted_at_ms: null,
            deleted_reason: null,
          })
          .where("id", "=", existing.id)
          .execute();

        await trx
          .updateTable("actors")
          .set({ name: input.username, type: "user" })
          .where("id", "=", existing.actor_id)
          .execute();

        return { ...existing, username: input.username };
      }

      const existingActor = await trx
        .selectFrom("actors")
        .select("id")
        .where("name", "=", input.username)
        .executeTakeFirst();

      if (existingActor) {
        const playerForActor = await trx
          .selectFrom("players")
          .select(["id", "mojang_id", "actor_id", "username"])
          .where("actor_id", "=", existingActor.id)
          .executeTakeFirst();

        if (playerForActor) {
          await trx
            .updateTable("players")
            .set({
              mojang_id: input.mojangId,
              username: input.username,
              last_seen_at_ms: sql`get_unix_ms()`,
              last_server_id: input.serverId,
              deleted_at_ms: null,
              deleted_reason: null,
            })
            .where("id", "=", playerForActor.id)
            .execute();

          await trx
            .updateTable("actors")
            .set({ type: "user" })
            .where("id", "=", existingActor.id)
            .execute();

          await trx
            .insertInto("player_profiles")
            .values({ player_id: playerForActor.id })
            .onConflict((oc) => oc.column("player_id").doNothing())
            .execute();

          return {
            ...playerForActor,
            mojang_id: input.mojangId,
            username: input.username,
          };
        }
      }

      const actor =
        existingActor ??
        (await trx
          .insertInto("actors")
          .values({ name: input.username, type: "user" })
          .returning("id")
          .executeTakeFirstOrThrow());

      const player = await trx
        .insertInto("players")
        .values({
          mojang_id: input.mojangId,
          actor_id: actor.id,
          username: input.username,
          flags: "0",
          last_seen_at_ms: sql`get_unix_ms()`,
          last_server_id: input.serverId,
        })
        .returning(["id", "mojang_id", "actor_id", "username"])
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("player_profiles")
        .values({ player_id: player.id })
        .onConflict((oc) => oc.column("player_id").doNothing())
        .execute();

      return player;
    });
  }

  async getPlayerIdentityByMojangId(mojangId: string) {
    return this.db
      .selectFrom("players")
      .select(["id", "mojang_id", "actor_id", "username"])
      .where("mojang_id", "=", mojangId)
      .where("deleted_at_ms", "is", null)
      .executeTakeFirst();
  }

  async updatePlayer(id: string, input: UpdatePlayerBody): Promise<PlayerDetailsRecord | null> {
    return this.db.transaction().execute(async (trx) => {
      const playerExists = await trx
        .selectFrom("players")
        .select(["id", "actor_id"])
        .where("id", "=", id)
        .where("deleted_at_ms", "is", null)
        .executeTakeFirst();

      if (!playerExists) {
        return null;
      }

      const playerUpdate: {
        username?: string;
        flags?: string;
        orbs?: string;
        active_channel_key?: UpdatePlayerBody["chatChannel"];
      } = {};

      if (input.username !== undefined) {
        playerUpdate.username = input.username;

        await trx
          .updateTable("actors")
          .set({ name: input.username })
          .where("id", "=", playerExists.actor_id)
          .where("type", "=", "user")
          .execute();
      }

      if (input.flags !== undefined) {
        playerUpdate.flags = input.flags;
      }

      if (input.orbs !== undefined) {
        playerUpdate.orbs = input.orbs;
      }

      if (input.chatChannel !== undefined) {
        playerUpdate.active_channel_key = input.chatChannel;
      }

      if (Object.keys(playerUpdate).length > 0) {
        await trx
          .updateTable("players")
          .set(playerUpdate)
          .where("id", "=", id)
          .executeTakeFirstOrThrow();
      }

      return this.loadPlayerDetailsOrThrow(trx, id);
    });
  }

  async updateProfile(id: string, input: UpdateProfileBody) {
    return this.db.transaction().execute(async (trx) => {
      const profileUpdate: {
        bio?: string | null;
        pronouns?: string | null;
        featured_badge_id?: number | null;
        locale?: string;
        // preferences not implemented
      } = {};

      if (input.bio !== undefined) {
        profileUpdate.bio = input.bio;
      }
      if (input.pronouns !== undefined) {
        profileUpdate.pronouns = input.pronouns;
      }
      if (input.featured_badge_id !== undefined) {
        profileUpdate.featured_badge_id = input.featured_badge_id;
      }
      if (input.locale !== undefined) {
        profileUpdate.locale = input.locale;
      }
      // preferences not implemented

      return await trx
        .updateTable("player_profiles")
        .set(profileUpdate)
        .where("player_id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }

  async replaceRankAssignment(
    playerId: string,
    groupKey: string,
    rankKey: string,
    input: ReplaceRankAssignmentInput,
  ) {
    return this.db.transaction().execute(async (trx) => {
      const playerExists = await trx
        .selectFrom("players")
        .select("id")
        .where("id", "=", playerId)
        .where("deleted_at_ms", "is", null)
        .executeTakeFirst();

      if (!playerExists) {
        return null;
      }

      const assignmentValues = {
        source: input.source ?? null,
        assigned_by_actor_id: input.assignedByActorId ?? null,
      };

      return await trx
        .insertInto("player_ranks")
        .values({
          player_id: playerId,
          group_key: groupKey,
          rank_key: rankKey,
          ...assignmentValues,
        })
        .onConflict((oc) =>
          oc.columns(["player_id", "group_key"]).doUpdateSet({
            rank_key: rankKey,
            assigned_at_ms: sql`get_unix_ms()`,
            ...assignmentValues,
          }),
        )
        .returningAll()
        .executeTakeFirst();
    });
  }

  async createBadgeAssignment(playerId: string, input: CreatePlayerBadgeAssignmentBody) {
    return this.db.transaction().execute(async (trx) => {
      const playerExists = await trx
        .selectFrom("players")
        .select("id")
        .where("id", "=", playerId)
        .where("deleted_at_ms", "is", null)
        .executeTakeFirst();

      if (!playerExists) {
        return { status: "player_not_found" } as const;
      }

      const badgeExists = await trx
        .selectFrom("badges")
        .select("id")
        .where("id", "=", input.badgeId)
        .executeTakeFirst();

      if (!badgeExists) {
        return { status: "badge_not_found" } as const;
      }

      const badge = await trx
        .insertInto("player_badges")
        .values({
          player_id: playerId,
          badge_id: input.badgeId,
          source: input.source ?? null,
        })
        .onConflict((oc) =>
          oc.columns(["player_id", "badge_id"]).doUpdateSet({
            source: input.source ?? null,
          }),
        )
        .returningAll()
        .executeTakeFirstOrThrow();

      return { status: "assigned", badge } as const;
    });
  }

  async listNicknames(playerId: string) {
    return this.db.transaction().execute(async (trx) => {
      const playerExists = await trx
        .selectFrom("players")
        .select("id")
        .where("id", "=", playerId)
        .where("deleted_at_ms", "is", null)
        .executeTakeFirst();

      if (!playerExists) {
        return null;
      }

      return trx
        .selectFrom("player_nicknames")
        .selectAll()
        .where("player_id", "=", playerId)
        .orderBy("created_at_ms", "desc")
        .orderBy("id", "desc")
        .execute();
    });
  }

  async assignNickname(
    playerId: string,
    input: { nickname: string; coverRankKey: string | null; meta?: unknown },
  ) {
    return this.db.transaction().execute(async (trx) => {
      const playerExists = await trx
        .selectFrom("players")
        .select("id")
        .where("id", "=", playerId)
        .where("deleted_at_ms", "is", null)
        .executeTakeFirst();

      if (!playerExists) {
        return { status: "player_not_found" } as const;
      }

      if (input.coverRankKey !== null) {
        const rankExists = await trx
          .selectFrom("ranks")
          .select("key")
          .where("key", "=", input.coverRankKey)
          .executeTakeFirst();

        if (!rankExists) {
          return { status: "rank_not_found" } as const;
        }
      }

      const activeForPlayer = await trx
        .selectFrom("player_nicknames")
        .select("id")
        .where("player_id", "=", playerId)
        .where("is_active", "=", true)
        .executeTakeFirst();

      if (activeForPlayer) {
        const updated = await trx
          .updateTable("player_nicknames")
          .set({
            nickname: input.nickname,
            cover_rank_key: input.coverRankKey,
            meta: JSON.stringify(input.meta ?? {}),
          })
          .where("id", "=", activeForPlayer.id)
          .returningAll()
          .executeTakeFirstOrThrow();

        return { status: "assigned", nickname: updated } as const;
      }

      try {
        const nickname = await trx
          .insertInto("player_nicknames")
          .values({
            player_id: playerId,
            nickname: input.nickname,
            cover_rank_key: input.coverRankKey,
            meta: JSON.stringify(input.meta ?? {}),
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        return { status: "assigned", nickname } as const;
      } catch (error) {
        if (isPgErrorCode(error, PgErrorCode.UniqueViolation)) {
          return { status: "nickname_conflict" } as const;
        }

        throw error;
      }
    });
  }

  async revokeActiveNickname(playerId: string, revokedByActorId: string) {
    return this.db.transaction().execute(async (trx) => {
      const playerExists = await trx
        .selectFrom("players")
        .select("id")
        .where("id", "=", playerId)
        .where("deleted_at_ms", "is", null)
        .executeTakeFirst();

      if (!playerExists) {
        return { status: "player_not_found" } as const;
      }

      const nickname = await trx
        .updateTable("player_nicknames")
        .set({
          is_active: false,
          revoked_by_actor_id: revokedByActorId,
          revoked_at_ms: sql`get_unix_ms()`,
        })
        .where("player_id", "=", playerId)
        .where("is_active", "=", true)
        .returningAll()
        .executeTakeFirst();

      return nickname
        ? ({ status: "revoked", nickname } as const)
        : ({ status: "nickname_not_found" } as const);
    });
  }

  async deletePlayer(id: string, { hard }: DeletePlayerOptions): Promise<boolean> {
    if (hard) {
      const result = await this.db.deleteFrom("players").where("id", "=", id).executeTakeFirst();
      return result.numDeletedRows > 0n;
    }

    return this.db.transaction().execute(async (trx) => {
      const result = await trx
        .updateTable("players")
        .set({
          deleted_at_ms: sql`get_unix_ms()`,
          deleted_reason: "api_delete",
        })
        .where("id", "=", id)
        .where("deleted_at_ms", "is", null)
        .executeTakeFirst();

      if (result.numUpdatedRows === 0n) {
        return false;
      }

      await Promise.all([
        trx.deleteFrom("player_badges").where("player_id", "=", id).execute(),
        trx.deleteFrom("player_ranks").where("player_id", "=", id).execute(),
        trx.deleteFrom("player_profiles").where("player_id", "=", id).execute(),
      ]);

      return true;
    });
  }

  async deleteRankAssignment(
    playerId: string,
    groupKey: string,
    rankKey: string,
  ): Promise<boolean> {
    return this.db.transaction().execute(async (trx) => {
      const result = await trx
        .deleteFrom("player_ranks")
        .where("player_id", "=", playerId)
        .where("group_key", "=", groupKey)
        .where("rank_key", "=", rankKey)
        .executeTakeFirst();

      return result.numDeletedRows > 0n;
    });
  }

  async deleteBadgeAssignment(playerId: string, badgeId: number) {
    return this.db.transaction().execute(async (trx) => {
      const playerExists = await trx
        .selectFrom("players")
        .select("id")
        .where("id", "=", playerId)
        .where("deleted_at_ms", "is", null)
        .executeTakeFirst();

      if (!playerExists) {
        return { status: "player_not_found" } as const;
      }

      const result = await trx
        .deleteFrom("player_badges")
        .where("player_id", "=", playerId)
        .where("badge_id", "=", badgeId)
        .executeTakeFirst();

      if (result.numDeletedRows === 0n) {
        return { status: "badge_not_found" } as const;
      }

      return { status: "deleted" } as const;
    });
  }

  private async loadPlayerDetails(
    executor: DbExecutor,
    id: string,
  ): Promise<PlayerDetailsRecord | null> {
    const player = await executor
      .selectFrom("players")
      .leftJoin("player_nicknames as active_nicknames", (join) =>
        join
          .onRef("active_nicknames.player_id", "=", "players.id")
          .on("active_nicknames.is_active", "=", true),
      )
      .select([
        "players.id",
        "players.mojang_id",
        "players.actor_id",
        "players.username",
        "players.flags",
        "players.orbs",
        "players.active_channel_key",
        "players.created_at_ms",
        "players.last_seen_at_ms",
        "players.last_server_id",
        "active_nicknames.nickname as active_nickname",
        "active_nicknames.cover_rank_key as active_nickname_cover_rank_key",
      ])
      .where("players.id", "=", id)
      .where("players.deleted_at_ms", "is", null)
      .executeTakeFirst();

    if (!player) {
      return null;
    }

    const [profile, rankAssignments, badgeAssignments] = await Promise.all([
      executor
        .selectFrom("player_profiles")
        .select(["bio", "pronouns", "featured_badge_id", "locale", "preferences"])
        .where("player_id", "=", id)
        .executeTakeFirst(),
      executor
        .selectFrom("player_ranks")
        .innerJoin("groups", "groups.key", "player_ranks.group_key")
        .select(["group_key", "rank_key"])
        .where("player_id", "=", id)
        .orderBy("groups.priority", "desc")
        .orderBy("group_key", "asc")
        .orderBy("rank_key", "asc")
        .execute(),
      executor
        .selectFrom("player_badges")
        .select("badge_id")
        .where("player_id", "=", id)
        .orderBy("badge_id", "asc")
        .execute(),
    ]);

    return {
      player,
      profile: profile ?? null,
      rankAssignments,
      badgeAssignments,
    };
  }

  private async loadPlayerDetailsOrThrow(
    executor: DbExecutor,
    id: string,
  ): Promise<PlayerDetailsRecord> {
    const player = await this.loadPlayerDetails(executor, id);

    if (!player) {
      throw new Error(`Expected player ${id} to exist after repository write.`);
    }

    return player;
  }
}
