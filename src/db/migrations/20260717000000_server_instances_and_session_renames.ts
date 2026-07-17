import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TYPE server_instance_state AS ENUM ('active', 'draining', 'stopped', 'lost', 'superseded');
    CREATE TYPE server_event_type AS ENUM (
      'SERVER_SHUTTING_DOWN',
      'SERVER_STOPPED',
      'NETWORK_SESSION_STARTED',
      'BACKEND_CONNECTED',
      'NETWORK_SESSION_ENDED'
    );
    ALTER TYPE principal_type ADD VALUE IF NOT EXISTS 'server_instance';
  `.execute(db);

  await sql`
    CREATE TABLE server_instances
    (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      server_id             UUID NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
      state                 server_instance_state NOT NULL DEFAULT 'active',
      runtime_port          INT NULL CHECK (runtime_port BETWEEN 1 AND 65535),
      version               TEXT NULL,
      started_at_ms         BIGINT NOT NULL DEFAULT get_unix_ms(),
      draining_at_ms        BIGINT NULL,
      stopped_at_ms         BIGINT NULL,
      lost_at_ms            BIGINT NULL,
      superseded_at_ms      BIGINT NULL,
      last_heartbeat_at_ms  BIGINT NULL,
      heartbeat_interval_ms BIGINT NULL CHECK (heartbeat_interval_ms IS NULL OR heartbeat_interval_ms > 0),
      last_event_sequence   BIGINT NOT NULL DEFAULT 0,
      is_synthetic_backfill BOOLEAN NOT NULL DEFAULT FALSE,
      created_at_ms         BIGINT NOT NULL DEFAULT get_unix_ms(),
      updated_at_ms         BIGINT NULL
    );
    CREATE UNIQUE INDEX uq_server_instances_one_active_per_server
      ON server_instances (server_id)
      WHERE state IN ('active', 'draining');
    CREATE INDEX idx_server_instances_server_started
      ON server_instances (server_id, started_at_ms DESC);
    CREATE INDEX idx_server_instances_state ON server_instances (state);

    CREATE TABLE server_instance_tokens
    (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      server_instance_id UUID NOT NULL REFERENCES server_instances (id) ON DELETE CASCADE,
      token_hash         TEXT NOT NULL UNIQUE,
      issued_at_ms       BIGINT NOT NULL DEFAULT get_unix_ms(),
      revoked_at_ms      BIGINT NULL,
      revoked_reason     TEXT NULL
    );
    CREATE INDEX idx_server_instance_tokens_instance
      ON server_instance_tokens (server_instance_id);

    CREATE TABLE server_events
    (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      server_instance_id UUID NOT NULL REFERENCES server_instances (id) ON DELETE CASCADE,
      event_id           TEXT NOT NULL,
      sequence           BIGINT NOT NULL CHECK (sequence > 0),
      type               server_event_type NOT NULL,
      payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
      processing_result  JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at_ms      BIGINT NOT NULL DEFAULT get_unix_ms(),
      processed_at_ms    BIGINT NOT NULL DEFAULT get_unix_ms(),
      CONSTRAINT uq_server_events_instance_event UNIQUE (server_instance_id, event_id),
      CONSTRAINT uq_server_events_instance_sequence UNIQUE (server_instance_id, sequence)
    );
    CREATE INDEX idx_server_events_instance_created
      ON server_events (server_instance_id, created_at_ms DESC);
  `.execute(db);

  await sql`
    INSERT INTO server_instances (
      server_id,
      state,
      started_at_ms,
      stopped_at_ms,
      last_heartbeat_at_ms,
      version,
      is_synthetic_backfill,
      created_at_ms,
      updated_at_ms
    )
    SELECT
      id,
      'stopped',
      COALESCE(last_started_at_ms, created_at_ms),
      last_heartbeat_at_ms,
      last_heartbeat_at_ms,
      version,
      TRUE,
      created_at_ms,
      last_updated_at_ms
    FROM servers;
  `.execute(db);

  await sql`
    ALTER TABLE player_network_sessions RENAME TO network_sessions;
    ALTER TABLE player_network_sessions_current RENAME TO network_sessions_current;
    ALTER TABLE player_server_visits RENAME TO backend_sessions;
    ALTER TABLE player_server_visits_current RENAME TO backend_sessions_current;
  `.execute(db);

  await sql`
    ALTER TABLE network_sessions
      ADD COLUMN proxy_server_instance_id UUID NULL REFERENCES server_instances (id) ON DELETE SET NULL;
    ALTER TABLE backend_sessions RENAME COLUMN server_id TO backend_server_id;
    ALTER TABLE backend_sessions
      ADD COLUMN backend_server_instance_id UUID NULL REFERENCES server_instances (id) ON DELETE SET NULL;
    ALTER TABLE backend_sessions_current RENAME COLUMN server_id TO backend_server_id;
    ALTER TABLE backend_sessions_current RENAME COLUMN server_visit_id TO backend_session_id;
    ALTER TABLE server_heartbeat_observations
      ADD COLUMN server_instance_id UUID NULL REFERENCES server_instances (id) ON DELETE SET NULL;
    ALTER TABLE server_latest_metrics
      ADD COLUMN server_instance_id UUID NULL REFERENCES server_instances (id) ON DELETE SET NULL;
  `.execute(db);

  await sql`
    UPDATE network_sessions ns
    SET proxy_server_instance_id = si.id
    FROM server_instances si
    WHERE si.server_id = ns.proxy_server_id
      AND si.is_synthetic_backfill = TRUE;
  `.execute(db);

  await sql`
    ALTER TABLE servers
      DROP COLUMN status,
      DROP COLUMN version,
      DROP COLUMN last_started_at_ms,
      DROP COLUMN last_heartbeat_at_ms;
  `.execute(db);

  await sql`
    ALTER INDEX IF EXISTS uq_player_network_sessions_one_open_per_player
      RENAME TO uq_network_sessions_one_open_per_player;
    ALTER INDEX IF EXISTS idx_player_network_sessions_player_connected_at
      RENAME TO idx_network_sessions_player_connected_at;
    ALTER INDEX IF EXISTS idx_player_network_sessions_proxy_connected_at
      RENAME TO idx_network_sessions_proxy_connected_at;
    ALTER INDEX IF EXISTS idx_player_network_sessions_connected_at
      RENAME TO idx_network_sessions_connected_at;
    ALTER INDEX IF EXISTS idx_player_network_sessions_current_proxy
      RENAME TO idx_network_sessions_current_proxy;
    ALTER INDEX IF EXISTS idx_player_network_sessions_current_connected_at
      RENAME TO idx_network_sessions_current_connected_at;
    ALTER INDEX IF EXISTS uq_player_server_visits_one_open_per_network_session
      RENAME TO uq_backend_sessions_one_open_per_network_session;
    ALTER INDEX IF EXISTS idx_player_server_visits_network_joined_at
      RENAME TO idx_backend_sessions_network_joined_at;
    ALTER INDEX IF EXISTS idx_player_server_visits_player_joined_at
      RENAME TO idx_backend_sessions_player_joined_at;
    ALTER INDEX IF EXISTS idx_player_server_visits_server_joined_at
      RENAME TO idx_backend_sessions_backend_server_joined_at;
    ALTER INDEX IF EXISTS idx_player_server_visits_current_server
      RENAME TO idx_backend_sessions_current_backend_server;
    ALTER INDEX IF EXISTS idx_player_server_visits_current_joined_at
      RENAME TO idx_backend_sessions_current_joined_at;
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION sync_network_sessions_current()
      RETURNS TRIGGER
      LANGUAGE plpgsql
    AS
    $$
    BEGIN
      NEW.updated_at_ms := get_unix_ms();
      IF (TG_OP = 'INSERT') THEN
        IF (NEW.disconnected_at_ms IS NULL) THEN
          IF EXISTS (SELECT 1 FROM network_sessions_current c WHERE c.player_id = NEW.player_id) THEN
            RAISE EXCEPTION
              'Invariant violation: player % already has an active network session in network_sessions_current',
              NEW.player_id
              USING ERRCODE = '23514';
          END IF;
          INSERT INTO network_sessions_current (player_id, proxy_server_id, network_session_id, connected_at_ms, updated_at_ms)
          VALUES (NEW.player_id, NEW.proxy_server_id, NEW.id, NEW.connected_at_ms, get_unix_ms());
        END IF;
        RETURN NEW;
      END IF;
      IF (TG_OP = 'UPDATE') THEN
        IF (OLD.disconnected_at_ms IS NULL AND NEW.disconnected_at_ms IS NOT NULL) THEN
          UPDATE backend_sessions b
          SET left_at_ms = NEW.disconnected_at_ms,
              leave_reason = COALESCE(b.leave_reason, 'network_disconnect'),
              updated_at_ms = get_unix_ms()
          WHERE b.network_session_id = NEW.id
            AND b.left_at_ms IS NULL;
          DELETE FROM network_sessions_current c WHERE c.network_session_id = NEW.id;
        ELSIF (OLD.disconnected_at_ms IS NULL AND NEW.disconnected_at_ms IS NULL) THEN
          UPDATE network_sessions_current c
          SET proxy_server_id = NEW.proxy_server_id,
              connected_at_ms = NEW.connected_at_ms,
              updated_at_ms = get_unix_ms()
          WHERE c.network_session_id = NEW.id;
        END IF;
        RETURN NEW;
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION sync_backend_sessions_current()
      RETURNS TRIGGER
      LANGUAGE plpgsql
    AS
    $$
    BEGIN
      NEW.updated_at_ms := get_unix_ms();
      IF (TG_OP = 'INSERT') THEN
        IF (NEW.left_at_ms IS NULL) THEN
          IF EXISTS (
            SELECT 1 FROM backend_sessions_current c WHERE c.network_session_id = NEW.network_session_id
          ) THEN
            RAISE EXCEPTION
              'Invariant violation: network session % already has an active backend session in backend_sessions_current',
              NEW.network_session_id
              USING ERRCODE = '23514';
          END IF;
          INSERT INTO backend_sessions_current (network_session_id, player_id, backend_server_id, backend_session_id, joined_at_ms, updated_at_ms)
          VALUES (NEW.network_session_id, NEW.player_id, NEW.backend_server_id, NEW.id, NEW.joined_at_ms, get_unix_ms());
        END IF;
        RETURN NEW;
      END IF;
      IF (TG_OP = 'UPDATE') THEN
        IF (OLD.left_at_ms IS NULL AND NEW.left_at_ms IS NOT NULL) THEN
          DELETE FROM backend_sessions_current c WHERE c.backend_session_id = NEW.id;
        ELSIF (OLD.left_at_ms IS NULL AND NEW.left_at_ms IS NULL) THEN
          UPDATE backend_sessions_current c
          SET backend_server_id = NEW.backend_server_id,
              joined_at_ms = NEW.joined_at_ms,
              updated_at_ms = get_unix_ms()
          WHERE c.backend_session_id = NEW.id;
        END IF;
        RETURN NEW;
      END IF;
      RETURN NEW;
    END;
    $$;
  `.execute(db);

  await sql`
    DROP TRIGGER IF EXISTS trg_sync_player_network_sessions_current_ins ON network_sessions;
    DROP TRIGGER IF EXISTS trg_sync_player_network_sessions_current_upd ON network_sessions;
    DROP TRIGGER IF EXISTS trg_sync_player_server_visits_current_ins ON backend_sessions;
    DROP TRIGGER IF EXISTS trg_sync_player_server_visits_current_upd ON backend_sessions;
    DROP FUNCTION IF EXISTS sync_player_network_sessions_current() CASCADE;
    DROP FUNCTION IF EXISTS sync_player_server_visits_current() CASCADE;

    CREATE TRIGGER trg_sync_network_sessions_current_ins
      AFTER INSERT ON network_sessions
      FOR EACH ROW EXECUTE FUNCTION sync_network_sessions_current();
    CREATE TRIGGER trg_sync_network_sessions_current_upd
      BEFORE UPDATE ON network_sessions
      FOR EACH ROW EXECUTE FUNCTION sync_network_sessions_current();
    CREATE TRIGGER trg_sync_backend_sessions_current_ins
      AFTER INSERT ON backend_sessions
      FOR EACH ROW EXECUTE FUNCTION sync_backend_sessions_current();
    CREATE TRIGGER trg_sync_backend_sessions_current_upd
      BEFORE UPDATE ON backend_sessions
      FOR EACH ROW EXECUTE FUNCTION sync_backend_sessions_current();
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TRIGGER IF EXISTS trg_sync_network_sessions_current_ins ON network_sessions;
    DROP TRIGGER IF EXISTS trg_sync_network_sessions_current_upd ON network_sessions;
    DROP TRIGGER IF EXISTS trg_sync_backend_sessions_current_ins ON backend_sessions;
    DROP TRIGGER IF EXISTS trg_sync_backend_sessions_current_upd ON backend_sessions;
    DROP FUNCTION IF EXISTS sync_network_sessions_current() CASCADE;
    DROP FUNCTION IF EXISTS sync_backend_sessions_current() CASCADE;
  `.execute(db);

  await sql`
    ALTER TABLE servers
      ADD COLUMN status server_status NOT NULL DEFAULT 'offline',
      ADD COLUMN version TEXT NOT NULL DEFAULT 'Unspecified version',
      ADD COLUMN last_started_at_ms BIGINT NULL,
      ADD COLUMN last_heartbeat_at_ms BIGINT NULL;
  `.execute(db);

  await sql`
    ALTER TABLE server_latest_metrics DROP COLUMN IF EXISTS server_instance_id;
    ALTER TABLE server_heartbeat_observations DROP COLUMN IF EXISTS server_instance_id;
    ALTER TABLE backend_sessions_current RENAME COLUMN backend_session_id TO server_visit_id;
    ALTER TABLE backend_sessions_current RENAME COLUMN backend_server_id TO server_id;
    ALTER TABLE backend_sessions DROP COLUMN IF EXISTS backend_server_instance_id;
    ALTER TABLE backend_sessions RENAME COLUMN backend_server_id TO server_id;
    ALTER TABLE network_sessions DROP COLUMN IF EXISTS proxy_server_instance_id;
    ALTER TABLE backend_sessions RENAME TO player_server_visits;
    ALTER TABLE backend_sessions_current RENAME TO player_server_visits_current;
    ALTER TABLE network_sessions RENAME TO player_network_sessions;
    ALTER TABLE network_sessions_current RENAME TO player_network_sessions_current;
  `.execute(db);

  await sql`
    DROP TABLE IF EXISTS server_events;
    DROP TABLE IF EXISTS server_instance_tokens;
    DROP TABLE IF EXISTS server_instances;
    DROP TYPE IF EXISTS server_event_type;
    DROP TYPE IF EXISTS server_instance_state;
  `.execute(db);
}
