import { type Kysely, sql } from "kysely";

const types = [
  "severity",
  "moderation_resource_type",
  "moderation_link_type",
  "moderation_evidence_type",
  "moderation_event_type",
  "report_resolution",
  "mod_case_resolution",
  "bug_report_status",
  "moderation_case_actor_role",

  "principal_type",
  "user_privilege_role",
  "platform",
  "message_verdict",
  "punishment_appeal_status",
  "mod_case_status",
  "report_status",
  "punishment_lifted_cause",
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
  "argus_account_security_lock",
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

  CREATE TYPE user_privilege_role AS ENUM (
    'none',
    'collaborator',
    'moderator',
    'administrator',
    'superadmin'
    );

-- Where the request/action came from or belongs operationally
  CREATE TYPE platform AS ENUM (
    'minecraft',
    'discord',
    'argus',
    'bot',
    'other'
    );

-- How the request was authenticated
  CREATE TYPE principal_type AS ENUM (
    'argus_user',
    'minecraft_session',
    'server_api_key',
    'service_actor_api_key',
    'user_api_key',
    'discord_bot',
    'internal_worker',
    'system',
    'unknown'
    );

  CREATE TYPE argus_account_status AS ENUM (
    'active',
    'suspended',
    'disabled',
    'verify_email'
    );

  CREATE TYPE argus_account_security_lock AS ENUM (
    'change_password',
    'reset_password'
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
    'vanilla',
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

  -- ============================================================
-- Shared moderation enums
-- ============================================================

  CREATE TYPE severity AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
    );

  CREATE TYPE moderation_resource_type AS ENUM (
    'actor',
    'server',
    'report',
    'report_comment',
    'appeal',
    'mod_case',
    'watchlist_entry',
    'infraction',
    'punishment',
    'chat_message',
    'bug_report',
    'external_url',
    'file'
    );

  CREATE TYPE moderation_link_type AS ENUM (
    'related_to',
    'evidence_for',
    'subject_of',
    'reporter_of',
    'appellant_of',
    'escalated_to',
    'created_from',
    'attached_to',
    'appeals',
    'resulted_in',
    'duplicate_of',
    'blocked_by',
    'mentions',
    'involves',
    'resolved_by'
    );

  CREATE TYPE moderation_evidence_type AS ENUM (
    'chat_message',
    'chat_context',
    'screenshot',
    'video',
    'server_log',
    'command_log',
    'bug_report',
    'external_url',
    'file',
    'staff_observation',
    'other'
    );

  CREATE TYPE moderation_event_type AS ENUM (
    'created',
    'updated',
    'status_changed',
    'priority_changed',
    'severity_changed',
    'assigned',
    'triaged',
    'comment_added',
    'comment_edited',
    'evidence_added',
    'evidence_removed',
    'linked_resource',
    'unlinked_resource',
    'escalated_to_case',
    'infraction_issued',
    'appeal_opened',
    'appeal_closed',
    'watchlist_added',
    'watchlist_cleared',
    'closed',
    'reopened'
    );

  CREATE TYPE report_resolution AS ENUM (
    'action_taken',
    'no_action',
    'insufficient_evidence',
    'duplicate',
    'escalated_to_case',
    'false_report',
    'resolved_elsewhere'
    );

  CREATE TYPE mod_case_resolution AS ENUM (
    'action_taken',
    'no_action',
    'insufficient_evidence',
    'monitoring',
    'referred',
    'duplicate',
    'invalid',
    'resolved_elsewhere'
    );

  CREATE TYPE bug_report_status AS ENUM (
    'open',
    'reviewing',
    'confirmed',
    'in_progress',
    'resolved',
    'duplicate',
    'invalid',
    'closed'
    );

  CREATE TYPE moderation_case_actor_role AS ENUM (
    'subject',
    'reporter',
    'victim',
    'witness',
    'suspected_alt',
    'related_actor',
    'assigned_mod',
    'reviewer'
    );

-- Punishments
  CREATE TYPE punishment AS ENUM (
    'ban',
    'mute',
    'warn',
    'kick'
    );

  CREATE TYPE punishment_lifted_cause AS ENUM (
    'expired',
    'revoked',
    'appeal_accepted'
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

  CREATE TYPE message_verdict AS ENUM ('allow', 'warn', 'deny');

-----------------------------------------------------------

  CREATE TABLE servers
  (
    id                   uuid PRIMARY KEY       DEFAULT gen_random_uuid(),
    name                 TEXT          NOT NULL UNIQUE,
    type                 server_type   NOT NULL DEFAULT 'unspecified',

    environment          server_env    NOT NULL DEFAULT 'development',
    status               server_status NOT NULL DEFAULT 'offline',
    port                 INT           NULL CHECK (port BETWEEN 1 AND 65535),
    version              TEXT          NOT NULL DEFAULT 'Unspecified version',

    last_started_at_ms   BIGINT        NULL,
    last_heartbeat_at_ms BIGINT        NULL,

    created_at_ms        BIGINT        NOT NULL DEFAULT get_unix_ms(),
    last_updated_at_ms   BIGINT        NULL
  );
  CREATE INDEX idx_servers_type ON servers (type);
  CREATE INDEX idx_servers_environment ON servers (environment);

  CREATE TABLE server_heartbeat_observations
  (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id            UUID   NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
    observed_at_ms       BIGINT NOT NULL DEFAULT get_unix_ms(),

    online_player_count  INT    NULL CHECK (online_player_count >= 0),
    max_players          INT    NULL CHECK (max_players >= 0),
    tps_1m               NUMERIC(6, 3) NULL CHECK (tps_1m >= 0),
    tps_5m               NUMERIC(6, 3) NULL CHECK (tps_5m >= 0),
    tps_15m              NUMERIC(6, 3) NULL CHECK (tps_15m >= 0),
    mspt_avg             NUMERIC(8, 3) NULL CHECK (mspt_avg >= 0),
    mspt_p95             NUMERIC(8, 3) NULL CHECK (mspt_p95 >= 0),
    heap_used_bytes      BIGINT NULL CHECK (heap_used_bytes >= 0),
    heap_max_bytes       BIGINT NULL CHECK (heap_max_bytes >= 0),
    loaded_chunks        INT    NULL CHECK (loaded_chunks >= 0),
    loaded_worlds        INT    NULL CHECK (loaded_worlds >= 0),
    backend_server_count INT    NULL CHECK (backend_server_count >= 0),
    extra                JSONB  NOT NULL DEFAULT '{}'::jsonb
  );
  CREATE INDEX idx_server_heartbeat_observations_server_observed
    ON server_heartbeat_observations (server_id, observed_at_ms DESC);
  CREATE INDEX idx_server_heartbeat_observations_observed
    ON server_heartbeat_observations (observed_at_ms DESC);

  CREATE TABLE server_latest_metrics
  (
    server_id            UUID PRIMARY KEY REFERENCES servers (id) ON DELETE CASCADE,
    observation_id       UUID   NOT NULL REFERENCES server_heartbeat_observations (id) ON DELETE CASCADE,
    observed_at_ms       BIGINT NOT NULL,

    online_player_count  INT    NULL CHECK (online_player_count >= 0),
    max_players          INT    NULL CHECK (max_players >= 0),
    tps_1m               NUMERIC(6, 3) NULL CHECK (tps_1m >= 0),
    tps_5m               NUMERIC(6, 3) NULL CHECK (tps_5m >= 0),
    tps_15m              NUMERIC(6, 3) NULL CHECK (tps_15m >= 0),
    mspt_avg             NUMERIC(8, 3) NULL CHECK (mspt_avg >= 0),
    mspt_p95             NUMERIC(8, 3) NULL CHECK (mspt_p95 >= 0),
    heap_used_bytes      BIGINT NULL CHECK (heap_used_bytes >= 0),
    heap_max_bytes       BIGINT NULL CHECK (heap_max_bytes >= 0),
    loaded_chunks        INT    NULL CHECK (loaded_chunks >= 0),
    loaded_worlds        INT    NULL CHECK (loaded_worlds >= 0),
    backend_server_count INT    NULL CHECK (backend_server_count >= 0),
    extra                JSONB  NOT NULL DEFAULT '{}'::jsonb,
    updated_at_ms        BIGINT NOT NULL DEFAULT get_unix_ms()
  );

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
    key                VARCHAR(30) PRIMARY KEY,
    group_key          VARCHAR(30) NULL REFERENCES groups (key) ON DELETE SET NULL,
    label              VARCHAR(50) NOT NULL UNIQUE,
    description        TEXT        NULL,

    -- Meta
    visuals            JSONB       NOT NULL DEFAULT '{}',

    tier               INT         NOT NULL DEFAULT 0,

    is_staff           BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active          BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at_ms      BIGINT      NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms      BIGINT      NULL
  );
  CREATE INDEX idx_ranks_group_key ON ranks (group_key) WHERE group_key IS NOT NULL;
  CREATE INDEX idx_ranks_staff_active ON ranks (tier DESC) WHERE is_staff = TRUE AND is_active = TRUE;
  CREATE INDEX idx_ranks_active ON ranks (tier DESC) WHERE is_active = TRUE;

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

  CREATE TABLE actors
  (
    id                 uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    name               TEXT UNIQUE NULL,
    type               actor_type  NOT NULL DEFAULT 'unspecified',
    created_at_ms      BIGINT      NOT NULL DEFAULT get_unix_ms(),
    last_updated_at_ms BIGINT      NULL
  );
  CREATE INDEX idx_actors_type ON actors (type);

--  Players
  CREATE TABLE players
  (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mojang_id          UUID        NOT NULL UNIQUE,
    actor_id           UUID        NOT NULL UNIQUE REFERENCES actors (id) ON DELETE RESTRICT,
    username           TEXT        NOT NULL UNIQUE,

    flags              BIGINT      NOT NULL, -- application should set; no default
    orbs               BIGINT      NOT NULL DEFAULT 500,
    active_channel_key VARCHAR(30) NOT NULL DEFAULT 'global' REFERENCES chat_channels (key) ON DELETE RESTRICT,

    created_at_ms      BIGINT      NOT NULL DEFAULT get_unix_ms(),
    last_seen_at_ms    BIGINT      NULL,
    last_server_id     UUID        NULL REFERENCES servers (id) ON DELETE SET NULL,

    deleted_at_ms      BIGINT      NULL,
    deleted_reason     TEXT       NULL
  );
  CREATE INDEX idx_players_flags ON players (flags);
  CREATE INDEX idx_players_actor ON players (actor_id);
  CREATE INDEX idx_players_active_channel_key ON players (active_channel_key);
  CREATE INDEX idx_players_last_server ON players (last_server_id) WHERE last_server_id IS NOT NULL;

  CREATE TABLE argus_users
  (
    id            UUID PRIMARY KEY              DEFAULT gen_random_uuid(),
    username      VARCHAR(100)         NOT NULL UNIQUE,
    email         VARCHAR(100)         NOT NULL UNIQUE,
    password_hash TEXT                 NULL,

    role          argus_account_role   NOT NULL,
    actor_id      UUID                 NULL REFERENCES actors (id) ON DELETE SET NULL,
    account_state argus_account_status NOT NULL DEFAULT 'active',
    account_security_lock argus_account_security_lock NULL DEFAULT NULL,

    created_at_ms BIGINT               NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms BIGINT               NULL
  );
  CREATE INDEX idx_argus_users_role ON argus_users (role);
  CREATE INDEX idx_argus_users_account_state ON argus_users (account_state);

  CREATE TABLE argus_sessions
  (
    id                        UUID PRIMARY KEY,
    argus_user_id             UUID   NOT NULL REFERENCES argus_users (id) ON DELETE CASCADE,
    created_at_ms             BIGINT NOT NULL DEFAULT get_unix_ms(),
    last_seen_at_ms           BIGINT NOT NULL,
    expires_at_ms             BIGINT NOT NULL,
    revoked_at_ms             BIGINT NULL,
    revoked_by_actor_id       UUID   NULL REFERENCES actors (id) ON DELETE SET NULL,
    revoked_by_argus_user_id  UUID   NULL REFERENCES argus_users (id) ON DELETE SET NULL,
    ip_address                TEXT   NULL,
    user_agent                TEXT   NULL
  );
  CREATE INDEX idx_argus_sessions_user_last_seen
    ON argus_sessions (argus_user_id, last_seen_at_ms DESC);
  CREATE INDEX idx_argus_sessions_expires
    ON argus_sessions (expires_at_ms);
  CREATE INDEX idx_argus_sessions_revoked
    ON argus_sessions (revoked_at_ms)
    WHERE revoked_at_ms IS NOT NULL;

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

  CREATE TABLE argus_notifications
  (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id    UUID   NOT NULL REFERENCES argus_users (id) ON DELETE CASCADE,
    title         TEXT   NOT NULL,
    description   TEXT   NULL,
    priority      INT    NOT NULL DEFAULT 0,
    read_at_ms    BIGINT NULL,
    created_at_ms BIGINT NOT NULL DEFAULT get_unix_ms()
  );
  CREATE INDEX idx_argus_notifications_account_unread
    ON argus_notifications (account_id, read_at_ms, priority DESC, created_at_ms DESC);

  CREATE TABLE argus_dm_conversations
  (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               TEXT   NOT NULL CHECK (length(trim(title)) > 0 AND length(title) <= 160),
    owner_argus_user_id UUID   NULL REFERENCES argus_users (id) ON DELETE SET NULL,
    created_at_ms       BIGINT NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms       BIGINT NULL
  );
  CREATE INDEX idx_argus_dm_conversations_owner
    ON argus_dm_conversations (owner_argus_user_id) WHERE owner_argus_user_id IS NOT NULL;
  CREATE INDEX idx_argus_dm_conversations_created
    ON argus_dm_conversations (created_at_ms DESC);

  CREATE TABLE argus_dm_participants
  (
    conversation_id UUID   NOT NULL REFERENCES argus_dm_conversations (id) ON DELETE CASCADE,
    argus_user_id   UUID   NOT NULL REFERENCES argus_users (id) ON DELETE CASCADE,
    invited_by_argus_user_id UUID NULL REFERENCES argus_users (id) ON DELETE SET NULL,
    joined_at_ms    BIGINT NOT NULL DEFAULT get_unix_ms(),
    last_read_at_ms BIGINT NULL,
    left_at_ms      BIGINT NULL,
    PRIMARY KEY (conversation_id, argus_user_id)
  );
  CREATE INDEX idx_argus_dm_participants_user_active
    ON argus_dm_participants (argus_user_id, conversation_id) WHERE left_at_ms IS NULL;
  CREATE INDEX idx_argus_dm_participants_conversation_active
    ON argus_dm_participants (conversation_id, argus_user_id) WHERE left_at_ms IS NULL;

  CREATE TABLE argus_dm_messages
  (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID   NOT NULL REFERENCES argus_dm_conversations (id) ON DELETE CASCADE,
    author_argus_user_id UUID   NULL REFERENCES argus_users (id) ON DELETE SET NULL,
    body                TEXT   NOT NULL CHECK (length(trim(body)) > 0 AND length(body) <= 10000),
    created_at_ms       BIGINT NOT NULL DEFAULT get_unix_ms(),
    edited_at_ms        BIGINT NULL,
    deleted_at_ms       BIGINT NULL,
    deleted_by_argus_user_id UUID NULL REFERENCES argus_users (id) ON DELETE SET NULL
  );
  CREATE INDEX idx_argus_dm_messages_conversation_created
    ON argus_dm_messages (conversation_id, created_at_ms ASC);
  CREATE INDEX idx_argus_dm_messages_author
    ON argus_dm_messages (author_argus_user_id) WHERE author_argus_user_id IS NOT NULL;

  -- API Keys
--   Note: Items such as last used will be implemented later
  CREATE TABLE api_keys
  (
    id                    UUID PRIMARY KEY        DEFAULT gen_random_uuid(),

    key                   UUID UNIQUE    NOT NULL DEFAULT gen_random_uuid(),
    key_hash              TEXT           NOT NULL,
    principal_type        principal_type NOT NULL,
    platform              platform       NOT NULL,

    -- API Permissions are independent and scoped; not related to permission nodes
    permissions           JSONB          NOT NULL DEFAULT '[]'::jsonb,

    owner_actor_id        UUID           NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,

    created_by_actor_id   UUID           NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    revoked_by_actor_id   UUID           NULL REFERENCES actors (id) ON DELETE RESTRICT,

    can_bypass_rate_limit BOOLEAN        NOT NULL DEFAULT FALSE,
    is_super_key          BOOLEAN        NOT NULL DEFAULT FALSE,

    is_active             BOOLEAN        NOT NULL DEFAULT TRUE,

    created_at_ms         BIGINT         NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms         BIGINT         NULL
  );
  CREATE INDEX idx_api_keys_owner_actor ON api_keys (owner_actor_id);
  CREATE INDEX idx_api_keys_created_by_actor ON api_keys (created_by_actor_id);
  CREATE INDEX idx_api_keys_active ON api_keys (created_at_ms DESC) WHERE is_active = TRUE;

  CREATE TABLE privileged_subjects
  (
    id                   UUID PRIMARY KEY             DEFAULT gen_random_uuid(),
    actor_id             UUID                NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    status               TEXT                NOT NULL CHECK ( status IN ('active', 'suspended', 'revoked', 'pending')),
    role                 user_privilege_role NOT NULL,
    title                TEXT                NULL,
    enrolled_by_actor_id UUID                NULL REFERENCES actors (id) ON DELETE RESTRICT,
    revoked_by_actor_id  UUID                NULL REFERENCES actors (id) ON DELETE RESTRICT,
    created_at_ms        BIGINT              NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms        BIGINT              NULL
  );

  CREATE TABLE audit_logs
  (
    id               UUID PRIMARY KEY        DEFAULT gen_random_uuid(),

    request_id       UUID           NULL,

    actor_id         UUID           NULL REFERENCES actors (id) ON DELETE RESTRICT,

    subject_actor_id UUID           NULL REFERENCES actors (id) ON DELETE RESTRICT,

    principal_type   principal_type NULL,
    principal_id     UUID           NULL,

    platform         platform       NULL,
    source           TEXT           NULL,

    action           TEXT           NOT NULL,

    target_type      TEXT           NULL,
    target_id        UUID           NULL,

    result           TEXT           NOT NULL CHECK (
      result IN ('allowed', 'denied', 'failed')
      ),

    reason           TEXT           NULL,

    metadata         JSONB          NULL     DEFAULT '{}'::jsonb,

    created_at_ms    BIGINT         NOT NULL DEFAULT get_unix_ms()
  );

  -- ============================
--  Minecraft Permissions
-- Permission nodes and policies are specific to the Minecraft platform and gate access by rank.
-- Non-Minecraft identities, such as Argus users and API keys, do not use these permission nodes.
-- Staff-facing systems usually also require the user to be listed in privileged_subjects with the appropriate role or permissions.
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
  CREATE TABLE permission_policies
  (
    permission_id UUID              NOT NULL
      REFERENCES permission_nodes (id) ON DELETE CASCADE,

    rank_key      VARCHAR(30)       NULL
      REFERENCES ranks (key) ON DELETE CASCADE,

    effect        permission_effect NOT NULL DEFAULT 'allow',

    created_at_ms BIGINT            NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms BIGINT            NULL,

    CONSTRAINT uq_permission_rules_permission_min_rank
      UNIQUE (permission_id, rank_key)
  );
  CREATE INDEX idx_perm_rules_permission_id
    ON permission_policies (permission_id);
  CREATE INDEX idx_perm_rules_min_rank_key
    ON permission_policies (rank_key);

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

    -- Minimum rank to bypass the lockdown (tier-based in required rank's group
    required_rank_key  VARCHAR(30)           NOT NULL REFERENCES ranks (key) ON
      DELETE RESTRICT,

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

-- Player ranks: can have many ranks, but only one rank per group (tier-based)

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

  -- ---------------------------------------------------------
--  Player Flag Definitions
-- Represents a state or trait/attribute of a player in the shape of a toggle.
-- Computed as a bitmask in players.flags INT (e.g., 0=NONE, 1=STAFF, 3=STAFF + VANISHED, etc.)
-- ---------------------------------------------------------
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
    cover_rank_key      VARCHAR(30) NULL REFERENCES ranks (key) ON DELETE SET NULL,

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
    id                 UUID PRIMARY KEY                 DEFAULT gen_random_uuid(),
    code               VARCHAR(12)             NOT NULL,

    subject_actor_id   UUID                    NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    issuer_actor_id    UUID                    NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    server_origin_id   UUID                    NULL REFERENCES servers (id) ON DELETE SET NULL,

    type               punishment              NOT NULL,
    reason             VARCHAR(100)            NULL,
    note               TEXT                    NULL,

    is_silent          BOOLEAN                 NOT NULL DEFAULT FALSE,
    is_active          BOOLEAN                 NOT NULL DEFAULT TRUE,

    ends_at_ms         BIGINT                  NULL,

    lifted_cause       punishment_lifted_cause NULL,
    lifted_at_ms       BIGINT                  NULL,
    lifted_by_actor_id UUID                    NULL REFERENCES actors (id) ON DELETE RESTRICT,
    lift_note          TEXT                    NULL,

    created_at_ms      BIGINT                  NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms      BIGINT                  NULL,

    CONSTRAINT chk_punishments_lift_consistent
      CHECK (
        (
          is_active = TRUE
            AND type IN ('ban', 'mute')
            AND lifted_cause IS NULL
            AND lifted_at_ms IS NULL
            AND lifted_by_actor_id IS NULL
            AND lift_note IS NULL
          )
          OR
        (
          is_active = FALSE
            AND (
              type NOT IN ('ban', 'mute')
                OR
              (
                lifted_cause IS NOT NULL
                  AND lifted_at_ms IS NOT NULL
                )
              )
          )
        ),

    CONSTRAINT chk_punishments_lift_actor_consistent
      CHECK (
        lifted_cause IS NULL
          OR lifted_cause = 'expired'
          OR lifted_by_actor_id IS NOT NULL
        )
  );

  CREATE INDEX idx_punishments_subject_created
    ON punishments (subject_actor_id, created_at_ms DESC);
  CREATE UNIQUE INDEX uq_punishments_code
    ON punishments (code);
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
  CREATE UNIQUE INDEX uq_punishments_one_active_ban_or_mute
    ON punishments (subject_actor_id, type)
    WHERE is_active = TRUE AND type IN ('ban', 'mute');

  CREATE TABLE chat_messages
  (
    id                  UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    actor_id            UUID        NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    producer_message_id TEXT        NOT NULL,
    ingest_stream_id    TEXT        NULL,
    message             TEXT        NOT NULL,
    channel_key         VARCHAR(30) NOT NULL REFERENCES chat_channels (key) ON DELETE RESTRICT,
    origin_server_id    UUID        NOT NULL REFERENCES servers (id) ON DELETE RESTRICT,
    verdict             message_verdict NOT NULL DEFAULT 'allow',
    moderation_reason   TEXT        NULL,
    moderation_metadata JSONB       NOT NULL DEFAULT '{}'::jsonb,
    is_flagged          BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at_ms       BIGINT      NOT NULL DEFAULT get_unix_ms()
  );
  CREATE UNIQUE INDEX uq_chat_messages_origin_producer
    ON chat_messages (origin_server_id, producer_message_id);
  CREATE INDEX idx_chat_messages_channel_created
    ON chat_messages (channel_key, created_at_ms DESC);
  CREATE INDEX idx_chat_messages_actor_created
    ON chat_messages (actor_id, created_at_ms DESC);
  CREATE INDEX idx_chat_messages_origin_server_created
    ON chat_messages (origin_server_id, created_at_ms DESC);
  CREATE INDEX idx_chat_messages_verdict_created
    ON chat_messages (verdict, created_at_ms DESC);
  CREATE INDEX idx_chat_messages_created
    ON chat_messages (created_at_ms DESC);

  CREATE TABLE reports
  (
    id                   UUID PRIMARY KEY           DEFAULT gen_random_uuid(),
    code                 VARCHAR(12)       NOT NULL,

    reporter_actor_id    UUID              NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    subject_actor_id     UUID              NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,

    selected_reason      VARCHAR(100)      NOT NULL,
    reason_description   TEXT              NULL,

    status               report_status     NOT NULL DEFAULT 'open',
    severity             severity          NULL,
    resolution           report_resolution NULL,

    origin_server_id     UUID              NULL REFERENCES servers (id) ON DELETE SET NULL,

    assigned_to_actor_id UUID              NULL REFERENCES actors (id) ON DELETE SET NULL,

    triaged_by_actor_id  UUID              NULL REFERENCES actors (id) ON DELETE SET NULL,
    triaged_at_ms        BIGINT            NULL,

    closed_by_actor_id   UUID              NULL REFERENCES actors (id) ON DELETE RESTRICT,
    closed_at_ms         BIGINT            NULL,

    resolution_note      TEXT              NULL,

    created_at_ms        BIGINT            NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms        BIGINT            NULL,

    CONSTRAINT chk_reports_triage_consistent
      CHECK (
        (triaged_at_ms IS NULL AND triaged_by_actor_id IS NULL)
          OR
        (triaged_at_ms IS NOT NULL AND triaged_by_actor_id IS NOT NULL)
        ),

    CONSTRAINT chk_reports_closed_consistent
      CHECK (
        (closed_at_ms IS NULL AND closed_by_actor_id IS NULL)
          OR
        (closed_at_ms IS NOT NULL AND closed_by_actor_id IS NOT NULL)
        ),

    CONSTRAINT chk_reports_resolution_consistent
      CHECK (
        (closed_at_ms IS NULL AND resolution IS NULL)
          OR
        (closed_at_ms IS NOT NULL)
        )
  );

  CREATE INDEX idx_reports_status_severity_created
    ON reports (status, severity, created_at_ms DESC);

  CREATE UNIQUE INDEX uq_reports_code
    ON reports (code);

  CREATE INDEX idx_reports_reporter_created
    ON reports (reporter_actor_id, created_at_ms DESC);

  CREATE INDEX idx_reports_subject_created
    ON reports (subject_actor_id, created_at_ms DESC);

  CREATE INDEX idx_reports_selected_reason_created
    ON reports (selected_reason, created_at_ms DESC);

  CREATE INDEX idx_reports_origin_server_created
    ON reports (origin_server_id, created_at_ms DESC)
    WHERE origin_server_id IS NOT NULL;

  CREATE INDEX idx_reports_assigned_status_created
    ON reports (assigned_to_actor_id, status, created_at_ms DESC)
    WHERE assigned_to_actor_id IS NOT NULL;

  CREATE INDEX idx_reports_closed_by_actor
    ON reports (closed_by_actor_id, closed_at_ms DESC)
    WHERE closed_by_actor_id IS NOT NULL;

  CREATE INDEX idx_reports_reason_description_fts
    ON reports
      USING GIN (to_tsvector('english', coalesce(reason_description, '')));

  CREATE TABLE report_comments
  (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id         UUID    NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
    author_actor_id   UUID    NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    author_argus_user_id UUID  NULL REFERENCES argus_users (id) ON DELETE SET NULL,
    parent_comment_id UUID    NULL REFERENCES report_comments (id) ON DELETE SET NULL,

    comment_text      TEXT    NOT NULL,
    is_sticky         BOOLEAN NOT NULL DEFAULT FALSE,

    created_at_ms     BIGINT  NOT NULL DEFAULT get_unix_ms(),
    edited_at_ms      BIGINT  NULL,
    deleted_at_ms     BIGINT  NULL,
    deleted_by_actor_id UUID   NULL REFERENCES actors (id) ON DELETE SET NULL,
    deleted_by_argus_user_id UUID NULL REFERENCES argus_users (id) ON DELETE SET NULL,

    CONSTRAINT chk_report_comments_not_own_parent
      CHECK (parent_comment_id IS NULL OR parent_comment_id <> id),

    CONSTRAINT chk_report_comments_deletion_consistent
      CHECK (
        (deleted_at_ms IS NULL AND deleted_by_actor_id IS NULL)
          OR
        (deleted_at_ms IS NOT NULL)
      )
  );

  CREATE INDEX idx_report_comments_report_created
    ON report_comments (report_id, created_at_ms);
  CREATE INDEX idx_report_comments_parent_created
    ON report_comments (parent_comment_id, created_at_ms)
    WHERE parent_comment_id IS NOT NULL;
  CREATE INDEX idx_report_comments_author_created
    ON report_comments (author_actor_id, created_at_ms DESC);
  CREATE INDEX idx_report_comments_author_argus_user_created
    ON report_comments (author_argus_user_id, created_at_ms DESC)
    WHERE author_argus_user_id IS NOT NULL;
  CREATE INDEX idx_report_comments_deleted_by_actor
    ON report_comments (deleted_by_actor_id, deleted_at_ms DESC)
    WHERE deleted_by_actor_id IS NOT NULL;
  CREATE INDEX idx_report_comments_deleted_by_argus_user
    ON report_comments (deleted_by_argus_user_id, deleted_at_ms DESC)
    WHERE deleted_by_argus_user_id IS NOT NULL;
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

  -- ============================================================
-- Mod cases / investigations
-- ============================================================

  CREATE TABLE mod_cases
  (
    id                   UUID PRIMARY KEY             DEFAULT gen_random_uuid(),

    title                TEXT                NOT NULL DEFAULT 'Unspecified title',
    description          TEXT                NULL,

    opened_by_actor_id   UUID                NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    opened_by_argus_user_id UUID             NULL REFERENCES argus_users (id) ON DELETE SET NULL,
    assigned_to_actor_id UUID                NULL REFERENCES actors (id) ON DELETE SET NULL,
    assigned_to_argus_user_id UUID           NULL REFERENCES argus_users (id) ON DELETE SET NULL,
    closed_by_actor_id   UUID                NULL REFERENCES actors (id) ON DELETE RESTRICT,
    closed_by_argus_user_id UUID             NULL REFERENCES argus_users (id) ON DELETE SET NULL,

    origin_server_id     UUID                NULL REFERENCES servers (id) ON DELETE SET NULL,

    status               mod_case_status     NOT NULL DEFAULT 'open',
    severity             severity            NULL,
    resolution           mod_case_resolution NULL,

    is_sticky            BOOLEAN             NOT NULL DEFAULT FALSE,

    opened_at_ms         BIGINT              NOT NULL DEFAULT get_unix_ms(),
    closed_at_ms         BIGINT              NULL,
    updated_at_ms        BIGINT              NULL,

    CONSTRAINT chk_mod_cases_closed_consistent
      CHECK (
        (closed_at_ms IS NULL AND closed_by_actor_id IS NULL)
          OR
        (closed_at_ms IS NOT NULL AND closed_by_actor_id IS NOT NULL)
        ),

    CONSTRAINT chk_mod_cases_resolution_consistent
      CHECK (
        (closed_at_ms IS NULL AND resolution IS NULL)
          OR
        (closed_at_ms IS NOT NULL)
        )
  );

  CREATE INDEX idx_mod_cases_status_severity_opened
    ON mod_cases (status, severity, opened_at_ms DESC);

  CREATE INDEX idx_mod_cases_opened_by_actor
    ON mod_cases (opened_by_actor_id, opened_at_ms DESC);
  CREATE INDEX idx_mod_cases_opened_by_argus_user
    ON mod_cases (opened_by_argus_user_id, opened_at_ms DESC)
    WHERE opened_by_argus_user_id IS NOT NULL;

  CREATE INDEX idx_mod_cases_assigned_status_opened
    ON mod_cases (assigned_to_actor_id, status, opened_at_ms DESC)
    WHERE assigned_to_actor_id IS NOT NULL;
  CREATE INDEX idx_mod_cases_assigned_argus_user_status_opened
    ON mod_cases (assigned_to_argus_user_id, status, opened_at_ms DESC)
    WHERE assigned_to_argus_user_id IS NOT NULL;

  CREATE INDEX idx_mod_cases_origin_server_opened
    ON mod_cases (origin_server_id, opened_at_ms DESC)
    WHERE origin_server_id IS NOT NULL;

  CREATE INDEX idx_mod_cases_closed_by_actor
    ON mod_cases (closed_by_actor_id, closed_at_ms DESC)
    WHERE closed_by_actor_id IS NOT NULL;
  CREATE INDEX idx_mod_cases_closed_by_argus_user
    ON mod_cases (closed_by_argus_user_id, closed_at_ms DESC)
    WHERE closed_by_argus_user_id IS NOT NULL;

  CREATE INDEX idx_mod_cases_sticky_open
    ON mod_cases (opened_at_ms DESC)
    WHERE is_sticky = TRUE AND closed_at_ms IS NULL;

  CREATE INDEX idx_mod_cases_title_description_fts
    ON mod_cases
      USING GIN (
                 to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
        );

  -- ============================================================
-- Actors attached to mod cases / investigation boards
-- ============================================================

  CREATE TABLE mod_case_actors
  (
    id                UUID PRIMARY KEY                    DEFAULT gen_random_uuid(),

    case_id           UUID                       NOT NULL REFERENCES mod_cases (id) ON DELETE CASCADE,
    actor_id          UUID                       NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,

    role              moderation_case_actor_role NOT NULL,

    added_by_actor_id UUID                       NULL REFERENCES actors (id) ON DELETE SET NULL,
    added_at_ms       BIGINT                     NOT NULL DEFAULT get_unix_ms(),

    note              TEXT                       NULL,

    UNIQUE (case_id, actor_id, role)
  );

  CREATE INDEX idx_mod_case_actors_case
    ON mod_case_actors (case_id, role);

  CREATE INDEX idx_mod_case_actors_actor
    ON mod_case_actors (actor_id, role);

  -- ============================================================
-- Actor watchlist / Player of Interest registry
-- ============================================================

  CREATE TABLE actor_watchlist_entries
  (
    id                  INT PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,

    subject_actor_id    UUID     NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    added_by_actor_id   UUID     NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,

    reason              TEXT     NULL,
    severity            severity NULL,

    alert_on_join       BOOLEAN  NOT NULL DEFAULT TRUE,
    alert_on_chat       BOOLEAN  NOT NULL DEFAULT FALSE,
    alert_note          TEXT     NULL,

    expires_at_ms       BIGINT   NULL,

    cleared_by_actor_id UUID     NULL REFERENCES actors (id) ON DELETE RESTRICT,
    cleared_at_ms       BIGINT   NULL,

    added_at_ms         BIGINT   NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms       BIGINT   NULL,

    CONSTRAINT chk_actor_watchlist_entries_clear_consistent
      CHECK (
        (cleared_at_ms IS NULL AND cleared_by_actor_id IS NULL)
          OR
        (cleared_at_ms IS NOT NULL AND cleared_by_actor_id IS NOT NULL)
        ),

    CONSTRAINT chk_actor_watchlist_entries_expiry_after_add
      CHECK (
        expires_at_ms IS NULL OR expires_at_ms > added_at_ms
        )
  );

  CREATE UNIQUE INDEX uq_actor_watchlist_entries_one_active_per_subject
    ON actor_watchlist_entries (subject_actor_id)
    WHERE cleared_at_ms IS NULL;

  CREATE INDEX idx_actor_watchlist_entries_subject_added
    ON actor_watchlist_entries (subject_actor_id, added_at_ms DESC);

  CREATE INDEX idx_actor_watchlist_entries_added_by_actor
    ON actor_watchlist_entries (added_by_actor_id, added_at_ms DESC);

  CREATE INDEX idx_actor_watchlist_entries_active_severity
    ON actor_watchlist_entries (severity, added_at_ms DESC)
    WHERE cleared_at_ms IS NULL;

  CREATE INDEX idx_actor_watchlist_entries_expires
    ON actor_watchlist_entries (expires_at_ms)
    WHERE expires_at_ms IS NOT NULL AND cleared_at_ms IS NULL;

  CREATE INDEX idx_actor_watchlist_entries_cleared_by_actor
    ON actor_watchlist_entries (cleared_by_actor_id, cleared_at_ms DESC)
    WHERE cleared_by_actor_id IS NOT NULL;

  CREATE TABLE bug_reports
  (
    id                   UUID PRIMARY KEY           DEFAULT gen_random_uuid(),

    platform             VARCHAR(30)       NOT NULL DEFAULT 'minecraft',
    title                VARCHAR(100)      NOT NULL,
    description          TEXT              NOT NULL,

    status               bug_report_status NOT NULL DEFAULT 'open',
    severity             severity          NULL,

    created_by_actor_id  UUID              NULL REFERENCES actors (id) ON DELETE RESTRICT,
    assigned_to_actor_id UUID              NULL REFERENCES actors (id) ON DELETE SET NULL,

    closed_by_actor_id   UUID              NULL REFERENCES actors (id) ON DELETE RESTRICT,
    closed_at_ms         BIGINT            NULL,

    created_at_ms        BIGINT            NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms        BIGINT            NULL,

    CONSTRAINT chk_bug_reports_closed_consistent
      CHECK (
        (closed_at_ms IS NULL AND closed_by_actor_id IS NULL)
          OR
        (closed_at_ms IS NOT NULL AND closed_by_actor_id IS NOT NULL)
        )
  );

  CREATE INDEX idx_bug_reports_status_severity_created
    ON bug_reports (status, severity, created_at_ms DESC);

  CREATE INDEX idx_bug_reports_created_by_actor
    ON bug_reports (created_by_actor_id, created_at_ms DESC)
    WHERE created_by_actor_id IS NOT NULL;

  CREATE INDEX idx_bug_reports_assigned_status_created
    ON bug_reports (assigned_to_actor_id, status, created_at_ms DESC)
    WHERE assigned_to_actor_id IS NOT NULL;

  CREATE INDEX idx_bug_reports_closed_by_actor
    ON bug_reports (closed_by_actor_id, closed_at_ms DESC)
    WHERE closed_by_actor_id IS NOT NULL;

  CREATE INDEX idx_bug_reports_title_description_fts
    ON bug_reports
      USING GIN (
                 to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
        );

  -- ============================================================
-- Generic moderation resource links
-- This is the bridge layer that lets reports, cases, appeals,
-- punishments, bugs, actors, and evidence-like resources connect.
-- ============================================================

  CREATE TABLE moderation_resource_links
  (
    id                  UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),

    source_type         moderation_resource_type NOT NULL,
    source_id           UUID                     NOT NULL,

    target_type         moderation_resource_type NOT NULL,
    target_id           UUID                     NOT NULL,

    link_type           moderation_link_type     NOT NULL DEFAULT 'related_to',

    created_by_actor_id UUID                     NULL REFERENCES actors (id) ON DELETE SET NULL,
    created_at_ms       BIGINT                   NOT NULL DEFAULT get_unix_ms(),

    note                TEXT                     NULL,

    CONSTRAINT chk_moderation_resource_links_not_self
      CHECK (
        source_type <> target_type
          OR source_id <> target_id
        )
  );

  CREATE INDEX idx_moderation_resource_links_source
    ON moderation_resource_links (source_type, source_id, link_type);

  CREATE INDEX idx_moderation_resource_links_target
    ON moderation_resource_links (target_type, target_id, link_type);

  CREATE INDEX idx_moderation_resource_links_created
    ON moderation_resource_links (created_at_ms DESC);

  CREATE UNIQUE INDEX uq_moderation_resource_links_exact
    ON moderation_resource_links (
                                  source_type,
                                  source_id,
                                  target_type,
                                  target_id,
                                  link_type
      );

  -- ============================================================
-- Moderation evidence
-- Evidence is stronger than a generic link: it means this item
-- is being used to support review, investigation, or action.
-- ============================================================

  CREATE TABLE moderation_evidence
  (
    id                    UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),

    object_type           moderation_resource_type NOT NULL,
    object_id             UUID                     NOT NULL,

    evidence_type         moderation_evidence_type NOT NULL,

    chat_message_id       UUID                     NULL REFERENCES chat_messages (id) ON DELETE SET NULL,
    bug_report_id         UUID                     NULL REFERENCES bug_reports (id) ON DELETE SET NULL,

    title                 TEXT                     NULL,
    description           TEXT                     NULL,
    url                   TEXT                     NULL,

    metadata              JSONB                    NOT NULL DEFAULT '{}'::jsonb,

    submitted_by_actor_id UUID                     NULL REFERENCES actors (id) ON DELETE SET NULL,
    created_at_ms         BIGINT                   NOT NULL DEFAULT get_unix_ms(),

    is_removed            BOOLEAN                  NOT NULL DEFAULT FALSE,
    removed_by_actor_id   UUID                     NULL REFERENCES actors (id) ON DELETE SET NULL,
    removed_at_ms         BIGINT                   NULL,

    CONSTRAINT chk_moderation_evidence_removed_consistent
      CHECK (
        (is_removed = FALSE AND removed_by_actor_id IS NULL AND removed_at_ms IS NULL)
          OR
        (is_removed = TRUE AND removed_by_actor_id IS NOT NULL AND removed_at_ms IS NOT NULL)
        ),

    CONSTRAINT chk_moderation_evidence_has_payload
      CHECK (
        chat_message_id IS NOT NULL
          OR bug_report_id IS NOT NULL
          OR url IS NOT NULL
          OR description IS NOT NULL
          OR metadata <> '{}'::jsonb
        )
  );

  CREATE INDEX idx_moderation_evidence_object
    ON moderation_evidence (object_type, object_id, created_at_ms DESC);

  CREATE INDEX idx_moderation_evidence_type
    ON moderation_evidence (evidence_type, created_at_ms DESC);

  CREATE INDEX idx_moderation_evidence_chat_message
    ON moderation_evidence (chat_message_id)
    WHERE chat_message_id IS NOT NULL;

  CREATE INDEX idx_moderation_evidence_bug_report
    ON moderation_evidence (bug_report_id)
    WHERE bug_report_id IS NOT NULL;

  CREATE INDEX idx_moderation_evidence_submitted_by
    ON moderation_evidence (submitted_by_actor_id, created_at_ms DESC)
    WHERE submitted_by_actor_id IS NOT NULL;

  -- ============================================================
-- Moderation events / limited operational timeline
-- This is the staff-facing moderation trail, not the full admin audit log.
-- ============================================================

  CREATE TABLE moderation_events
  (
    id             UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),

    object_type    moderation_resource_type NOT NULL,
    object_id      UUID                     NOT NULL,

    event_type     moderation_event_type    NOT NULL,

    actor_id       UUID                     NULL REFERENCES actors (id) ON DELETE SET NULL,

    previous_value JSONB                    NULL,
    new_value      JSONB                    NULL,
    metadata       JSONB                    NOT NULL DEFAULT '{}'::jsonb,

    created_at_ms  BIGINT                   NOT NULL DEFAULT get_unix_ms()
  );

  CREATE INDEX idx_moderation_events_object_created
    ON moderation_events (object_type, object_id, created_at_ms DESC);

  CREATE INDEX idx_moderation_events_actor_created
    ON moderation_events (actor_id, created_at_ms DESC)
    WHERE actor_id IS NOT NULL;

  CREATE INDEX idx_moderation_events_type_created
    ON moderation_events (event_type, created_at_ms DESC);

  CREATE INDEX idx_moderation_events_created
    ON moderation_events (created_at_ms DESC);

-- Entitlements

  CREATE TABLE entitlement_items
  (
    id            UUID PRIMARY KEY      DEFAULT gen_random_uuid(),
    sku           VARCHAR(64)  NOT NULL UNIQUE,
    -- Example: gadget, cosmetic, pet
    item_type     VARCHAR(50)  NOT NULL,
    label         VARCHAR(100) NOT NULL,
    description   TEXT,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    metadata      JSONB        NOT NULL DEFAULT '{}',
    created_at_ms BIGINT       NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms BIGINT       NOT NULL DEFAULT get_unix_ms()
  );

  CREATE TABLE player_entitlements
  (
    id                  UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    actor_id            UUID        NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    entitlement_item_id UUID        NOT NULL REFERENCES entitlement_items (id) ON DELETE RESTRICT,
    source              VARCHAR(50) NOT NULL,
    source_ref_id       UUID        NULL,
    quantity            BIGINT      NOT NULL DEFAULT 1,
    status              VARCHAR(30) NOT NULL DEFAULT 'active',
    granted_at_ms       BIGINT      NOT NULL DEFAULT get_unix_ms(),
    revoked_at_ms       BIGINT      NULL,
    expires_at_ms       BIGINT      NULL,
    metadata            JSONB       NOT NULL DEFAULT '{}',
    CHECK (quantity >= 0),
    CHECK (status IN ('active', 'revoked', 'expired', 'consumed'))
  );

  CREATE TABLE shop_offerings
  (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entitlement_item_id UUID    NOT NULL REFERENCES entitlement_items (id) ON DELETE RESTRICT,
    label               VARCHAR(100),
    price               BIGINT  NOT NULL,
    quantity            INT     NOT NULL DEFAULT 1,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at_ms        BIGINT  NULL,
    ends_at_ms          BIGINT  NULL,
    metadata            JSONB   NOT NULL DEFAULT '{}',
    created_at_ms       BIGINT  NOT NULL DEFAULT get_unix_ms(),
    updated_at_ms       BIGINT  NOT NULL DEFAULT get_unix_ms(),
    CHECK (price >= 0),
    CHECK (quantity > 0)
  );

  CREATE TABLE purchase_orders
  (
    id              UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    actor_id        UUID        NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    total_amount    BIGINT      NOT NULL,
    currency_type   VARCHAR(50) NOT NULL DEFAULT 'soft_currency',
    status          VARCHAR(20) NOT NULL,
    created_at_ms   BIGINT      NOT NULL DEFAULT get_unix_ms(),
    completed_at_ms BIGINT      NULL,
    cancelled_at_ms BIGINT      NULL,
    CHECK (total_amount >= 0),
    CHECK (status IN ('pending', 'completed', 'cancelled', 'failed'))
  );

  CREATE TABLE purchase_order_items
  (
    id                     UUID PRIMARY KEY      DEFAULT gen_random_uuid(),
    purchase_order_id      UUID         NOT NULL REFERENCES purchase_orders (id) ON DELETE RESTRICT,
    shop_listing_id        UUID         NULL REFERENCES shop_offerings (id) ON DELETE RESTRICT,
    entitlement_item_id    UUID         NOT NULL REFERENCES entitlement_items (id) ON DELETE RESTRICT,
    sku                    VARCHAR(64)  NOT NULL,
    label                  VARCHAR(100) NOT NULL,
    quantity               INT          NOT NULL DEFAULT 1,
    unit_price             BIGINT       NOT NULL,
    line_total             BIGINT       NOT NULL,
    granted_entitlement_id UUID         NULL REFERENCES player_entitlements (id) ON DELETE SET NULL,
    CHECK (quantity > 0),
    CHECK (unit_price >= 0),
    CHECK (line_total >= 0),
    CHECK (line_total = quantity * unit_price)
  );

  CREATE TABLE virtual_transactions
  (
    id               UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    actor_id         UUID        NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    amount           BIGINT      NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    source           VARCHAR(50) NOT NULL,
    source_ref_id    UUID        NULL,
    balance_after    BIGINT      NOT NULL,
    created_at_ms    BIGINT      NOT NULL DEFAULT get_unix_ms()
  );

  CREATE TABLE redemption_campaigns
  (
    id                        UUID PRIMARY KEY      DEFAULT gen_random_uuid(),
    code                      VARCHAR(32)  NOT NULL UNIQUE,
    label                     VARCHAR(100) NOT NULL,
    max_redemptions           BIGINT       NULL,
    max_redemptions_per_actor INT          NOT NULL DEFAULT 1,
    starts_at_ms              BIGINT       NULL,
    expires_at_ms             BIGINT       NULL,
    is_active                 BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at_ms             BIGINT       NOT NULL DEFAULT get_unix_ms()
  );

  CREATE TABLE redemption_campaign_rewards
  (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id  UUID        NOT NULL REFERENCES redemption_campaigns (id) ON DELETE RESTRICT,
    reward_type  VARCHAR(20) NOT NULL,
    amount       BIGINT      NULL,
    shop_item_id UUID        NULL,
    quantity     INT         NULL DEFAULT 1
  );

  CREATE TABLE redemptions
  (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id    UUID   NOT NULL REFERENCES redemption_campaigns (id) ON DELETE RESTRICT,
    actor_id       UUID   NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
    redeemed_at_ms BIGINT NOT NULL  DEFAULT get_unix_ms(),
    UNIQUE (campaign_id, actor_id)
  );

  CREATE TABLE friend_requests
  (
    id              UUID PRIMARY KEY               DEFAULT gen_random_uuid(),
    requester_id    UUID                  NOT NULL REFERENCES players (id) ON DELETE RESTRICT,
    recipient_id    UUID                  NOT NULL REFERENCES players (id) ON DELETE RESTRICT,
    status          friend_request_status NOT NULL,
    created_at_ms   BIGINT                NOT NULL DEFAULT get_unix_ms(),
    responded_at_ms BIGINT                NULL,
    CHECK (requester_id <> recipient_id),
    UNIQUE (requester_id, recipient_id)
  );

  CREATE TABLE friendships
  (
    player_low_id  UUID   NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    player_high_id UUID   NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    created_at_ms  BIGINT NOT NULL DEFAULT get_unix_ms(),
    PRIMARY KEY (player_low_id, player_high_id),
    CHECK (player_low_id < player_high_id)
  );

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
