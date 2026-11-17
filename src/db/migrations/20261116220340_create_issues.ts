import { type Kysely, sql } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE issues (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform platform NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      status bug_report_status NOT NULL DEFAULT 'open',
      severity severity NULL,
      created_by_actor_id UUID NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
      assigned_to_actor_id UUID NULL REFERENCES actors (id) ON DELETE SET NULL,
      closed_by_actor_id UUID NULL REFERENCES actors (id) ON DELETE RESTRICT,
      closed_at_ms BIGINT NULL,
      created_at_ms BIGINT NOT NULL DEFAULT get_unix_ms (),
      updated_at_ms BIGINT NULL,
      CONSTRAINT chk_issues_closed_consistent CHECK (
        (
          status IN ('resolved', 'duplicate', 'invalid', 'closed')
          AND closed_by_actor_id IS NOT NULL
          AND closed_at_ms IS NOT NULL
        )
        OR (
          status NOT IN ('resolved', 'duplicate', 'invalid', 'closed')
          AND closed_by_actor_id IS NULL
          AND closed_at_ms IS NULL
        )
      )
    );

    CREATE INDEX idx_issues_status_severity_created ON issues (status, severity, created_at_ms DESC);

    CREATE INDEX idx_issues_created_by_actor ON issues (created_by_actor_id, created_at_ms DESC)
    WHERE
      created_by_actor_id IS NOT NULL;

    CREATE INDEX idx_issues_assigned_status_created ON issues (assigned_to_actor_id, status, created_at_ms DESC)
    WHERE
      assigned_to_actor_id IS NOT NULL;

    CREATE INDEX idx_issues_closed_by_actor ON issues (closed_by_actor_id, closed_at_ms DESC)
    WHERE
      closed_by_actor_id IS NOT NULL;

    CREATE INDEX idx_issues_title_description_fts ON issues USING GIN (
      to_tsvector(
        'english',
        coalesce(title, '') || ' ' || coalesce(description, '')
      )
    );
  `.execute(db);
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS issues CASCADE`.execute(db);
}
