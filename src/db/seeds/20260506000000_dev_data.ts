import type { Kysely } from "kysely";
import type { Seed } from "kysely-ctl";

import type { DB } from "../types.js";

const ids = {
  api_keys: {
    dev: "00000000-0000-0000-0000-000000000000",
  },

  badges: {
    ghost: 1,
    dev: 2,
    supporter: 3,
    bugHunter: 4,
    tester: 5,
    inactive: 6,
  },

  servers: {
    velocity: "00000000-0000-0000-0000-000000000000",
    lobby: "00000000-0000-0000-0000-000000000001",
    lockdownMinigames: "00000000-0000-0000-0000-000000000002",
    devMinRank: "00000000-0000-0000-0000-000000000003",
    devPermission: "00000000-0000-0000-0000-000000000004",
  },

  permissions: {
    serverAccessDev2: "10000000-0000-0000-0000-000000000001",
    serverAccessAll: "10000000-0000-0000-0000-000000000002",
    lockdownBypass: "10000000-0000-0000-0000-000000000003",
  },

  actors: {
    system: "00000000-0000-0000-0000-000000000000",
    seed: "20000000-0000-0000-0000-000000000001",
    dummy: "00000000-0000-0000-0000-000000000001",
    refrizor: "7d16b15d-bb22-4a6d-80db-6213b3d75007",
  },

  players: {
    dummy: "00000000-0000-0000-0000-000000000001",
    refrizor: "7d16b15d-bb22-4a6d-80db-6213b3d75007",
  },
} as const;

const seed = {
  async seed(db: Kysely<DB>) {
    await db
      .insertInto("groups")
      .values([
        {
          key: "staff",
          label: "Staff",
          priority: 100,
          is_staff: true,
        },
        {
          key: "patron",
          label: "Patron",
          priority: 10,
          is_staff: false,
        },
      ])
      .execute();

    await db
      .insertInto("ranks")
      .values([
        {
          key: "moderator",
          group_key: "staff",
          label: "Moderator",
          tier: 1,
          is_staff: true,
          is_active: true,
        },
        {
          key: "admin",
          group_key: "staff",
          label: "Admin",
          tier: 2,
          is_staff: true,
          is_active: true,
        },
        {
          key: "supporter_i",
          group_key: "patron",
          label: "Supporter (I)",
          tier: 1,
          is_staff: false,
          is_active: true,
        },
      ])
      .execute();

    await db
      .insertInto("permission_nodes")
      .values([
        {
          id: ids.permissions.serverAccessDev2,
          key: "server.access.dev2",
          description: "Allows access to development server #2.",
          category: "development",
          is_active: true,
        },
        {
          id: ids.permissions.serverAccessAll,
          key: "server.access.*",
          description: "Allows access to all restricted servers.",
          category: "administration",
          is_active: true,
        },
        {
          id: ids.permissions.lockdownBypass,
          key: "server.lockdown.bypass",
          description: "Allows bypassing server lockdown restrictions.",
          category: "administration",
          is_active: true,
        },
      ])
      .execute();

    await db
      .insertInto("permission_rules")
      .values([
        {
          permission_id: ids.permissions.serverAccessDev2,
          rank_key: "admin",
          min_rank_tier: 100,
          effect: "allow",
          priority: 100,
        },
        {
          permission_id: ids.permissions.serverAccessAll,
          rank_key: "admin",
          min_rank_tier: 100,
          effect: "allow",
          priority: 100,
        },
        {
          permission_id: ids.permissions.lockdownBypass,
          rank_key: "admin",
          min_rank_tier: 100,
          effect: "allow",
          priority: 100,
        },
      ])
      .execute();

    await db
      .insertInto("actors")
      .values([
        {
          id: ids.actors.system,
          name: "System",
          type: "system",
        },
        {
          id: ids.actors.seed,
          name: "Seed Script",
          type: "application",
        },
        {
          id: ids.actors.dummy,
          name: "Dummy User",
          type: "user",
        },
        {
          id: ids.actors.refrizor,
          name: "Refrizor",
          type: "user",
        },
      ])
      .execute();

    await db
      .insertInto("api_keys")
      .values([
        {
          id: ids.api_keys.dev,
          permissions: [],
          owner_actor_id: ids.actors.seed,
          created_by_actor_id: ids.actors.seed,
          can_bypass_rate_limit: true,
          is_active: true,
          is_super_key: true,
        },
      ])
      .execute();

    await db
      .insertInto("servers")
      .values([
        {
          id: ids.servers.velocity,
          name: "Velocity Proxy",
          type: "velocity",
          environment: "development",
          status: "offline",
          version: "development",
        },
        {
          id: ids.servers.lobby,
          name: "Lobby",
          type: "paper",
          environment: "development",
          status: "offline",
          version: "development",
        },
        {
          id: ids.servers.lockdownMinigames,
          name: "Minigames (Lockdown)",
          type: "paper",
          environment: "development",
          status: "offline",
          version: "development",
        },
        {
          id: ids.servers.devMinRank,
          name: "Development server #1 (min rank)",
          type: "paper",
          environment: "development",
          status: "offline",
          version: "development",
        },
        {
          id: ids.servers.devPermission,
          name: "Development server #2 (min perm)",
          type: "paper",
          environment: "development",
          status: "offline",
          version: "development",
        },
      ])
      .execute();

    await db
      .insertInto("server_access_policies")
      .values([
        {
          server_id: ids.servers.velocity,
          mode: "open",
          note: "Proxy is open in development.",
        },
        {
          server_id: ids.servers.lobby,
          mode: "open",
          note: "Lobby is open in development.",
        },
        {
          server_id: ids.servers.lockdownMinigames,
          mode: "open",
          note: "Normally open, but covered by a local lockdown seed.",
        },
        {
          server_id: ids.servers.devMinRank,
          mode: "min_rank",
          required_rank_key: "admin",
          note: "Requires admin rank.",
        },
        {
          server_id: ids.servers.devPermission,
          mode: "permission",
          required_permission_id: ids.permissions.serverAccessDev2,
          note: "Requires server.access.dev2.",
        },
      ])
      .execute();

    await db
      .insertInto("lockdowns")
      .values({
        scope: "local",
        server_id: ids.servers.lockdownMinigames,
        required_rank_key: "admin",
        reason: "Dev testing",
        issued_by_actor_id: ids.actors.seed,
        is_active: true,
      })
      .execute();

    await db
      .insertInto("badges")
      .values([
        {
          id: ids.badges.dev,
          key: "developer",
          label: "Developer",
          description: "Inferris Development Team",
          color: "#7247ff",
          emoji: "🛠",
          display_order: 100,
          is_active: true,
        },
        {
          id: ids.badges.supporter,
          key: "supporter",
          label: "Supporter",
          description: "Obtained by donations or other support methods",
          color: "#ffe733",
          emoji: "❤",
          display_order: 5,
          is_active: true,
        },
        {
          id: ids.badges.bugHunter,
          key: "bug_hunter",
          label: "Bug Hunter",
          description: null,
          color: "#59ff91",
          emoji: "🐞",
          display_order: 2,
          is_active: true,
        },
        {
          id: ids.badges.tester,
          key: "tester",
          label: "Tester",
          description: "Be a tester! <3",
          color: "#94ffe2",
          emoji: "🧪",
          display_order: 1,
          is_active: true,
        },
        {
          id: ids.badges.ghost,
          key: "ghost_user",
          label: "Ghost User",
          description:
            "This account isn’t real, but it helps keep things running smoothly. Boo-tifully harmless!",
          color: "#dbc1c1",
          emoji: "👻",
          display_order: 50,
          is_active: true,
        },
        {
          id: ids.badges.inactive,
          key: "inactive_badge",
          label: "Inactive Badge",
          description: "This badge is intentionally inactive for dev testing.",
          color: "#dbc1c1",
          emoji: "-",
          display_order: 0,
          is_active: false,
        },
      ])
      .execute();

    await db
      .insertInto("players")
      .values([
        {
          id: ids.players.dummy,
          username: "Dummy",
          flags: 33792,
          orbs: 0,
          chat_channel: "testing",
        },
        {
          id: ids.players.refrizor,
          username: "Refrizor",
          flags: 3,
          orbs: 500,
          chat_channel: "global",
        },
      ])
      .execute();

    await db
      .insertInto("player_ranks")
      .values([
        {
          player_id: ids.players.refrizor,
          group_key: "staff",
          rank_key: "admin",
        },
      ])
      .execute();

    await db
      .insertInto("player_profiles")
      .values([
        {
          player_id: ids.players.dummy,
          bio: "<red>Test bio!</red>", // Adventure API colors
          locale: "en_US",
        },
        {
          player_id: ids.players.refrizor,
          locale: "en_US",
        },
      ])
      .execute();

    await db
      .insertInto("player_badges")
      .values([
        {
          player_id: ids.players.dummy,
          badge_id: ids.badges.inactive,
          source: "Seeding",
        },
      ])
      .execute();

    await db
      .insertInto("player_flag_definitions")
      .values([
        {
          flag_key: "STAFF",
          bit_position: 0,
          label: "Staff",
          description: "Player is a staff member",
        },
        {
          flag_key: "VANISHED",
          bit_position: 1,
          label: "Vanished",
          description: "Player is currently vanished",
        },
        {
          flag_key: "NICKED",
          bit_position: 2,
          label: "Nicked",
          description: "Player is currently nicked",
        },
        {
          flag_key: "MUTED",
          bit_position: 3,
          label: "Muted",
          description: "Player is currently muted",
        },
        {
          flag_key: "BANNED",
          bit_position: 4,
          label: "Banned",
          description: "Player is currently banned",
        },
        {
          flag_key: "DISABLED",
          bit_position: 5,
          label: "Disabled",
          description: "Account is disabled",
        },
        {
          flag_key: "DELETED",
          bit_position: 6,
          label: "Deleted",
          description: "Account deleted",
        },
        {
          flag_key: "SYSTEM",
          bit_position: 7,
          label: "System",
          description: "System player account",
        },
        {
          flag_key: "UNREAD_PUNISHMENTS",
          bit_position: 8,
          label: "Unread Punishments",
          description: "Player has unread punishments",
        },
        {
          flag_key: "UNREAD_NOTIFICATIONS",
          bit_position: 9,
          label: "Unread Notifications",
          description: "Player has unread notifications",
        },
        {
          flag_key: "WATCHLISTED",
          bit_position: 10,
          label: "Watchlisted",
          description: "Player has an active staff watchlist entry",
        },
        {
          flag_key: "UNDER_INVESTIGATION",
          bit_position: 11,
          label: "Under Investigation",
          description: "Player is under moderation/administrative investigation",
        },
        {
          flag_key: "SPAMMER",
          bit_position: 12,
          label: "Spammer",
          description: "This player was flagged as a potential spammer",
        },
        {
          flag_key: "QUARANTINED",
          bit_position: 13,
          label: "Quarantined",
          description: "This player is quarantined",
        },
        {
          flag_key: "MIGRATING",
          bit_position: 14,
          label: "Migrating",
          description: "Player account is currently undergoing data migration",
        },
        {
          flag_key: "TEST_ACCOUNT",
          bit_position: 15,
          label: "Test Account",
          description: "This is a facade account used for development and testing",
        },
        {
          flag_key: "COLLABORATOR",
          bit_position: 50,
          label: "Collaborator",
          description: "Player is a collaborator",
        },
      ])
      .execute();

    await db
      .insertInto("player_watchlist_entries")
      .values([
        {
          subject_actor_id: ids.actors.dummy,
          added_by_actor_id: ids.actors.seed,
          reason: "Development fixture for watchlist filtering and staff activity alerts.",
        },
      ])
      .execute();

    await db
      .insertInto("chat_channels")
      .values([
        {
          key: "global",
          is_hidden: false,
          is_active: true,
        },
        {
          key: "staff",
          is_staff: true,
          is_hidden: false,
          is_active: true,
        },
      ])
      .execute();

    // Set any actor–player links

    const actorPlayerLinks = [
      {
        actorId: ids.actors.dummy,
        playerId: ids.players.dummy,
      },
      {
        actorId: ids.actors.refrizor,
        playerId: ids.players.refrizor,
      },
    ];

    for (const link of actorPlayerLinks) {
      await db
        .updateTable("actors")
        .set({ player_id: link.playerId })
        .where("id", "=", link.actorId)
        .execute();
    }
  },
} satisfies Seed;

export default seed;
