import { type Kysely, sql } from "kysely";
import type { Seed } from "kysely-ctl";

import type { DB } from "../types.js";
import { hashApiKeySecret } from "../../module/auth/auth.crypto.js";

const dummyId = "00000000-0000-0000-0000-000000000001";
const dummyId2 = "00000000-0000-0000-0000-000000000002";
const dummyId3 = "00000000-0000-0000-0000-000000000003";
const dummyId4 = "00000000-0000-0000-0000-000000000004";
const dummyId5 = "00000000-0000-0000-0000-000000000005";
const dummyId6 = "00000000-0000-0000-0000-000000000006";
const dummyId7 = "00000000-0000-0000-0000-000000000007";

const ids = {
  api_keys: {
    dev_super: dummyId, // superadmin
    dev: dummyId2, // *, but no superadmin
    read_only: dummyId3,
    write_only: dummyId4,
    read_write: dummyId5,
    moderator: dummyId6,
    admin: dummyId7
  },

  badges: {
    ghost: 1,
    dev: 2,
    supporter: 3,
    bugHunter: 4,
    tester: 5,
    inactive: 6,
    oneYear: 7,
    twoYear: 8,
    threeYear: 9,
    fourYear: 10,
    fiveYear: 11,
  },

  servers: {
    velocity: dummyId,
    lobby: dummyId2,
    lockdownMinigames: dummyId3,
    devMinRank: dummyId4,
    devPermission: dummyId5,
  },

  permissions: {
    serverAccessDev2: dummyId,
    serverAccessAll: dummyId2,
    lockdownBypass: dummyId3,
  },

  actors: {
    system: dummyId,
    seed: "20000000-0000-0000-0000-000000000002",
    dummy: "00000000-0000-0000-0000-000000000003",
    moderatorDummy: "00000000-0000-0000-0000-000000000004",
    adminDummy: "00000000-0000-0000-0000-000000000005",
    refrizor: "7d16b15d-bb22-4a6d-80db-6213b3d75007",
  },

  players: {
    dummy: "00000000-0000-0000-0000-000000000003",
    moderatorDummy: "00000000-0000-0000-0000-000000000004",
    adminDummy: "00000000-0000-0000-0000-000000000005",
    refrizor: "7d16b15d-bb22-4a6d-80db-6213b3d75007",
  },
} as const;

const keyScopes = {
  dev_super: ["*"],
  read_only: ["actors:read", "players:read", "servers:read", "permissions:read", "chat:read", "moderation:read", "minecraft:permission-check"],
  write_only: ["actors:write", "players:write", "servers:write", "permissions:write", "chat:write", "moderation:write", "minecraft:permission-check"],
  read_write: ["actors:read", "players:read", "servers:read", "permissions:read", "chat:read", "moderation:read", "minecraft:permission-check",
    "actors:write", "players:write", "servers:write", "permissions:write", "chat:write", "moderation:write", "minecraft:permission-check"],
  moderator: ["actors:read", "players: read", "servers:read", "chat:read", "moderation:read", "moderation:write", "minecraft:permission-check"]
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
          key: "collaborator",
          group_key: "staff",
          label: "Collaborator",
          tier: 1,
          is_staff: true,
          is_active: true,
        },
        {
          key: "moderator",
          group_key: "staff",
          label: "Moderator",
          tier: 2,
          is_staff: true,
          is_active: true,
        },
        {
          key: "admin",
          group_key: "staff",
          label: "Admin",
          tier: 3,
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
        {
          key: "supporter_ii",
          group_key: "patron",
          label: "Supporter (II) (Disabled)",
          tier: 2,
          is_staff: false,
          is_active: false,
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
      .insertInto("permission_policies")
      .values([
        {
          permission_id: ids.permissions.serverAccessDev2,
          rank_key: "admin",
          effect: "allow",
        },
        {
          permission_id: ids.permissions.serverAccessAll,
          rank_key: "admin",
          effect: "allow",
        },
        {
          permission_id: ids.permissions.lockdownBypass,
          rank_key: "admin",
          effect: "allow",
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
          id: ids.actors.moderatorDummy,
          name: "Moderator Dummy",
          type: "user",
        },
        {
          id: ids.actors.adminDummy,
          name: "Admin Dummy",
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
          id: ids.api_keys.dev_super,
          key: ids.api_keys.dev_super,
          key_hash: hashApiKeySecret("dev"),
          principal_type: "server_api_key",
          platform: "minecraft",
          permissions: sql`CAST(${JSON.stringify(["*"])} AS jsonb)`,
          owner_actor_id: ids.actors.seed,
          created_by_actor_id: ids.actors.seed,
          can_bypass_rate_limit: true,
          is_active: true,
          is_super_key: true,
        },
        {
          id: ids.api_keys.dev,
          key: ids.api_keys.dev,
          key_hash: hashApiKeySecret("dev"),
          principal_type: "server_api_key",
          platform: "minecraft",
          permissions: sql`CAST(${JSON.stringify(["*"])} AS jsonb)`,
          owner_actor_id: ids.actors.seed,
          created_by_actor_id: ids.actors.seed,
          can_bypass_rate_limit: true,
          is_active: true,
          is_super_key: false,
        },
        {
          id: ids.api_keys.read_only,
          key: ids.api_keys.read_only,
          key_hash: hashApiKeySecret("dev"),
          principal_type: "server_api_key",
          platform: "minecraft",
          permissions: sql`CAST(${JSON.stringify([keyScopes.read_only])} AS jsonb)`,
          owner_actor_id: ids.actors.seed,
          created_by_actor_id: ids.actors.seed,
          can_bypass_rate_limit: true,
          is_active: true,
          is_super_key: false,
        },
        {
          id: ids.api_keys.write_only,
          key: ids.api_keys.write_only,
          key_hash: hashApiKeySecret("dev"),
          principal_type: "server_api_key",
          platform: "minecraft",
          permissions: sql`CAST(${JSON.stringify(keyScopes.write_only)} AS jsonb)`,
          owner_actor_id: ids.actors.seed,
          created_by_actor_id: ids.actors.seed,
          can_bypass_rate_limit: true,
          is_active: true,
          is_super_key: false,
        },
        {
          id: ids.api_keys.read_write,
          key: ids.api_keys.read_write,
          key_hash: hashApiKeySecret("dev"),
          principal_type: "server_api_key",
          platform: "minecraft",
          permissions: sql`CAST(${JSON.stringify(keyScopes.read_write)} AS jsonb)`,
          owner_actor_id: ids.actors.seed,
          created_by_actor_id: ids.actors.seed,
          can_bypass_rate_limit: true,
          is_active: true,
          is_super_key: false,
        },
        {
          id: ids.api_keys.moderator,
          key: ids.api_keys.moderator,
          key_hash: hashApiKeySecret("dev"),
          principal_type: "server_api_key",
          platform: "minecraft",
          permissions: sql`CAST(${JSON.stringify(keyScopes.moderator)} AS jsonb)`,
          owner_actor_id: ids.actors.seed,
          created_by_actor_id: ids.actors.seed,
          can_bypass_rate_limit: true,
          is_active: true,
          is_super_key: false,
        },
      ])
      .execute();

    await db
      .insertInto("servers")
      .values([
        {
          id: ids.servers.velocity,
          name: "seed-velocity",
          type: "velocity",
          environment: "development",
          status: "offline",
          version: "development",
        },
        {
          id: ids.servers.lobby,
          name: "seed-lobby",
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
          display_order: 50,
          is_active: true,
        },
        {
          id: ids.badges.bugHunter,
          key: "bug_hunter",
          label: "Bug Hunter",
          description: null,
          color: "#59ff91",
          emoji: "🐞",
          display_order: 49,
          is_active: true,
        },
        {
          id: ids.badges.tester,
          key: "tester",
          label: "Tester",
          description: "Be a tester! <3",
          color: "#94ffe2",
          emoji: "🧪",
          display_order: 48,
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
          display_order: 90,
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
        {
          id: ids.badges.oneYear,
          key: "one_year",
          label: "First Lap",
          description:
            "One year in. You found the door, learned the weird corners, and somehow kept coming back.",
          color: "#c9a7a0",
          emoji: "①",
          display_order: 1,
          is_active: true,
        },
        {
          id: ids.badges.twoYear,
          key: "two_year",
          label: "Known Quantity",
          description: "Two years. Your name lands with context now. Thanks for sticking around.",
          color: "#b88f87",
          emoji: "②",
          display_order: 2,
          is_active: true,
        },
        {
          id: ids.badges.threeYear,
          key: "three_year",
          label: "Deep Cut",
          description: "Three years in. We have an inkling that you like this place.",
          color: "#9f7473",
          emoji: "③",
          display_order: 3,
          is_active: true,
        },
        {
          id: ids.badges.fourYear,
          key: "four_year",
          label: "Load-Bearing Member",
          description:
            "Four years here. At this point, the place feels slightly different when you’re gone.",
          color: "#7f5f68",
          emoji: "④",
          display_order: 4,
          is_active: true,
        },
        {
          id: ids.badges.fiveYear,
          key: "five_year",
          label: "Part of the Myth",
          description: "Five years deep. Seriously, thank you. <3",
          color: "#5f4b5d",
          emoji: "⑤",
          display_order: 5,
          is_active: true,
        },
      ])
      .execute();

    await db
      .insertInto("chat_channels")
      .values([
        {
          key: "global",
          description: "Default global channel",
          is_hidden: false,
          is_active: true,
        },
        {
          key: "testing",
          description: "Inactive channel for testing",
          is_hidden: false,
          is_active: false,
        },
        {
          key: "staff",
          is_staff: true,
          description: "Internal staff channel",
          is_hidden: false,
          is_active: true,
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
          active_channel_key: "testing",
        },
        {
          id: ids.players.moderatorDummy,
          username: "ModDummy",
          flags: "1048583", // STAFF, VANISHED, NICKED, ARGUS_ACCESS
        },
        {
          id: ids.players.adminDummy,
          username: "AdminDummy",
          flags: "1048583", // STAFF, VANISHED, NICKED, ARGUS_ACCESS
        },
        {
          id: ids.players.refrizor,
          username: "Refrizor",
          flags: 3,
          orbs: 500,
          active_channel_key: "global",
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
        // Staff / moderation
        {
          flag_key: "STAFF",
          bit_position: 0,
          label: "Staff",
          description: "Player is an official staff member",
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
          flag_key: "WATCHLISTED",
          bit_position: 5,
          label: "Watchlisted",
          description: "Player has an active staff watchlist entry",
        },

        // Account state
        {
          flag_key: "DISABLED",
          bit_position: 6,
          label: "Disabled",
          description: "Account is disabled",
        },
        {
          flag_key: "DELETED",
          bit_position: 7,
          label: "Deleted",
          description: "Account is deleted",
        },
        {
          flag_key: "SELF_DELETED",
          bit_position: 8,
          label: "Self Deleted",
          description: "Account was deleted by the player",
        },
        {
          flag_key: "UNDERAGE_DELETED",
          bit_position: 9,
          label: "Underage Deleted (<17)",
          description: "Account was deleted due to underage requirements",
        },
        {
          flag_key: "QUARANTINED",
          bit_position: 10,
          label: "Quarantined",
          description: "Account may be a spammer and is quarantined",
        },

        // Notifications
        {
          flag_key: "UNREAD_PUNISHMENTS",
          bit_position: 11,
          label: "Unread Punishments",
          description: "Player has unread punishments",
        },
        {
          flag_key: "UNREAD_NOTIFICATIONS",
          bit_position: 12,
          label: "Unread Notifications",
          description: "Player has unread notifications",
        },

        // System accounts
        {
          flag_key: "SYSTEM",
          bit_position: 13,
          label: "System",
          description: "System account",
        },
        {
          flag_key: "TEST_ACCOUNT",
          bit_position: 14,
          label: "Test Account",
          description: "This is a facade account used for development and testing",
        },
        {
          flag_key: "MIGRATING",
          bit_position: 15,
          label: "Migrating",
          description: "Player account is currently undergoing data migration",
        },

        // External / internal access
        {
          flag_key: "ARGUS_ACCESS",
          bit_position: 20,
          label: "Argus Access",
          description: "Player has an Argus account",
        },
        {
          flag_key: "TESTER",
          bit_position: 21,
          label: "Tester",
          description: "Player is a tester",
        },
        {
          flag_key: "COLLABORATOR",
          bit_position: 50,
          label: "Collaborator",
          description: "Player is an authorized collaborator.",
        },
      ])
      .execute();

    await db
      .insertInto("actor_watchlist_entries")
      .values([
        {
          subject_actor_id: ids.actors.dummy,
          added_by_actor_id: ids.actors.seed,
          reason: "Development fixture for watchlist filtering and staff activity alerts.",
        },
      ])
      .execute();

    await db
      .insertInto("reports")
      .values([
        {
          reporter_actor_id: ids.actors.refrizor,
          subject_actor_id: ids.actors.dummy,
          origin_server_id: ids.servers.lobby,
          status: "open",
          selected_reason: "Open report (seeding)",
          severity: "low",
        },
        {
          reporter_actor_id: ids.actors.refrizor,
          subject_actor_id: ids.actors.dummy,
          origin_server_id: ids.servers.lobby,
          status: "open",
          selected_reason: "Open report - high priority (seeding)",
          severity: "high",
        },
        {
          id: dummyId,
          reporter_actor_id: ids.actors.refrizor,
          subject_actor_id: ids.actors.dummy,
          origin_server_id: ids.servers.lobby,
          status: "under_review",
          selected_reason: "Under review report (seeding)",
          severity: "low",
        },
        {
          reporter_actor_id: ids.actors.refrizor,
          subject_actor_id: ids.actors.dummy,
          origin_server_id: ids.servers.lobby,
          status: "actioned",
          selected_reason: "Actioned report (seeding)",
          severity: "low",
        },
        {
          reporter_actor_id: ids.actors.refrizor,
          subject_actor_id: ids.actors.dummy,
          origin_server_id: ids.servers.lobby,
          status: "dismissed",
          selected_reason: "Dismissed report (seeding)",
          severity: "low",
        },
        {
          reporter_actor_id: ids.actors.refrizor,
          subject_actor_id: ids.actors.dummy,
          origin_server_id: ids.servers.lobby,
          status: "duplicate",
          selected_reason: "Dupe report (seeding)",
          severity: "low",
        },
      ])
      .execute();

    await db
      .insertInto("report_comments")
      .values([
        {
          id: dummyId,
          author_actor_id: ids.actors.refrizor,
          report_id: dummyId,
          comment_text: "This is a report comment.",
        },
        {
          id: dummyId2,
          author_actor_id: ids.actors.refrizor,
          report_id: dummyId,
          is_sticky: true,
          comment_text: "This is a sticky report comment.",
        },
        {
          id: dummyId3,
          author_actor_id: ids.actors.system,
          report_id: dummyId,
          parent_comment_id: dummyId,
          comment_text: "This is a reply to a report comment.",
        },
      ])
      .execute();

    await db
      .insertInto("mod_cases")
      .values([
        {
          id: dummyId,
          opened_by_actor_id: ids.actors.refrizor,
          title: "Open mod case",
          description: "Seeding",
          status: "open",
          is_sticky: false,
          severity: "low",
        },
        {
          id: dummyId2,
          opened_by_actor_id: ids.actors.refrizor,
          title: "Investigating mod case",
          description: "Seeding",
          status: "investigating",
          is_sticky: false,
          severity: "low",
        },
        {
          id: dummyId3,
          opened_by_actor_id: ids.actors.refrizor,
          title: "Pending action mod case",
          description: "Seeding",
          status: "pending_action",
          is_sticky: false,
          severity: "low",
        },
        {
          id: dummyId4,
          opened_by_actor_id: ids.actors.refrizor,
          title: "Resolved mod case",
          description: "Seeding",
          status: "resolved",
          is_sticky: false,
          severity: "low",
        },
        {
          id: dummyId5,
          opened_by_actor_id: ids.actors.refrizor,
          title: "Closed mod case",
          description: "Seeding",
          status: "closed",
          is_sticky: false,
          severity: "low",
        },
        {
          opened_by_actor_id: ids.actors.refrizor,
          title: "Sticky investigating mod case",
          description: "Seeding",
          status: "investigating",
          is_sticky: true,
          severity: "low",
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
      {
        actorId: ids.actors.moderatorDummy,
        playerId: ids.players.moderatorDummy,
      },
    ];

    for (const link of actorPlayerLinks) {
      await db
        .updateTable("actors")
        .set({ player_id: link.playerId })
        .where("id", "=", link.actorId)
        .execute();
    }

    await db
      .insertInto("player_nicknames")
      .values([
        {
          player_id: ids.players.moderatorDummy,
          nickname: "NickedMod",
          meta: [],
          is_active: true,
        },
      ])
      .execute();

    await db
      .insertInto("privileged_subjects")
      .values([
        {
          actor_id: ids.actors.refrizor,
          status: "active",
          role: "superadmin",
          title: "Administrator",
          enrolled_by_actor_id: ids.actors.seed,
        },
        {
          actor_id: ids.actors.moderatorDummy,
          status: "active",
          role: "moderator",
          title: "Moderator",
          enrolled_by_actor_id: ids.actors.seed,
        },
      ])
      .execute();

    await db
      .insertInto("argus_users")
      .values([
        {
          actor_id: ids.actors.refrizor,
          username: "Refrizor",
          email: "azzy@inferris.com",
          role: "admin",
          account_state: "active",
        },
        {
          actor_id: ids.actors.moderatorDummy,
          username: "Mod Dummy",
          email: "moddummy@inferris.com",
          role: "moderator",
          account_state: "active",
        },
        {
          actor_id: ids.actors.moderatorDummy,
          username: "Admin Dummy",
          email: "admindummy@inferris.com",
          role: "admin",
          account_state: "active",
        }
      ]).execute();

    await db
      .insertInto("chat_messages")
      .values([
        {
          id: dummyId,
          actor_id: ids.actors.dummy,
          producer_message_id: "seed-chat-1",
          origin_server_id: ids.servers.lobby,
          channel_key: "global",
          message: "Hello World!",
        },
        {
          id: dummyId2,
          actor_id: ids.actors.moderatorDummy,
          producer_message_id: "seed-chat-2",
          origin_server_id: ids.servers.lobby,
          channel_key: "staff",
          message: "Hello Staff!",
        },
      ])
      .execute();
  },
} satisfies Seed;

export default seed;
