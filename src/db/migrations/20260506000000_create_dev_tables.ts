import { type Kysely, sql } from "kysely";

const types = [
  "message_verdict",
  "priority",
  "punishment_appeal_status",
  "mod_case_status",
  "report_status",
  "punishment",
  "actor_type",
  "permission_effect",
  "permission_category",
  "server_lockdown_scope",
  "server_access_mode",
  "server_status",
  "server_env",
  "server_type",
  "friend_request_status",
  "chat_channel",
  "argus_account_status",
  "argus_account_role",
] as const;

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE SCHEMA IF NOT EXISTS public;
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  CREATE OR REPLACE FUNCTION get_unix_ms()
    RETURNS bigint
    LANGUAGE sql
    VOLATILE
  AS
  $$
  SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  $$;

  -- ============================
--  TYPES
-- ============================

  CREATE TYPE argus_account_role AS ENUM (
    'moderator',
    'admin'
    );

  CREATE TYPE argus_account_status AS ENUM (
    'active',
    'suspended',
    'disabled',
    'verify_email',
    'reset_password'
    );

-- Players

  CREATE TYPE chat_channel AS ENUM (
    'global',
    'staff',
    'testing'
    );

  CREATE TYPE friend_request_status AS ENUM (
    'accepted',
    'pending',
    'denied',
    'cancelled',
    'expired'
    );

-- Servers

  CREATE TYPE server_type AS ENUM (
    'paper',
    'velocity',
    'unspecified'
    );

  CREATE TYPE server_env AS ENUM (
    'production',
    'beta',
    'alpha',
    'development'
    );

  CREATE TYPE server_status AS ENUM (
    'online',
    'offline'
    );

  CREATE TYPE server_access_mode AS ENUM (
    'open',
    'min_rank',
    'permission'
    );

  CREATE TYPE server_lockdown_scope AS ENUM ('global', 'local');

-- Permissions

  CREATE TYPE permission_category AS ENUM (
    'general',
    'feature',
    'command',
    'moderation',
    'administration',
    'development'
    );

  CREATE TYPE permission_effect AS ENUM ( 'allow', 'deny');

  CREATE TYPE actor_type AS ENUM (
    'system',
    'application',
    'user',
    'unspecified'
    );

-- Punishments
  CREATE TYPE punishment AS ENUM (
    'ban',
    'mute',
    'warn',
    'kick'
    );

-- Moderation
  CREATE TYPE report_status AS ENUM (
    'open',
    'under_review',
    'actioned',
    'dismissed',
    'duplicate'
    );

  CREATE TYPE mod_case_status AS ENUM (
    'open',
    'investigating',
    'pending_action',
    'resolved',
    'dismissed',
    'closed'
    );

  CREATE TYPE punishment_appeal_status AS ENUM (
    'open',
    'under_review',
    'accepted',
    'rejected',
    'withdrawn'
    );

  CREATE TYPE priority AS ENUM (
    'very_high',
    'high',
    'medium',
    'low'
    );

  CREATE TYPE message_verdict AS ENUM ('allow', 'warn', 'deny');

-- Servers
  CREATE TABLE servers
  (
    id                   uuid PRIMARY KEY            DEFAULT gen_random_uuid(),
    name                 TEXT               NOT NULL UNIQUE,
    type                 server_type        NOT NULL DEFAULT 'unspecified',

    environment          server_env         NOT NULL DEFAULT 'development',
    status               server_status      NOT NULL DEFAULT 'offline',
    port                 INT                NULL CHECK (port BETWEEN 1 AND 65535),
    version              TEXT               NOT NULL DEFAULT 'Unspecified version',

    last_started_at_ms   BIGINT             NULL,
    last_heartbeat_at_ms BIGINT             NULL,

    created_at_ms        BIGINT             NOT NULL DEFAULT get_unix_ms(),
    last_updated_at_ms   BIGINT             NULL
  );
  CREATE INDEX idx_servers_type ON servers (type);
  CREATE INDEX idx_servers_environment ON servers (environment);

--  Players
  CREATE TABLE players
  (
    id              uuid PRIMARY KEY,
    username        TEXT         NOT NULL UNIQUE,
    flags           BIGINT       NOT NULL, -- application should set; no default
    orbs            BIGINT       NOT NULL DEFAULT 500,
    chat_channel    chat_channel NOT NULL DEFAULT 'global',
    created_at_ms   BIGINT       NOT NULL DEFAULT get_unix_ms(),
    last_seen_at_ms BIGINT       NULL,
    last_server_id  UUID         NULL REFERENCES servers (id) ON DELETE SET NULL,
    deleted_at_ms   BIGINT       NULL,
    deleted_reason  TEXT         NULL
  );
  CREATE INDEX idx_players_flags ON players (flags);
  CREATE INDEX idx_players_chat_channel ON players (chat_channel);
  CREATE INDEX idx_players_last_server ON players (last_server_id) WHERE last_server_id IS NOT NULL;

  CREATE TABLE player_identities
  (
    player_id     uuid PRIMARY KEY REFERENCES players (id) ON DELETE CASCADE,
    mojang_uuid   uuid   NOT NULL UNIQUE,
    created_at_ms BIGINT NOT NULL DEFAULT get_unix_ms()
  );

  CREATE TABLE actors
  (
    id                 uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    name               TEXT UNIQUE NULL,
    type               actor_type  NOT NULL DEFAULT 'unspecified',
    player_id          UUID        NULL
      REFERENCES players (id) ON DELETE SET NULL,
    created_at_ms      BIGINT      NOT NULL DEFAULT get_unix_ms(),
    last_updated_at_ms BIGINT      NULL
  );
  CREATE UNIQUE INDEX uq_actors_player_id ON actors (player_id) WHERE player_id IS NOT NULL;
  CREATE INDEX idx_actors_type ON actors (type);

  CREATE TABLE argus_users
  (
    id            UUID PRIMARY KEY              DEFAULT gen_random_uuid(),
    username      VARCHAR(100)         NOT NULL UNIQUE,
    email         VARCHAR(100)         NOT NULL UNIQUE,
    password_hash TEXT                 NOT NULL,

    role          argus_account_role   NOT NULL DEFAULT 'moderator',
    minecraft_id  UUID                 NULL REFERENCES players (id) ON DELETE SET NULL,
    account_state argus_account_status NOT NULL DEFAULT 'active',

    created_at_ms BIGINT               NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms BIGINT               NULL
  );
  CREATE INDEX idx_argus_users_role ON argus_users (role);
  CREATE INDEX idx_argus_users_account_state ON argus_users (account_state);

  CREATE TABLE argus_email_verifications
  (
    id            INT PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    account_id    UUID   NOT NULL REFERENCES argus_users (id) ON DELETE CASCADE,
    new_email     TEXT   NOT NULL,
    token_hash    TEXT   NOT NULL UNIQUE,
    expires_at_ms BIGINT NOT NULL
  );
  CREATE INDEX idx_argus_email_verifications_account
    ON argus_email_verifications (account_id);
  CREATE INDEX idx_argus_email_verifications_expires
    ON argus_email_verifications (expires_at_ms);

  CREATE TABLE argus_alerts
  (
    id            INT PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    title         TEXT UNIQUE NOT NULL,
    description   TEXT        NULL,
    priority      INT         NOT NULL DEFAULT 0,
    css_class     TEXT        NULL,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at_ms BIGINT      NOT NULL DEFAULT get_unix_ms()
  );

  CREATE TABLE api_keys
  (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permissions           JSONB   NOT NULL DEFAULT '[]'::jsonb,
    owner_actor_id        UUID    NOT NULL
      REFERENCES actors (id) ON DELETE RESTRICT,
    created_by_actor_id   UUID    NOT NULL
      REFERENCES actors (id) ON DELETE RESTRICT,
    can_bypass_rate_limit BOOLEAN NOT NULL DEFAULT FALSE,
    is_super_key          BOOLEAN NOT NULL DEFAULT FALSE,
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at_ms         BIGINT  NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms         BIGINT  NULL
  );
  CREATE INDEX idx_api_keys_owner_actor ON api_keys (owner_actor_id);
  CREATE INDEX idx_api_keys_created_by_actor ON api_keys (created_by_actor_id);
  CREATE INDEX idx_api_keys_active ON api_keys (created_at_ms DESC) WHERE is_active = TRUE;

  -- ============================
--  RANKS & GROUPS
-- ============================

  CREATE TABLE groups
  (
    key           VARCHAR(30) PRIMARY KEY,
    label         VARCHAR(50) NOT NULL UNIQUE,
    priority      INT         NOT NULL DEFAULT 0,
    is_staff      BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at_ms BIGINT      NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms BIGINT      NULL
  );
  CREATE INDEX idx_groups_is_staff ON groups (key) WHERE is_staff = TRUE;

  CREATE TABLE ranks
  (
    key           VARCHAR(30) PRIMARY KEY,
    group_key     VARCHAR(30) NULL REFERENCES groups (key) ON DELETE SET NULL,
    label         VARCHAR(50) NOT NULL UNIQUE,
    tier          INT         NOT NULL DEFAULT 0,
    is_staff      BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at_ms BIGINT      NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms BIGINT      NULL
  );
  CREATE INDEX idx_ranks_group_key ON ranks (group_key) WHERE group_key IS NOT NULL;
  CREATE INDEX idx_ranks_staff_active ON ranks (tier DESC) WHERE is_staff = TRUE AND is_active = TRUE;
  CREATE INDEX idx_ranks_active ON ranks (tier DESC) WHERE is_active = TRUE;

  -- ============================
--  PERMISSION SYSTEM SCHEMA
-- ============================

-- Permission Nodes (atomic abilities)
  CREATE TABLE permission_nodes
  (
    id            UUID PRIMARY KEY             DEFAULT gen_random_uuid(),
    key           TEXT                NOT NULL UNIQUE,
    description   TEXT                NULL,
    category      permission_category NOT NULL DEFAULT 'general',
    is_active     BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at_ms BIGINT              NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms BIGINT              NULL
  );

-- Permission Rules (bindings)
  CREATE TABLE permission_rules
  (
    id            UUID PRIMARY KEY           DEFAULT gen_random_uuid(),
    permission_id UUID              NOT NULL
      REFERENCES permission_nodes (id) ON DELETE CASCADE,
    group_key     VARCHAR(30)       NULL
      REFERENCES groups (key) ON DELETE CASCADE,
    rank_key      VARCHAR(30)       NULL
      REFERENCES ranks (key) ON DELETE CASCADE,

    min_rank_tier INT               NULL,
    effect        permission_effect NOT NULL DEFAULT 'allow',
    priority      INT               NOT NULL DEFAULT 0,

    created_at_ms BIGINT            NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms BIGINT            NULL,

    CONSTRAINT chk_permission_rules_single_subject
      CHECK (num_nonnulls(group_key, rank_key) = 1),
    CONSTRAINT chk_permission_rules_min_rank_tier
      CHECK (min_rank_tier IS NULL OR min_rank_tier >= 0)
  );

  CREATE INDEX idx_perm_rules_permission_id ON permission_rules (permission_id);
  CREATE INDEX idx_perm_rules_group_key ON permission_rules (group_key) WHERE group_key IS NOT NULL;
  CREATE INDEX idx_perm_rules_rank_key ON permission_rules (rank_key) WHERE rank_key IS NOT NULL;

  CREATE TABLE server_access_policies
  (
    server_id              UUID PRIMARY KEY REFERENCES servers (id) ON DELETE CASCADE,
    mode                   server_access_mode NOT NULL DEFAULT 'open',
    required_permission_id uuid               NULL REFERENCES permission_nodes (id) ON DELETE SET NULL,
    required_rank_key      VARCHAR(30)        NULL REFERENCES ranks (key) ON DELETE SET NULL,

    note                   TEXT               NULL,

    created_at_ms          BIGINT             NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms          BIGINT             NULL,

    CONSTRAINT chk_server_access_policies_mode_requirement
      CHECK (
        (mode = 'open' AND required_permission_id IS NULL AND required_rank_key IS NULL)
          OR
        (mode = 'permission' AND required_permission_id IS NOT NULL AND required_rank_key IS NULL)
          OR
        (mode = 'min_rank' AND required_rank_key IS NOT NULL AND required_permission_id IS NULL)
        )
  );
  CREATE INDEX idx_server_access_policies_mode ON server_access_policies (mode);
  CREATE INDEX idx_server_access_policies_required_permission_id
    ON server_access_policies (required_permission_id) WHERE required_permission_id IS NOT NULL;
  CREATE INDEX idx_server_access_policies_required_rank_key
    ON server_access_policies (required_rank_key) WHERE required_rank_key IS NOT NULL;

  CREATE TABLE lockdowns
  (
    id                 BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    scope              server_lockdown_scope NOT NULL,
    -- NULL for global, required for local
    server_id          UUID                  NULL REFERENCES servers (id) ON DELETE CASCADE,

    -- Minimum rank to bypass the lockdown (tier-based in required rank's group)
    required_rank_key  VARCHAR(30)           NOT NULL REFERENCES ranks (key) ON DELETE RESTRICT,

    reason             TEXT                  NOT NULL DEFAULT 'Maintenance',
    issued_by_actor_id UUID                  NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,

    is_active          BOOLEAN               NOT NULL DEFAULT TRUE,

    starts_at_ms       BIGINT                NOT NULL DEFAULT get_unix_ms(),
    ends_at_ms         BIGINT                NULL,

    created_at_ms      BIGINT                NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms      BIGINT                NULL,

    CONSTRAINT chk_lockdowns_scope
      CHECK (
        (scope = 'global' AND server_id IS NULL)
          OR
        (scope = 'local' AND server_id IS NOT NULL)
        ),
    CONSTRAINT chk_lockdowns_time_window CHECK (ends_at_ms IS NULL OR ends_at_ms >= starts_at_ms)
  );
-- One active GLOBAL lockdown at a time
  CREATE UNIQUE INDEX uq_lockdowns_active_global ON lockdowns (scope) WHERE is_active AND scope = 'global';
-- One active LOCAL lockdown per server at a time
  CREATE UNIQUE INDEX uq_lockdowns_active_local_per_server ON lockdowns (server_id) WHERE is_active AND scope = 'local';
  CREATE INDEX idx_lockdowns_active_scope ON lockdowns (is_active, scope);
  CREATE INDEX idx_lockdowns_server ON lockdowns (server_id);
  CREATE INDEX idx_lockdowns_required_rank ON lockdowns (required_rank_key);
  CREATE INDEX idx_lockdowns_starts_at_ms ON lockdowns (starts_at_ms);

  CREATE TABLE player_session_events
  (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    player_id          UUID   NOT NULL
      REFERENCES players (id) ON DELETE CASCADE,

    server_id          UUID   NOT NULL
      REFERENCES servers (id) ON DELETE RESTRICT,

    connected_at_ms    BIGINT NOT NULL  DEFAULT get_unix_ms(),
    disconnected_at_ms BIGINT NULL,

    disconnect_reason  TEXT   NULL,
    meta               JSONB  NOT NULL  DEFAULT '{}'::jsonb,
    updated_at_ms      BIGINT NULL,

    CONSTRAINT chk_player_session_time_window
      CHECK (disconnected_at_ms IS NULL OR disconnected_at_ms >= connected_at_ms)
  );
-- Enforce: at most one OPEN session per player (strong invariant)
  CREATE UNIQUE INDEX uq_player_session_events_one_open_per_player
    ON player_session_events (player_id)
    WHERE disconnected_at_ms IS NULL;
-- Common access patterns
  CREATE INDEX idx_player_session_events_player_connected_at
    ON player_session_events (player_id, connected_at_ms DESC);
  CREATE INDEX idx_player_session_events_server_connected_at
    ON player_session_events (server_id, connected_at_ms DESC);
  CREATE INDEX idx_player_session_events_connected_at
    ON player_session_events (connected_at_ms DESC);

  -- ---------------------------------------------------------
--  2) Current sessions ("online now")
-- ---------------------------------------------------------
  CREATE TABLE player_sessions_current
  (
    player_id        UUID PRIMARY KEY
      REFERENCES players (id) ON DELETE CASCADE,

    server_id        UUID   NOT NULL
      REFERENCES servers (id) ON DELETE RESTRICT,

    session_event_id UUID   NOT NULL UNIQUE
      REFERENCES player_session_events (id) ON DELETE CASCADE,

    connected_at_ms  BIGINT NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms    BIGINT NULL
  );
  CREATE INDEX idx_player_sessions_current_server
    ON player_sessions_current (server_id);
  CREATE INDEX idx_player_sessions_current_connected_at
    ON player_sessions_current (connected_at_ms DESC);

  CREATE TABLE badges
  (
    id            INT PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    key           TEXT    NOT NULL UNIQUE,
    label         TEXT    NOT NULL,
    description   TEXT    NULL,
    color         TEXT    NULL,
    emoji         TEXT    NULL,
    display_order INT     NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE
  );
  CREATE INDEX idx_badges_color ON badges (color) WHERE color IS NOT NULL;
  CREATE INDEX idx_badges_active_order ON badges (display_order, label) WHERE is_active = TRUE;

  CREATE TABLE player_profiles
  (
    player_id         uuid PRIMARY KEY REFERENCES players (id) ON DELETE CASCADE,
    bio               VARCHAR(500) NULL,
    pronouns          VARCHAR(16)  NULL,
    featured_badge_id INT          NULL REFERENCES badges (id) ON DELETE SET NULL,
    locale            VARCHAR(9)   NOT NULL DEFAULT 'en_US',
    preferences       jsonb        NOT NULL DEFAULT '{}'::jsonb
  );
  CREATE INDEX idx_player_profiles_pronouns ON player_profiles (pronouns) WHERE pronouns IS NOT NULL;
  CREATE INDEX idx_player_profiles_featured_badge_id
    ON player_profiles (featured_badge_id) WHERE featured_badge_id IS NOT NULL;
  CREATE INDEX idx_player_profiles_locale ON player_profiles (locale);

  CREATE TABLE player_ranks
  (
    player_id            UUID        NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    group_key            VARCHAR(30) NOT NULL REFERENCES groups (key) ON DELETE CASCADE,
    rank_key             VARCHAR(30) NOT NULL REFERENCES ranks (key) ON DELETE CASCADE,
    assigned_at_ms       BIGINT      NOT NULL DEFAULT get_unix_ms(),
    assigned_by_actor_id UUID        NULL REFERENCES actors (id) ON DELETE RESTRICT,
    source               TEXT        NULL,

    PRIMARY KEY (player_id, group_key)
  );
  CREATE INDEX idx_player_ranks_group_key ON player_ranks (group_key);
  CREATE INDEX idx_player_ranks_rank_key ON player_ranks (rank_key);
  CREATE INDEX idx_player_ranks_assigned_by_actor
    ON player_ranks (assigned_by_actor_id) WHERE assigned_by_actor_id IS NOT NULL;

  CREATE TABLE player_badges
  (
    player_id    UUID   NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    badge_id     INT    NOT NULL REFERENCES badges (id) ON DELETE CASCADE,
    earned_at_ms BIGINT NOT NULL DEFAULT get_unix_ms(),
    source       TEXT   NULL,
    PRIMARY KEY (player_id, badge_id)
  );
  CREATE INDEX idx_player_badges_badge_id ON player_badges (badge_id);

  CREATE TABLE player_flag_definitions
  (
    flag_key      TEXT PRIMARY KEY,
    bit_position  INT          NOT NULL UNIQUE CHECK (bit_position BETWEEN 0 AND 62),
    label         VARCHAR(100) NOT NULL UNIQUE,
    description   TEXT         NULL,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at_ms BIGINT       NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms BIGINT       NULL
  );
  CREATE INDEX idx_player_flag_definitions_active
    ON player_flag_definitions (bit_position) WHERE is_active = TRUE;

  CREATE TABLE player_nicknames
  (
    id                  INT PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    player_id           UUID        NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    nickname            VARCHAR(17) NOT NULL,
    meta                JSONB       NOT NULL DEFAULT '{}'::jsonb,
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    revoked_by_actor_id UUID        NULL REFERENCES actors (id) ON DELETE RESTRICT,
    created_at_ms       BIGINT      NOT NULL DEFAULT get_unix_ms(),
    revoked_at_ms       BIGINT      NULL,

    CONSTRAINT chk_player_nicknames_revocation_consistent
      CHECK (
        (is_active = TRUE AND revoked_at_ms IS NULL AND revoked_by_actor_id IS NULL)
          OR
        (is_active = FALSE AND revoked_at_ms IS NOT NULL)
        )
  );
  CREATE UNIQUE INDEX uq_player_nicknames_one_active_per_player
    ON player_nicknames (player_id)
    WHERE is_active = TRUE;
  CREATE UNIQUE INDEX uq_player_nicknames_one_active_per_nickname_ci
    ON player_nicknames (lower(nickname))
    WHERE is_active = TRUE;
  CREATE INDEX idx_player_nicknames_player_created
    ON player_nicknames (player_id, created_at_ms DESC);
  CREATE INDEX idx_player_nicknames_revoked_by_actor
    ON player_nicknames (revoked_by_actor_id)
    WHERE revoked_by_actor_id IS NOT NULL;

-- Punishments
  CREATE TABLE punishments
  (
    id               UUID PRIMARY KEY    DEFAULT gen_random_uuid(),
    subject_actor_id UUID       NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    issuer_actor_id  UUID       NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    server_origin_id UUID       NULL REFERENCES servers (id) ON DELETE SET NULL,
    type             punishment NOT NULL,
    ends_at_ms       BIGINT     NULL,
    is_silent        BOOLEAN    NOT NULL DEFAULT FALSE,
    reason           TEXT       NULL,
    created_at_ms    BIGINT     NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms    BIGINT     NULL
  );
  CREATE INDEX idx_punishments_subject_created
    ON punishments (subject_actor_id, created_at_ms DESC);
  CREATE INDEX idx_punishments_issuer_created
    ON punishments (issuer_actor_id, created_at_ms DESC);
  CREATE INDEX idx_punishments_type_created
    ON punishments (type, created_at_ms DESC);
  CREATE INDEX idx_punishments_subject_type_ends
    ON punishments (subject_actor_id, type, ends_at_ms)
    WHERE ends_at_ms IS NOT NULL;
  CREATE INDEX idx_punishments_server_origin
    ON punishments (server_origin_id)
    WHERE server_origin_id IS NOT NULL;
  CREATE INDEX idx_punishments_silent_created
    ON punishments (created_at_ms DESC)
    WHERE is_silent = TRUE;

  CREATE TABLE chat_channels
  (
    key               VARCHAR(30) PRIMARY KEY,
    description       TEXT        NULL,
    required_rank_key VARCHAR(30) NULL REFERENCES ranks (key) ON DELETE SET NULL,
    is_staff          BOOLEAN     NOT NULL DEFAULT FALSE,
    is_hidden         BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at_ms     BIGINT      NOT NULL DEFAULT get_unix_ms()
  );
  CREATE INDEX idx_chat_channels_required_rank_key
    ON chat_channels (required_rank_key) WHERE required_rank_key IS NOT NULL;
  CREATE INDEX idx_chat_channels_active_visible
    ON chat_channels (key) WHERE is_active = TRUE AND is_hidden = FALSE;

  CREATE TABLE chat_messages
  (
    id               UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    actor_id         UUID        NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    message          TEXT        NOT NULL,
    channel_key      VARCHAR(30) NOT NULL REFERENCES chat_channels (key) ON DELETE RESTRICT,
    origin_server_id UUID        NULL REFERENCES servers (id) ON DELETE SET NULL,
    created_at_ms    BIGINT      NOT NULL DEFAULT get_unix_ms()
  );
  CREATE INDEX idx_chat_messages_channel_created
    ON chat_messages (channel_key, created_at_ms DESC);
  CREATE INDEX idx_chat_messages_actor_created
    ON chat_messages (actor_id, created_at_ms DESC);
  CREATE INDEX idx_chat_messages_origin_server_created
    ON chat_messages (origin_server_id, created_at_ms DESC)
    WHERE origin_server_id IS NOT NULL;

  CREATE TABLE reports
  (
    id                 UUID PRIMARY KEY       DEFAULT gen_random_uuid(),
    reporter_actor_id  UUID          NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    subject_actor_id   UUID          NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    selected_reason    VARCHAR(100)  NOT NULL,
    reason_description TEXT          NULL,
    status             report_status NOT NULL DEFAULT 'open',
    priority           priority      NULL,
    origin_server_id   UUID          NULL REFERENCES servers (id) ON DELETE SET NULL,
    closed_by_actor_id UUID          NULL REFERENCES actors (id) ON DELETE RESTRICT,
    closed_at_ms       BIGINT        NULL,
    created_at_ms      BIGINT        NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms      BIGINT        NULL,

    CONSTRAINT chk_reports_closed_consistent
      CHECK (
        (closed_at_ms IS NULL AND closed_by_actor_id IS NULL)
          OR
        (closed_at_ms IS NOT NULL AND closed_by_actor_id IS NOT NULL)
        )
  );
  CREATE INDEX idx_reports_status_priority_created
    ON reports (status, priority, created_at_ms DESC);
  CREATE INDEX idx_reports_reporter_created
    ON reports (reporter_actor_id, created_at_ms DESC);
  CREATE INDEX idx_reports_subject_created
    ON reports (subject_actor_id, created_at_ms DESC);
  CREATE INDEX idx_reports_selected_reason_created
    ON reports (selected_reason, created_at_ms DESC);
  CREATE INDEX idx_reports_origin_server_created
    ON reports (origin_server_id, created_at_ms DESC)
    WHERE origin_server_id IS NOT NULL;
  CREATE INDEX idx_reports_closed_by_actor
    ON reports (closed_by_actor_id, closed_at_ms DESC)
    WHERE closed_by_actor_id IS NOT NULL;

  CREATE TABLE report_comments
  (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id         UUID    NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
    author_actor_id   UUID    NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    parent_comment_id UUID    NULL REFERENCES report_comments (id) ON DELETE SET NULL,
    comment_text      TEXT    NOT NULL,
    is_sticky         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at_ms     BIGINT  NOT NULL DEFAULT get_unix_ms(),
    edited_at_ms      BIGINT  NULL,

    CONSTRAINT chk_report_comments_not_own_parent
      CHECK (parent_comment_id IS NULL OR parent_comment_id <> id)
  );

  CREATE INDEX idx_report_comments_report_created
    ON report_comments (report_id, created_at_ms);
  CREATE INDEX idx_report_comments_parent_created
    ON report_comments (parent_comment_id, created_at_ms)
    WHERE parent_comment_id IS NOT NULL;
  CREATE INDEX idx_report_comments_author_created
    ON report_comments (author_actor_id, created_at_ms DESC);
  CREATE INDEX idx_report_comments_sticky_by_report
    ON report_comments (report_id, created_at_ms)
    WHERE is_sticky = TRUE;

  CREATE TABLE punishment_appeals
  (
    id                  UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    appellant_actor_id  UUID                     NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    infraction_ref_id   UUID                     NULL REFERENCES punishments (id) ON DELETE SET NULL,
    infraction_category punishment               NOT NULL,
    status              punishment_appeal_status NOT NULL DEFAULT 'open',
    closed_by_actor_id  UUID                     NULL REFERENCES actors (id) ON DELETE RESTRICT,
    created_at_ms       BIGINT                   NOT NULL DEFAULT get_unix_ms(),
    closed_at_ms        BIGINT                   NULL,

    CONSTRAINT chk_punishment_appeals_closed_consistent
      CHECK (
        (closed_at_ms IS NULL AND closed_by_actor_id IS NULL)
          OR
        (closed_at_ms IS NOT NULL AND closed_by_actor_id IS NOT NULL)
        )
  );
  CREATE INDEX idx_punishment_appeals_appellant_created
    ON punishment_appeals (appellant_actor_id, created_at_ms DESC);
  CREATE INDEX idx_punishment_appeals_status_created
    ON punishment_appeals (status, created_at_ms DESC);
  CREATE INDEX idx_punishment_appeals_infraction_ref
    ON punishment_appeals (infraction_ref_id)
    WHERE infraction_ref_id IS NOT NULL;
  CREATE INDEX idx_punishment_appeals_category_created
    ON punishment_appeals (infraction_category, created_at_ms DESC);
  CREATE INDEX idx_punishment_appeals_closed_by_actor
    ON punishment_appeals (closed_by_actor_id, closed_at_ms DESC)
    WHERE closed_by_actor_id IS NOT NULL;

  CREATE TABLE mod_cases
  (
    id                 UUID PRIMARY KEY         DEFAULT gen_random_uuid(),
    title              TEXT            NOT NULL DEFAULT 'Unspecified title',
    description        TEXT            NULL,
    opened_by_actor_id UUID            NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    closed_by_actor_id UUID            NULL REFERENCES actors (id) ON DELETE RESTRICT,
    status             mod_case_status NOT NULL DEFAULT 'open',
    priority           priority        NULL,
    is_sticky          BOOLEAN         NOT NULL DEFAULT FALSE,
    opened_at_ms       BIGINT          NOT NULL DEFAULT get_unix_ms(),
    closed_at_ms       BIGINT          NULL,

    CONSTRAINT chk_mod_cases_closed_consistent
      CHECK (
        (closed_at_ms IS NULL AND closed_by_actor_id IS NULL)
          OR
        (closed_at_ms IS NOT NULL AND closed_by_actor_id IS NOT NULL)
        )
  );
  CREATE INDEX idx_mod_cases_status_priority_opened
    ON mod_cases (status, priority, opened_at_ms DESC);
  CREATE INDEX idx_mod_cases_opened_by_actor
    ON mod_cases (opened_by_actor_id, opened_at_ms DESC);
  CREATE INDEX idx_mod_cases_closed_by_actor
    ON mod_cases (closed_by_actor_id, closed_at_ms DESC)
    WHERE closed_by_actor_id IS NOT NULL;
  CREATE INDEX idx_mod_cases_sticky_open
    ON mod_cases (opened_at_ms DESC)
    WHERE is_sticky = TRUE AND closed_at_ms IS NULL;

  CREATE TABLE player_watchlist_entries
  (
    id                  INT PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    subject_actor_id    UUID   NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    added_by_actor_id   UUID   NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    reason              TEXT   NULL,
    cleared_by_actor_id UUID   NULL REFERENCES actors (id) ON DELETE RESTRICT,
    cleared_at_ms       BIGINT NULL,
    added_at_ms         BIGINT NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms       BIGINT NULL,

    CONSTRAINT chk_player_watchlist_entries_clear_consistent
      CHECK (
        (cleared_at_ms IS NULL AND cleared_by_actor_id IS NULL)
          OR
        (cleared_at_ms IS NOT NULL AND cleared_by_actor_id IS NOT NULL)
        )
  );

  CREATE UNIQUE INDEX uq_player_watchlist_entries_one_active_per_subject
    ON player_watchlist_entries (subject_actor_id)
    WHERE cleared_at_ms IS NULL;
  CREATE INDEX idx_player_watchlist_entries_subject_added
    ON player_watchlist_entries (subject_actor_id, added_at_ms DESC);
  CREATE INDEX idx_player_watchlist_entries_added_by_actor
    ON player_watchlist_entries (added_by_actor_id, added_at_ms DESC);
  CREATE INDEX idx_player_watchlist_entries_cleared_by_actor
    ON player_watchlist_entries (cleared_by_actor_id, cleared_at_ms DESC)
    WHERE cleared_by_actor_id IS NOT NULL;

  -- ---------------------------------------------------------
--  TRIGGERS
-- ---------------------------------------------------------

  -- ---------------------------------------------------------
--  Trigger logic to keep player sessions
-- ---------------------------------------------------------
  CREATE OR REPLACE FUNCTION sync_player_sessions_current()
    RETURNS TRIGGER
    LANGUAGE plpgsql
  AS
  $$
  BEGIN
    -- Always keep updated_at fresh on any write
    NEW.updated_at_ms := get_unix_ms();

    -- Case A: INSERT of a new open session (disconnected_at NULL)
    IF (TG_OP = 'INSERT') THEN
      IF (NEW.disconnected_at_ms IS NULL) THEN
        -- If a current session already exists, we treat it as a hard invariant violation
        IF EXISTS (SELECT 1 FROM player_sessions_current c WHERE c.player_id = NEW.player_id) THEN
          RAISE EXCEPTION
            'Invariant violation: player % already has an active session in player_sessions_current',
            NEW.player_id
            USING ERRCODE = '23514'; -- check_violation
        END IF;

        INSERT INTO player_sessions_current (player_id, server_id, session_event_id, connected_at_ms, updated_at_ms)
        VALUES (NEW.player_id, NEW.server_id, NEW.id, NEW.connected_at_ms, get_unix_ms());
      END IF;

      RETURN NEW;
    END IF;

    -- Case B: UPDATE that closes the session (NULL -> NOT NULL)
    IF (TG_OP = 'UPDATE') THEN
      IF (OLD.disconnected_at_ms IS NULL AND NEW.disconnected_at_ms IS NOT NULL) THEN
        DELETE
        FROM player_sessions_current c
        WHERE c.session_event_id = NEW.id;
      ELSIF (OLD.disconnected_at_ms IS NULL AND NEW.disconnected_at_ms IS NULL) THEN
        -- Optional: if you ever support server transfers without disconnecting
        -- keep current row aligned. Otherwise, you can omit this branch.
        UPDATE player_sessions_current c
        SET server_id       = NEW.server_id,
            connected_at_ms = NEW.connected_at_ms,
            updated_at_ms   = get_unix_ms()
        WHERE c.session_event_id = NEW.id;
      END IF;

      RETURN NEW;
    END IF;

    RETURN NEW;
  END;
  $$;

  DROP TRIGGER IF EXISTS trg_sync_player_sessions_current_ins ON player_session_events;
  CREATE TRIGGER trg_sync_player_sessions_current_ins
    AFTER INSERT
    ON player_session_events
    FOR EACH ROW
  EXECUTE FUNCTION sync_player_sessions_current();

  DROP TRIGGER IF EXISTS trg_sync_player_sessions_current_upd ON player_session_events;
  CREATE TRIGGER trg_sync_player_sessions_current_upd
    BEFORE UPDATE
    ON player_session_events
    FOR EACH ROW
  EXECUTE FUNCTION sync_player_sessions_current();
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP FUNCTION IF EXISTS sync_player_sessions_current() CASCADE`.execute(db);

  await sql`
    DO $$
    DECLARE
      table_record record;
    BEGIN
      FOR table_record IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT IN ('kysely_migration', 'kysely_migration_lock')
      LOOP
        EXECUTE format(
          'DROP TABLE IF EXISTS %I.%I CASCADE',
          table_record.schemaname,
          table_record.tablename
        );
      END LOOP;
    END $$;
  `.execute(db);

  for (const type of types) {
    await sql`DROP TYPE IF EXISTS ${sql.raw(type)} CASCADE`.execute(db);
  }

  await sql`DROP FUNCTION IF EXISTS get_unix_ms() CASCADE`.execute(db);
}
