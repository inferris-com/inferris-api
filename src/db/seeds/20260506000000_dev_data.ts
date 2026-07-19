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
    admin: dummyId7,
  },

  actors: {
    system: dummyId,
    seed: "20000000-0000-0000-0000-000000000002",
    dummy: "00000000-0000-0000-0000-000000000003",
    moderatorDummy: "00000000-0000-0000-0000-000000000004",
    adminDummy: "00000000-0000-0000-0000-000000000005",
    developerDummy: "00000000-0000-0000-0000-000000000006",
    refrizor: "7d16b15d-bb22-4a6d-80db-6213b3d75007",
  },

  players: {
    dummy: "00000000-0000-0000-0000-000000000003",
    moderatorDummy: "00000000-0000-0000-0000-000000000004",
    adminDummy: "00000000-0000-0000-0000-000000000005",
    refrizor: "7d16b15d-bb22-4a6d-80db-6213b3d75007",
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

  networkSessions: {
    refrizor: "50000000-0000-0000-0000-000000000001",
    dummy: "50000000-0000-0000-0000-000000000002",
    moderatorDummy: "50000000-0000-0000-0000-000000000003",
    adminDummy: "50000000-0000-0000-0000-000000000004",
  },

  permissions: {
    serverAccessDev2: dummyId,
    serverAccessAll: dummyId2,
    lockdownBypass: dummyId3,
    punishBan: "10000000-0000-0000-0000-000000000001",
    punishMute: "10000000-0000-0000-0000-000000000002",
    punishWarn: "10000000-0000-0000-0000-000000000003",
    punishKick: "10000000-0000-0000-0000-000000000004",
    punishRevoke: "10000000-0000-0000-0000-000000000005",
    infractionRead: "10000000-0000-0000-0000-000000000006",
    rankSet: "10000000-0000-0000-0000-000000000007",
    profileRead: "10000000-0000-0000-0000-000000000008",
    staffLookup: "10000000-0000-0000-0000-000000000009",
    badgeAward: "10000000-0000-0000-0000-000000000010",
    badgeRevoke: "10000000-0000-0000-0000-000000000011",
    watchlistRead: "10000000-0000-0000-0000-000000000012",
    watchlistWrite: "10000000-0000-0000-0000-000000000013",
    reportsCreate: "10000000-0000-0000-0000-000000000014",
    reportsRead: "10000000-0000-0000-0000-000000000015",
    catalogRead: "10000000-0000-0000-0000-000000000016",
  },
} as const;

const keyScopes = {
  dev_super: ["*"],
  read_only: [
    "actors:read",
    "players:read",
    "servers:read",
    "permissions:read",
    "chat:read",
    "moderation:read",
    "minecraft:permission-check",
  ],
  write_only: [
    "actors:write",
    "players:write",
    "servers:write",
    "permissions:write",
    "chat:write",
    "moderation:write",
    "minecraft:permission-check",
  ],
  read_write: [
    "actors:read",
    "players:read",
    "servers:read",
    "permissions:read",
    "chat:read",
    "moderation:read",
    "minecraft:permission-check",
    "actors:write",
    "players:write",
    "servers:write",
    "permissions:write",
    "chat:write",
    "moderation:write",
    "minecraft:permission-check",
  ],
  moderator: [
    "actors:read",
    "players:read",
    "servers:read",
    "chat:read",
    "moderation:read",
    "moderation:write",
    "minecraft:permission-check",
  ],
} as const;

const actors = {
  system: {
    id: ids.actors.system,
    name: "System",
    type: "system",
  },
  seed: {
    id: ids.actors.seed,
    name: "Seed Script",
    type: "application",
  },
  dummy: {
    id: ids.actors.dummy,
    name: "Dummy User",
    type: "user",
  },
  moderatorDummy: {
    id: ids.actors.moderatorDummy,
    name: "Moderator Dummy",
    type: "user",
  },
  adminDummy: {
    id: ids.actors.adminDummy,
    name: "Admin Dummy",
    type: "user",
  },
  developerDummy: {
    id: ids.actors.developerDummy,
    name: "Developer (Smoketest)",
    type: "user",
  },
  refrizor: {
    id: ids.actors.refrizor,
    name: "Refrizor",
    type: "user",
  },
};

const privilegedSubjects = {
  refrizor: {
    actor_id: ids.actors.refrizor,
    status: "active",
    role: "superadmin",
    title: "Administrator",
  },
  developer: {
    actor_id: ids.actors.developerDummy,
    status: "active",
    role: "superadmin",
    title: "Developer",
  },
  moderatorDummy: {
    actor_id: ids.actors.moderatorDummy,
    status: "active",
    role: "moderator",
    title: "Moderator",
  },
  adminDummy: {
    actor_id: ids.actors.adminDummy,
    status: "active",
    role: "administrator",
    title: "Admin",
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
          key: "collaborator",
          group_key: "staff",
          label: "Collaborator",
          description: "Trusted project collaborator with limited staff access.",
          visuals: {
            version: 1,
            tag: {
              segments: [
                { text: "[", color: "#4b5563" },
                { text: "Collab", color: "#22c55e" },
                { text: "]", color: "#4b5563" },
              ],
            },
            username: {
              color: "#22c55e",
            },
          },
          tier: 1,
          is_staff: true,
          is_active: true,
        },
        {
          key: "moderator",
          group_key: "staff",
          label: "Moderator",
          description: "Community moderator responsible for player safety and enforcement.",
          visuals: {
            version: 1,
            tag: {
              segments: [
                { text: "[", color: "#4b5563" },
                { text: "Mod", color: "#38bdf8" },
                { text: "]", color: "#4b5563" },
              ],
            },
            username: {
              color: "#38bdf8",
            },
          },
          tier: 2,
          is_staff: true,
          is_active: true,
        },
        {
          key: "admin",
          group_key: "staff",
          label: "Admin",
          description: "Staff group. Authorized staff only.",
          visuals: {
            version: 1,
            tag: {
              segments: [
                { text: "[", color: "#555555" },
                { text: "Admin", color: "#ff5555" },
                { text: "]", color: "#555555" },
              ],
            },
            username: {
              color: "#ff5555",
            },
          },
          tier: 3,
          is_staff: true,
          is_active: true,
        },
        {
          key: "supporter_i",
          group_key: "patron",
          label: "Supporter (I)",
          description: "Entry supporter rank for players who help support the server.",
          visuals: {
            version: 1,
            tag: {
              segments: [
                { text: "[", color: "#6b7280" },
                { text: "Supporter", color: "#f59e0b" },
                { text: " I", color: "#fbbf24" },
                { text: "]", color: "#6b7280" },
              ],
            },
            username: {
              color: "#f59e0b",
            },
          },
          tier: 1,
          is_staff: false,
          is_active: true,
        },
        {
          key: "supporter_ii",
          group_key: "patron",
          label: "Supporter (II) (Disabled)",
          description: "Legacy supporter rank. Currently disabled and unavailable for assignment.",
          visuals: {
            version: 1,
            tag: {
              segments: [
                { text: "[", color: "#52525b" },
                { text: "Supporter", color: "#a78bfa" },
                { text: " II", color: "#c4b5fd" },
                { text: "]", color: "#52525b" },
              ],
            },
            username: {
              color: "#a78bfa",
            },
          },
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
        {
          id: ids.permissions.punishBan,
          key: "moderation.punish.ban",
          description: "Allows issuing bans.",
          category: "moderation",
          is_active: true,
        },
        {
          id: ids.permissions.punishMute,
          key: "moderation.punish.mute",
          description: "Allows issuing mutes.",
          category: "moderation",
          is_active: true,
        },
        {
          id: ids.permissions.punishWarn,
          key: "moderation.punish.warn",
          description: "Allows issuing warnings.",
          category: "moderation",
          is_active: true,
        },
        {
          id: ids.permissions.punishKick,
          key: "moderation.punish.kick",
          description: "Allows issuing kicks.",
          category: "moderation",
          is_active: true,
        },
        {
          id: ids.permissions.punishRevoke,
          key: "moderation.punish.revoke",
          description: "Allows revoking active punishments.",
          category: "moderation",
          is_active: true,
        },
        {
          id: ids.permissions.infractionRead,
          key: "moderation.infraction.read",
          description: "Allows reading infractions.",
          category: "moderation",
          is_active: true,
        },
        {
          id: ids.permissions.rankSet,
          key: "players.rank.set",
          description: "Allows changing player ranks.",
          category: "administration",
          is_active: true,
        },
        {
          id: ids.permissions.profileRead,
          key: "players.profile.read",
          description: "Allows reading player profiles.",
          category: "command",
          is_active: true,
        },
        {
          id: ids.permissions.staffLookup,
          key: "players.lookup.staff",
          description: "Allows staff player lookup.",
          category: "moderation",
          is_active: true,
        },
        {
          id: ids.permissions.badgeAward,
          key: "players.badge.award",
          description: "Allows awarding badges.",
          category: "administration",
          is_active: true,
        },
        {
          id: ids.permissions.badgeRevoke,
          key: "players.badge.revoke",
          description: "Allows revoking badges.",
          category: "administration",
          is_active: true,
        },
        {
          id: ids.permissions.watchlistRead,
          key: "players.watchlist.read",
          description: "Allows reading the player watchlist.",
          category: "moderation",
          is_active: true,
        },
        {
          id: ids.permissions.watchlistWrite,
          key: "players.watchlist.write",
          description: "Allows updating the player watchlist.",
          category: "moderation",
          is_active: true,
        },
        {
          id: ids.permissions.reportsCreate,
          key: "reports.create",
          description: "Allows creating player reports.",
          category: "command",
          is_active: true,
        },
        {
          id: ids.permissions.reportsRead,
          key: "reports.read",
          description: "Allows reading player reports.",
          category: "moderation",
          is_active: true,
        },
        {
          id: ids.permissions.catalogRead,
          key: "catalog.read",
          description: "Allows reading internal catalog metadata.",
          category: "command",
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
        { permission_id: ids.permissions.punishBan, rank_key: "moderator", effect: "allow" },
        { permission_id: ids.permissions.punishMute, rank_key: "moderator", effect: "allow" },
        { permission_id: ids.permissions.punishWarn, rank_key: "moderator", effect: "allow" },
        { permission_id: ids.permissions.punishKick, rank_key: "moderator", effect: "allow" },
        { permission_id: ids.permissions.punishRevoke, rank_key: "moderator", effect: "allow" },
        { permission_id: ids.permissions.infractionRead, rank_key: "moderator", effect: "allow" },
        { permission_id: ids.permissions.rankSet, rank_key: "admin", effect: "allow" },
        { permission_id: ids.permissions.profileRead, rank_key: "moderator", effect: "allow" },
        { permission_id: ids.permissions.staffLookup, rank_key: "moderator", effect: "allow" },
        { permission_id: ids.permissions.badgeAward, rank_key: "admin", effect: "allow" },
        { permission_id: ids.permissions.badgeRevoke, rank_key: "admin", effect: "allow" },
        { permission_id: ids.permissions.watchlistRead, rank_key: "moderator", effect: "allow" },
        { permission_id: ids.permissions.watchlistWrite, rank_key: "moderator", effect: "allow" },
        { permission_id: ids.permissions.reportsCreate, rank_key: "moderator", effect: "allow" },
        { permission_id: ids.permissions.reportsRead, rank_key: "moderator", effect: "allow" },
        { permission_id: ids.permissions.catalogRead, rank_key: "moderator", effect: "allow" },
      ])
      .execute();

    await db
      .insertInto("actors")
      .values([
        actors.seed,
        actors.system,
        actors.dummy,
        actors.moderatorDummy,
        actors.adminDummy,
        actors.developerDummy,
        actors.refrizor,
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
          permissions: sql`CAST(${JSON.stringify(keyScopes.read_only)} AS jsonb)`,
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
          name: "velocity",
          type: "velocity",
          environment: "development",
        },
        {
          id: ids.servers.lobby,
          name: "lobby",
          type: "paper",
          environment: "development",
        },
        {
          id: ids.servers.lockdownMinigames,
          name: "Minigames (Lockdown)",
          type: "paper",
          environment: "development",
        },
        {
          id: ids.servers.devMinRank,
          name: "Development server #1 (min rank)",
          type: "paper",
          environment: "development",
        },
        {
          id: ids.servers.devPermission,
          name: "Development server #2 (min perm)",
          type: "paper",
          environment: "development",
        },
      ])
      .execute();

    await sql`
	      INSERT INTO server_registration_api_keys (api_key_id, server_id)
	      SELECT api_key_id::uuid, server_id::uuid
	      FROM unnest(
	        ${[
            ids.api_keys.dev_super,
            ids.api_keys.dev_super,
            ids.api_keys.dev_super,
            ids.api_keys.dev_super,
            ids.api_keys.dev_super,
            ids.api_keys.dev,
            ids.api_keys.dev,
            ids.api_keys.dev,
            ids.api_keys.dev,
            ids.api_keys.dev,
          ]}::uuid[],
	        ${[
            ids.servers.velocity,
            ids.servers.lobby,
            ids.servers.lockdownMinigames,
            ids.servers.devMinRank,
            ids.servers.devPermission,
            ids.servers.velocity,
            ids.servers.lobby,
            ids.servers.lockdownMinigames,
            ids.servers.devMinRank,
            ids.servers.devPermission,
          ]}::uuid[]
	      ) AS bindings(api_key_id, server_id)
	    `.execute(db);

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
          mojang_id: "30000000-0000-0000-0000-000000000003",
          actor_id: ids.actors.dummy,
          username: "Dummy",
          flags: 33792,
          orbs: 0,
          active_channel_key: "testing",
        },
        {
          id: ids.players.moderatorDummy,
          mojang_id: "30000000-0000-0000-0000-000000000004",
          actor_id: ids.actors.moderatorDummy,
          username: "ModDummy",
          flags: "1048583", // STAFF, VANISHED, NICKED, ARGUS_ACCESS
        },
        {
          id: ids.players.adminDummy,
          mojang_id: "30000000-0000-0000-0000-000000000005",
          actor_id: ids.actors.adminDummy,
          username: "AdminDummy",
          flags: "1048583", // STAFF, VANISHED, NICKED, ARGUS_ACCESS
        },
        {
          id: ids.players.refrizor,
          mojang_id: "30000000-0000-0000-0000-000000000007",
          actor_id: ids.actors.refrizor,
          username: "Refrizor",
          flags: 36700163, // STAFF, VANISHED, ARGUS_ACCESS, COOL
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
        {
          player_id: ids.players.refrizor,
          badge_id: ids.badges.dev,
          source: "Seeding",
        },
        {
          player_id: ids.players.refrizor,
          badge_id: ids.badges.bugHunter,
          source: "Seeding",
        },
        {
          player_id: ids.players.refrizor,
          badge_id: ids.badges.tester,
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
          flag_key: "COOL",
          bit_position: 25,
          label: "Cool",
          description: "This person is cool",
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
          code: "SEEDREP001",
          reporter_actor_id: ids.actors.refrizor,
          subject_actor_id: ids.actors.dummy,
          origin_server_id: ids.servers.lobby,
          status: "open",
          selected_reason: "Open report (seeding)",
          severity: "low",
        },
        {
          code: "SEEDREP002",
          reporter_actor_id: ids.actors.refrizor,
          subject_actor_id: ids.actors.dummy,
          origin_server_id: ids.servers.lobby,
          status: "open",
          selected_reason: "Open report - high priority (seeding)",
          severity: "high",
        },
        {
          id: dummyId,
          code: "SEEDREP003",
          reporter_actor_id: ids.actors.refrizor,
          subject_actor_id: ids.actors.dummy,
          origin_server_id: ids.servers.lobby,
          status: "under_review",
          selected_reason: "Under review report (seeding)",
          severity: "low",
        },
        {
          code: "SEEDREP004",
          reporter_actor_id: ids.actors.refrizor,
          subject_actor_id: ids.actors.dummy,
          origin_server_id: ids.servers.lobby,
          status: "actioned",
          selected_reason: "Actioned report (seeding)",
          severity: "low",
        },
        {
          code: "SEEDREP005",
          reporter_actor_id: ids.actors.refrizor,
          subject_actor_id: ids.actors.dummy,
          origin_server_id: ids.servers.lobby,
          status: "dismissed",
          selected_reason: "Dismissed report (seeding)",
          severity: "low",
        },
        {
          code: "SEEDREP006",
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

    await db
      .insertInto("punishments")
      .values([
        {
          code: "SEEDMUTE01",
          issuer_actor_id: actors.moderatorDummy.id,
          subject_actor_id: actors.dummy.id,
          type: "mute",
          ends_at_ms: Date.now() - 30 * 60 * 1000,
          reason: "[Seed] [M] Get rekt",
          server_origin_id: ids.servers.lobby,
        },
      ])
      .execute();

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
        privilegedSubjects.moderatorDummy,
        privilegedSubjects.adminDummy,
        privilegedSubjects.developer,
        privilegedSubjects.refrizor,
      ])
      .execute();

    await db
      .insertInto("argus_users")
      .values([
        {
          id: ids.actors.refrizor,
          actor_id: ids.actors.refrizor,
          username: "Refrizor",
          email: "azzy@inferris.com",
          password_hash:
            "$argon2id$v=19$m=65536,t=3,p=4$cIiPtXejD1STgPzcTRZSSA$alT/uE2pvOJ+ct42nlVEjoIc2E4EJ99pIzENZpfW3VQ", // dev
          role: "admin",
          account_state: "active",
        },
        {
          actor_id: ids.actors.moderatorDummy,
          username: "Mod Dummy",
          email: "moddummy@inferris.com",
          password_hash:
            "$argon2id$v=19$m=65536,t=3,p=4$cIiPtXejD1STgPzcTRZSSA$alT/uE2pvOJ+ct42nlVEjoIc2E4EJ99pIzENZpfW3VQ", // p:dev
          role: "moderator",
          account_state: "active",
        },
        {
          actor_id: ids.actors.adminDummy,
          username: "Admin Dummy",
          email: "admindummy@inferris.com",
          password_hash:
            "$argon2id$v=19$m=65536,t=3,p=4$cIiPtXejD1STgPzcTRZSSA$alT/uE2pvOJ+ct42nlVEjoIc2E4EJ99pIzENZpfW3VQ", // p:dev
          role: "admin",
          account_state: "active",
        },
        {
          actor_id: ids.actors.developerDummy,
          username: "Developer",
          email: "dev@inferris.com",
          password_hash:
            "$argon2id$v=19$m=65536,t=3,p=4$cIiPtXejD1STgPzcTRZSSA$alT/uE2pvOJ+ct42nlVEjoIc2E4EJ99pIzENZpfW3VQ", // p:dev
          role: "admin",
          account_state: "active",
        },
      ])
      .execute();

    await db
      .insertInto("argus_notifications")
      .values([
        {
          account_id: actors.refrizor.id,
          title: "Test",
          description: "This is a test notification.",
          priority: 1,
        },
      ])
      .execute();

    await db
      .insertInto("argus_alerts")
      .values([
        {
          title: "Development mode",
          description: "Argus is in development mode.",
          css_class: "alert-maintenance",
          priority: 1,
        },
      ])
      .execute();

    const globalChatConversations: Array<{
      actor: keyof Pick<
        typeof ids.actors,
        "dummy" | "moderatorDummy" | "adminDummy" | "developerDummy"
      >;
      server: keyof typeof ids.servers;
      channel?: string;
      message: string;
    }> = [
      { actor: "dummy", server: "lobby", message: "This is a chat message in Global." },
      {
        actor: "moderatorDummy",
        server: "lobby",
        channel: "staff",
        message: "This is a chat message in Staff.",
      },
      // Conversation 1: ordinary lobby chatter
      { actor: "dummy", server: "lobby", message: "anyone know where the parkour starts" },
      { actor: "moderatorDummy", server: "lobby", message: "Behind the fountain near spawn." },
      { actor: "dummy", server: "lobby", message: "oh wow I walked past it three times" },
      {
        actor: "adminDummy",
        server: "lobby",
        message: "That means the fountain is working as intended.",
      },
      { actor: "dummy", server: "lobby", message: "the fountain has defeated me" },

      // Conversation 2: minigame queue
      {
        actor: "developerDummy",
        server: "lockdownMinigames",
        message: "We need one more player for the next round.",
      },
      { actor: "dummy", server: "lobby", message: "what game" },
      {
        actor: "developerDummy",
        server: "lockdownMinigames",
        message: "Spleef, assuming nobody destroys the waiting room first.",
      },
      { actor: "adminDummy", server: "lockdownMinigames", message: "No promises." },
      { actor: "dummy", server: "lockdownMinigames", message: "joining now" },

      // Conversation 3: food discourse
      { actor: "dummy", server: "lobby", message: "important question: pancakes or waffles" },
      {
        actor: "moderatorDummy",
        server: "lobby",
        message: "Waffles. Better structural integrity.",
      },
      {
        actor: "developerDummy",
        server: "lobby",
        message: "Pancakes have lower implementation complexity.",
      },
      { actor: "adminDummy", server: "lobby", message: "French toast has entered the tournament." },
      { actor: "dummy", server: "lobby", message: "this discussion is getting out of control" },

      // Conversation 4: lost player
      { actor: "dummy", server: "lobby", message: "I think I found a secret tunnel" },
      { actor: "moderatorDummy", server: "lobby", message: "Are you underneath spawn again?" },
      { actor: "dummy", server: "lobby", message: "possibly" },
      { actor: "moderatorDummy", server: "lobby", message: "That is the maintenance corridor." },
      {
        actor: "dummy",
        server: "lobby",
        message: "then maintenance has excellent interior design",
      },

      // Conversation 5: server performance joke
      {
        actor: "developerDummy",
        server: "velocity",
        message: "The network has now gone twelve minutes without an incident.",
      },
      { actor: "adminDummy", server: "lobby", message: "Why would you say that out loud?" },
      { actor: "dummy", server: "lobby", message: "you have doomed us all" },
      { actor: "moderatorDummy", server: "lobby", message: "Resetting the sign to zero." },
      { actor: "developerDummy", server: "velocity", message: "Understandable." },

      // Conversation 6: building
      { actor: "dummy", server: "lobby", message: "does this server have a creative area" },
      {
        actor: "adminDummy",
        server: "lobby",
        message: "Not publicly yet, but one is being planned.",
      },
      { actor: "dummy", server: "lobby", message: "I need somewhere to build a very large duck" },
      { actor: "developerDummy", server: "lobby", message: "How large are we talking?" },
      { actor: "dummy", server: "lobby", message: "large enough to become a navigation landmark" },

      // Conversation 7: accidental caps
      { actor: "dummy", server: "lobby", message: "HELLO" },
      { actor: "dummy", server: "lobby", message: "sorry caps lock" },
      { actor: "moderatorDummy", server: "lobby", message: "WELCOME" },
      {
        actor: "adminDummy",
        server: "lobby",
        message: "The appropriate response has been issued.",
      },

      // Conversation 8: mystery sound
      { actor: "dummy", server: "lockdownMinigames", message: "what was that explosion" },
      {
        actor: "developerDummy",
        server: "lockdownMinigames",
        message: "A completely intentional sound effect.",
      },
      {
        actor: "adminDummy",
        server: "lockdownMinigames",
        message: "That answer arrived suspiciously quickly.",
      },
      {
        actor: "developerDummy",
        server: "lockdownMinigames",
        message: "I was prepared for this exact question.",
      },
      { actor: "dummy", server: "lockdownMinigames", message: "that is not reassuring" },

      // Conversation 9: fishing
      {
        actor: "dummy",
        server: "lobby",
        message: "I have been fishing for ten minutes and caught one bowl",
      },
      { actor: "moderatorDummy", server: "lobby", message: "A fine and seaworthy bowl." },
      { actor: "dummy", server: "lobby", message: "I cannot sail this" },
      { actor: "adminDummy", server: "lobby", message: "Not with that attitude." },

      // Conversation 10: rank color
      { actor: "dummy", server: "lobby", message: "the new rank colors look nice" },
      {
        actor: "developerDummy",
        server: "devMinRank",
        message: "Good. We only debated them for several centuries.",
      },
      {
        actor: "moderatorDummy",
        server: "lobby",
        message: "I remember at least three separate shades of blue.",
      },
      {
        actor: "adminDummy",
        server: "lobby",
        message: "They were meaningfully different shades of blue.",
      },
      { actor: "dummy", server: "lobby", message: "I believe you" },

      // Conversation 11: spontaneous race
      { actor: "dummy", server: "lobby", message: "race from spawn to the windmill?" },
      { actor: "moderatorDummy", server: "lobby", message: "You are already halfway there." },
      { actor: "dummy", server: "lobby", message: "strategic planning" },
      { actor: "adminDummy", server: "lobby", message: "That is generally called cheating." },
      { actor: "dummy", server: "lobby", message: "strategic planning with consequences" },

      // Conversation 12: bug report, technically
      { actor: "dummy", server: "lobby", message: "bug report: I fell off the map" },
      { actor: "developerDummy", server: "lobby", message: "Where were you standing?" },
      { actor: "dummy", server: "lobby", message: "outside the map" },
      {
        actor: "developerDummy",
        server: "lobby",
        message: "I have identified the probable cause.",
      },
      { actor: "moderatorDummy", server: "lobby", message: "Excellent investigative work." },

      // Conversation 13: weather
      { actor: "dummy", server: "lobby", message: "it has been raining for so long" },
      { actor: "adminDummy", server: "lobby", message: "The crops appreciate your sacrifice." },
      { actor: "dummy", server: "lobby", message: "my frames do not" },
      {
        actor: "developerDummy",
        server: "lobby",
        message: "The frames have been deemed an acceptable loss.",
      },

      // Conversation 14: pet naming
      { actor: "dummy", server: "lobby", message: "I found a wolf, what should I name it" },
      { actor: "moderatorDummy", server: "lobby", message: "Concrete." },
      { actor: "adminDummy", server: "lobby", message: "That is an unusually dense name." },
      { actor: "developerDummy", server: "lobby", message: "Name it Packet." },
      { actor: "dummy", server: "lobby", message: "Packet wins" },

      // Conversation 15: dramatic arrival
      { actor: "adminDummy", server: "lobby", message: "I have arrived." },
      { actor: "dummy", server: "lobby", message: "welcome back" },
      { actor: "moderatorDummy", server: "lobby", message: "The announcement was necessary." },
      { actor: "adminDummy", server: "lobby", message: "Naturally." },

      // Conversation 16: invisible barrier
      {
        actor: "dummy",
        server: "lockdownMinigames",
        message: "why can I not walk through this doorway",
      },
      {
        actor: "developerDummy",
        server: "lockdownMinigames",
        message: "The doorway is currently decorative.",
      },
      { actor: "dummy", server: "lockdownMinigames", message: "that is just a wall with ambition" },
      {
        actor: "moderatorDummy",
        server: "lockdownMinigames",
        message: "Please respect its career goals.",
      },

      // Conversation 17: trivia
      {
        actor: "moderatorDummy",
        server: "lobby",
        message: "Lobby trivia: the tallest tower has 214 blocks.",
      },
      { actor: "dummy", server: "lobby", message: "who counted that" },
      {
        actor: "developerDummy",
        server: "lobby",
        message: "Someone with access to the source files.",
      },
      { actor: "adminDummy", server: "lobby", message: "So, effectively, a wizard." },
      { actor: "dummy", server: "lobby", message: "understood" },

      // Conversation 18: suspicious chicken
      { actor: "dummy", server: "lobby", message: "there is a chicken staring at me" },
      {
        actor: "moderatorDummy",
        server: "lobby",
        message: "Do not disclose staff operations in global chat.",
      },
      { actor: "adminDummy", server: "lobby", message: "The chicken has been reassigned." },
      {
        actor: "dummy",
        server: "lobby",
        message: "it walked away immediately after you said that",
      },
      { actor: "developerDummy", server: "lobby", message: "Coincidence." },

      // Conversation 19: quiet moment
      { actor: "dummy", server: "lobby", message: "this lobby music is actually relaxing" },
      { actor: "developerDummy", server: "lobby", message: "Glad you like it." },
      { actor: "moderatorDummy", server: "lobby", message: "Until you notice the loop." },
      { actor: "dummy", server: "lobby", message: "why would you do this to me" },

      // Conversation 20: closing exchange
      { actor: "dummy", server: "lobby", message: "alright I am logging off, goodnight everyone" },
      { actor: "moderatorDummy", server: "lobby", message: "Goodnight!" },
      { actor: "adminDummy", server: "lobby", message: "Sleep well." },
      {
        actor: "developerDummy",
        server: "velocity",
        message: "Your session has been emotionally terminated.",
      },
      {
        actor: "dummy",
        server: "lobby",
        message: "that sounded much more threatening than goodnight",
      },
      { actor: "developerDummy", server: "velocity", message: "Goodnight." },
    ];

    const seededChatMessages = globalChatConversations.map((entry, index) => {
      const sequence = String(index + 1).padStart(12, "0");

      return {
        // Uses a separate UUID namespace so these do not collide with your
        // existing 00000000-... dummy resource IDs.
        id: `30000000-0000-0000-0000-${sequence}`,
        actor_id: ids.actors[entry.actor],
        producer_message_id: `seed-global-chat-${index + 1}`,
        origin_server_id: ids.servers[entry.server],
        channel_key: entry.channel ?? "global",
        message: entry.message,
      };
    });

    await db.insertInto("chat_messages").values(seededChatMessages).execute();

    const nowMs = Date.now();

    await db
      .insertInto("network_sessions")
      .values([
        {
          id: ids.networkSessions.refrizor,
          player_id: ids.players.refrizor,
          proxy_server_id: ids.servers.velocity,
          connected_at_ms: nowMs - 30 * 60 * 1000,
          disconnected_at_ms: nowMs - 10 * 60 * 1000,
        },
        {
          id: ids.networkSessions.dummy,
          player_id: ids.players.dummy,
          proxy_server_id: ids.servers.velocity,
          connected_at_ms: nowMs - 24 * 60 * 1000,
        },
        {
          id: ids.networkSessions.moderatorDummy,
          player_id: ids.players.moderatorDummy,
          proxy_server_id: ids.servers.velocity,
          connected_at_ms: nowMs - 18 * 60 * 1000,
        },
        {
          id: ids.networkSessions.adminDummy,
          player_id: ids.players.adminDummy,
          proxy_server_id: ids.servers.velocity,
          connected_at_ms: nowMs - 8 * 60 * 1000,
        },
      ])
      .execute();

    await db
      .insertInto("backend_sessions")
      .values([
        {
          network_session_id: ids.networkSessions.refrizor,
          player_id: ids.players.refrizor,
          backend_server_id: ids.servers.lobby,
          joined_at_ms: nowMs - 30 * 60 * 1000,
          left_at_ms: nowMs - 10 * 60 * 1000,
        },
        {
          network_session_id: ids.networkSessions.dummy,
          player_id: ids.players.dummy,
          backend_server_id: ids.servers.lobby,
          joined_at_ms: nowMs - 24 * 60 * 1000,
        },
        {
          network_session_id: ids.networkSessions.moderatorDummy,
          player_id: ids.players.moderatorDummy,
          backend_server_id: ids.servers.lobby,
          joined_at_ms: nowMs - 18 * 60 * 1000,
        },
        {
          network_session_id: ids.networkSessions.adminDummy,
          player_id: ids.players.adminDummy,
          backend_server_id: ids.servers.lockdownMinigames,
          joined_at_ms: nowMs - 8 * 60 * 1000,
        },
      ])
      .execute();

    const metricObservations = [
      createMetricObservation(
        "40000000-0000-0000-0000-000000000001",
        ids.servers.velocity,
        nowMs,
        -10,
        {
          onlinePlayerCount: 3,
          maxPlayers: 5000,
          heapUsedBytes: 192 * 1024 * 1024,
          heapMaxBytes: 1024 * 1024 * 1024,
          backendServerCount: 4,
        },
      ),
      createMetricObservation(
        "40000000-0000-0000-0000-000000000002",
        ids.servers.velocity,
        nowMs,
        -5,
        {
          onlinePlayerCount: 3,
          maxPlayers: 5000,
          heapUsedBytes: 214 * 1024 * 1024,
          heapMaxBytes: 1024 * 1024 * 1024,
          backendServerCount: 4,
        },
      ),
      createMetricObservation(
        "40000000-0000-0000-0000-000000000003",
        ids.servers.velocity,
        nowMs,
        -1,
        {
          onlinePlayerCount: 3,
          maxPlayers: 5000,
          heapUsedBytes: 226 * 1024 * 1024,
          heapMaxBytes: 1024 * 1024 * 1024,
          backendServerCount: 4,
        },
      ),
      createMetricObservation(
        "40000000-0000-0000-0000-000000000004",
        ids.servers.lobby,
        nowMs,
        -10,
        {
          onlinePlayerCount: 1,
          maxPlayers: 100,
          tps1m: 19.98,
          tps5m: 19.99,
          tps15m: 20,
          msptAvg: 18.4,
          msptP95: 31.2,
          heapUsedBytes: 768 * 1024 * 1024,
          heapMaxBytes: 4096 * 1024 * 1024,
          loadedChunks: 820,
          loadedWorlds: 3,
        },
      ),
      createMetricObservation(
        "40000000-0000-0000-0000-000000000005",
        ids.servers.lobby,
        nowMs,
        -5,
        {
          onlinePlayerCount: 2,
          maxPlayers: 100,
          tps1m: 19.96,
          tps5m: 19.98,
          tps15m: 19.99,
          msptAvg: 20.1,
          msptP95: 36.5,
          heapUsedBytes: 812 * 1024 * 1024,
          heapMaxBytes: 4096 * 1024 * 1024,
          loadedChunks: 864,
          loadedWorlds: 3,
        },
      ),
      createMetricObservation(
        "40000000-0000-0000-0000-000000000006",
        ids.servers.lobby,
        nowMs,
        -1,
        {
          onlinePlayerCount: 2,
          maxPlayers: 100,
          tps1m: 19.97,
          tps5m: 19.98,
          tps15m: 19.99,
          msptAvg: 19.7,
          msptP95: 34.8,
          heapUsedBytes: 824 * 1024 * 1024,
          heapMaxBytes: 4096 * 1024 * 1024,
          loadedChunks: 872,
          loadedWorlds: 3,
        },
      ),
      createMetricObservation(
        "40000000-0000-0000-0000-000000000007",
        ids.servers.lockdownMinigames,
        nowMs,
        -10,
        {
          onlinePlayerCount: 0,
          maxPlayers: 40,
          tps1m: 20,
          tps5m: 20,
          tps15m: 20,
          msptAvg: 11.2,
          msptP95: 21.9,
          heapUsedBytes: 512 * 1024 * 1024,
          heapMaxBytes: 3072 * 1024 * 1024,
          loadedChunks: 420,
          loadedWorlds: 2,
        },
      ),
      createMetricObservation(
        "40000000-0000-0000-0000-000000000008",
        ids.servers.lockdownMinigames,
        nowMs,
        -5,
        {
          onlinePlayerCount: 1,
          maxPlayers: 40,
          tps1m: 19.91,
          tps5m: 19.97,
          tps15m: 19.99,
          msptAvg: 24.6,
          msptP95: 45.1,
          heapUsedBytes: 640 * 1024 * 1024,
          heapMaxBytes: 3072 * 1024 * 1024,
          loadedChunks: 512,
          loadedWorlds: 2,
        },
      ),
      createMetricObservation(
        "40000000-0000-0000-0000-000000000009",
        ids.servers.lockdownMinigames,
        nowMs,
        -1,
        {
          onlinePlayerCount: 1,
          maxPlayers: 40,
          tps1m: 19.94,
          tps5m: 19.97,
          tps15m: 19.99,
          msptAvg: 22.8,
          msptP95: 41.7,
          heapUsedBytes: 658 * 1024 * 1024,
          heapMaxBytes: 3072 * 1024 * 1024,
          loadedChunks: 520,
          loadedWorlds: 2,
        },
      ),
      createMetricObservation(
        "40000000-0000-0000-0000-000000000010",
        ids.servers.devMinRank,
        nowMs,
        -12,
        {
          onlinePlayerCount: 0,
          maxPlayers: 20,
          tps1m: 20,
          tps5m: 20,
          tps15m: 20,
          msptAvg: 9.8,
          msptP95: 15.2,
          heapUsedBytes: 384 * 1024 * 1024,
          heapMaxBytes: 2048 * 1024 * 1024,
          loadedChunks: 160,
          loadedWorlds: 1,
        },
      ),
      createMetricObservation(
        "40000000-0000-0000-0000-000000000011",
        ids.servers.devPermission,
        nowMs,
        -20,
        {
          onlinePlayerCount: 0,
          maxPlayers: 20,
          tps1m: 20,
          tps5m: 20,
          tps15m: 20,
          msptAvg: 8.9,
          msptP95: 14.1,
          heapUsedBytes: 340 * 1024 * 1024,
          heapMaxBytes: 2048 * 1024 * 1024,
          loadedChunks: 128,
          loadedWorlds: 1,
        },
      ),
    ];

    await insertMetricObservations(db, metricObservations);
    await insertLatestMetrics(db, latestMetricObservations(metricObservations));
  },
} satisfies Seed;

type MetricObservationInput = {
  onlinePlayerCount: number;
  maxPlayers?: number;
  tps1m?: number;
  tps5m?: number;
  tps15m?: number;
  msptAvg?: number;
  msptP95?: number;
  heapUsedBytes?: number;
  heapMaxBytes?: number;
  loadedChunks?: number;
  loadedWorlds?: number;
  backendServerCount?: number;
};

type MetricObservation = MetricObservationInput & {
  id: string;
  serverId: string;
  observedAtMs: number;
};

function createMetricObservation(
  id: string,
  serverId: string,
  nowMs: number,
  minutesOffset: number,
  input: MetricObservationInput,
): MetricObservation {
  return {
    id,
    serverId,
    observedAtMs: nowMs + minutesOffset * 60 * 1000,
    ...input,
  };
}

async function insertMetricObservations(
  db: Kysely<DB>,
  observations: MetricObservation[],
): Promise<void> {
  await sql`
    INSERT INTO server_heartbeat_observations (
      id,
      server_id,
      observed_at_ms,
      online_player_count,
      max_players,
      tps_1m,
      tps_5m,
      tps_15m,
      mspt_avg,
      mspt_p95,
      heap_used_bytes,
      heap_max_bytes,
      loaded_chunks,
      loaded_worlds,
      backend_server_count,
      extra
    )
    VALUES ${sql.join(observations.map(metricObservationSql))}
  `.execute(db);
}

async function insertLatestMetrics(
  db: Kysely<DB>,
  observations: MetricObservation[],
): Promise<void> {
  await sql`
    INSERT INTO server_latest_metrics (
      server_id,
      observation_id,
      observed_at_ms,
      online_player_count,
      max_players,
      tps_1m,
      tps_5m,
      tps_15m,
      mspt_avg,
      mspt_p95,
      heap_used_bytes,
      heap_max_bytes,
      loaded_chunks,
      loaded_worlds,
      backend_server_count,
      extra
    )
    VALUES ${sql.join(
      observations.map((observation) => {
        return sql`(
          ${observation.serverId}::uuid,
          ${observation.id}::uuid,
          ${observation.observedAtMs}::bigint,
          ${observation.onlinePlayerCount},
          ${observation.maxPlayers ?? null},
          ${observation.tps1m ?? null},
          ${observation.tps5m ?? null},
          ${observation.tps15m ?? null},
          ${observation.msptAvg ?? null},
          ${observation.msptP95 ?? null},
          ${observation.heapUsedBytes ?? null},
          ${observation.heapMaxBytes ?? null},
          ${observation.loadedChunks ?? null},
          ${observation.loadedWorlds ?? null},
          ${observation.backendServerCount ?? null},
          '{}'::jsonb
        )`;
      }),
    )}
  `.execute(db);
}

function latestMetricObservations(observations: MetricObservation[]): MetricObservation[] {
  const rowsByServer = new Map<string, MetricObservation>();

  for (const observation of observations) {
    const current = rowsByServer.get(observation.serverId);

    if (!current || observation.observedAtMs > current.observedAtMs) {
      rowsByServer.set(observation.serverId, observation);
    }
  }

  return [...rowsByServer.values()];
}

function metricObservationSql(observation: MetricObservation) {
  return sql`(
    ${observation.id}::uuid,
    ${observation.serverId}::uuid,
    ${observation.observedAtMs}::bigint,
    ${observation.onlinePlayerCount},
    ${observation.maxPlayers ?? null},
    ${observation.tps1m ?? null},
    ${observation.tps5m ?? null},
    ${observation.tps15m ?? null},
    ${observation.msptAvg ?? null},
    ${observation.msptP95 ?? null},
    ${observation.heapUsedBytes ?? null},
    ${observation.heapMaxBytes ?? null},
    ${observation.loadedChunks ?? null},
    ${observation.loadedWorlds ?? null},
    ${observation.backendServerCount ?? null},
    '{}'::jsonb
  )`;
}

export default seed;
