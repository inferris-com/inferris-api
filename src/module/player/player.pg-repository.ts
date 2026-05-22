import {type Kysely, sql, type Transaction} from "kysely";

import type {DB} from "../../db/types.js";
import type {
  CreatePlayerResult,
  DeletePlayerOptions,
  PlayerDetailsRecord,
  PlayerProfileRow,
  PlayerRepository,
} from "./player.repository.js";
import type {CreatePlayerBody, ListPlayersQuery, UpdatePlayerBody, UpdateProfileBody,} from "./player.schemas.js";

type DbExecutor = Kysely<DB> | Transaction<DB>;

export class PlayerPgRepository implements PlayerRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listPlayers({ limit, offset, username }: ListPlayersQuery) {
    return this.db
      .selectFrom("players")
      .select([
        "players.id",
        "players.username",
        "players.flags",
        "players.orbs",
        "players.chat_channel",
      ])
      .$if(username !== undefined, (qb) => qb.where("players.username", "ilike", `%${username}%`))
      .where("players.deleted_at_ms", "is", null)
      .orderBy("players.username", "asc")
      .limit(limit)
      .offset(offset)
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

      if(!profile) return null;

      return profile;
    })
  }

  async createPlayer(input: CreatePlayerBody): Promise<CreatePlayerResult> {
    return this.db.transaction().execute(async (trx) => {
      const { id, username, flags, chatChannel } = input;

      const existingPlayer = await trx
        .selectFrom("players")
        .select(["id", "deleted_at_ms"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (existingPlayer && existingPlayer.deleted_at_ms === null) {
        return { status: "player_exists" };
      }

      const playerInsert: {
        id: string;
        username: string;
        flags: string;
        orbs?: string;
        chat_channel: CreatePlayerBody["chatChannel"];
      } = {
        id,
        username,
        flags,
        chat_channel: chatChannel,
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
          .where("id", "=", id)
          .executeTakeFirstOrThrow();
      } else {
        await trx.insertInto("players").values(playerInsert).executeTakeFirstOrThrow();
      }

      await trx
        .insertInto("player_profiles")
        .values({ player_id: id })
        .onConflict((oc) => oc.column("player_id").doNothing())
        .executeTakeFirstOrThrow();

      const linkedActor = await trx
        .selectFrom("actors")
        .select("id")
        .where("player_id", "=", id)
        .executeTakeFirst();

      const unlinkedActor = await trx
        .selectFrom("actors")
        .select("id")
        .where("name", "=", username)
        .where("player_id", "is", null)
        .executeTakeFirst();

      if (linkedActor) {
        await trx
          .updateTable("actors")
          .set({ name: username, type: "user" })
          .where("id", "=", linkedActor.id)
          .executeTakeFirstOrThrow();
      } else if (unlinkedActor) {
        await trx
          .updateTable("actors")
          .set({ player_id: id, type: "user" })
          .where("id", "=", unlinkedActor.id)
          .executeTakeFirstOrThrow();
      } else {
        await trx
          .insertInto("actors")
          .values({ name: username, type: "user", player_id: id })
          .executeTakeFirstOrThrow();
      }

      return { status: "created", player: await this.loadPlayerDetailsOrThrow(trx, id) };
    });
  }

  async updatePlayer(id: string, input: UpdatePlayerBody): Promise<PlayerDetailsRecord | null> {
    return this.db.transaction().execute(async (trx) => {
      const playerExists = await trx
        .selectFrom("players")
        .select("id")
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
        chat_channel?: UpdatePlayerBody["chatChannel"];
      } = {};

      if (input.username !== undefined) {
        playerUpdate.username = input.username;

        await trx
          .updateTable("actors")
          .set({ name: input.username })
          .where("player_id", "=", id)
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
        playerUpdate.chat_channel = input.chatChannel;
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

  async replaceRankAssignment(playerId: string, groupKey: string, rankKey: string) {
    return this.db.transaction().execute(async (trx) => {
      const assignmentExists = await trx
        .selectFrom('player_ranks')
        .where("player_id", "=", playerId)
        .where("group_key", "=", groupKey)
        .where("rank_key", "=", rankKey)
        .executeTakeFirst();

      if(assignmentExists){
        return await trx
          .updateTable('player_ranks')
          .set('group_key', groupKey)
          .set("rank_key", rankKey)
          .where("player_id", "=", playerId)
          .where("group_key", "=", groupKey)
          .where("rank_key", "=", rankKey)
          .returningAll()
          .executeTakeFirst();
      }else{
        return await trx
          .insertInto("player_ranks")
          .values({player_id: playerId, group_key: groupKey, rank_key: rankKey})
          .executeTakeFirst();
      }
    })
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

  async deleteRankAssignment(playerId: string, groupKey: string, rankKey: string) {
    return this.db.transaction().execute(async (trx) => {
      return await trx
        .deleteFrom("player_ranks")
        .where("player_id", "=", playerId)
        .where("group_key", "=", groupKey)
        .where("rank_key", "=", rankKey)
        .executeTakeFirst();
    })
  }

  private async loadPlayerDetails(
    executor: DbExecutor,
    id: string,
  ): Promise<PlayerDetailsRecord | null> {
    const player = await executor
      .selectFrom("players")
      .select([
        "id",
        "username",
        "flags",
        "orbs",
        "chat_channel",
        "created_at_ms",
        "last_seen_at_ms",
        "last_server_id",
      ])
      .where("id", "=", id)
      .where("deleted_at_ms", "is", null)
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
        .select(["group_key", "rank_key"])
        .where("player_id", "=", id)
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
