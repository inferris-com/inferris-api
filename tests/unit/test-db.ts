import { Kysely, PostgresDialect } from "kysely";

import type { DB } from "../../src/db/types.js";

type QueuedResult = {
  rows?: unknown[];
  rowCount?: number;
};

type RecordedQuery = {
  sql: string;
  parameters: readonly unknown[];
};

export function createRecordingDb(results: QueuedResult[] = []) {
  const queries: RecordedQuery[] = [];
  const queue = [...results];
  const client = {
    query: (sql: string, parameters: readonly unknown[] = []) => {
      queries.push({ sql, parameters });

      if (sql === "begin" || sql === "commit" || sql === "rollback") {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }

      const result = queue.shift() ?? {};
      return Promise.resolve({
        command: commandFor(sql),
        rows: result.rows ?? [],
        rowCount: result.rowCount ?? result.rows?.length ?? 0,
      });
    },
    release: () => undefined,
  };
  const pool = {
    connect: () => Promise.resolve(client),
    end: () => Promise.resolve(undefined),
  };

  return {
    db: new Kysely<DB>({
      dialect: new PostgresDialect({ pool: pool as never }),
    }),
    queries,
  };
}

function commandFor(sql: string): string {
  const command = sql.trimStart().split(/\s+/, 1)[0]?.toUpperCase();

  return command ?? "";
}
