from __future__ import annotations

from collections.abc import Iterable
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from .generate import Batch


JSON_FIELDS = {
    "players": set(),
    "player_profiles": {"preferences"},
    "player_nicknames": {"meta"},
    "server_instances": set(),
    "chat_messages": {"moderation_metadata"},
    "network_sessions": {"meta"},
    "backend_sessions": {"meta"},
}


def _json_ready(table: str, row: dict[str, Any]) -> dict[str, Any]:
    json_fields = JSON_FIELDS.get(table, set())
    return {key: Jsonb(value) if key in json_fields else value for key, value in row.items()}


def insert_rows(conn: psycopg.Connection, table: str, rows: Iterable[dict[str, Any]]) -> int:
    rows = list(rows)
    if not rows:
        return 0

    columns = list(rows[0].keys())
    placeholders = ", ".join(["%s"] * len(columns))
    column_sql = ", ".join(columns)
    update_sql = ", ".join(f"{column} = EXCLUDED.{column}" for column in columns if column != "id")
    conflict = "DO NOTHING" if not update_sql else f"DO NOTHING"
    sql = f"INSERT INTO {table} ({column_sql}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"

    prepared = [
        tuple(_json_ready(table, row).get(column) for column in columns)
        for row in rows
    ]
    with conn.cursor() as cur:
        cur.executemany(sql, prepared)
    return len(rows)


def persist(conn: psycopg.Connection, batch: Batch) -> dict[str, int]:
    order = [
        ("servers", batch.servers),
        ("server_instances", batch.server_instances),
        ("actors", batch.actors),
        ("players", batch.players),
        ("player_profiles", batch.profiles),
        ("player_ranks", batch.ranks),
        ("player_badges", batch.badges),
        ("player_nicknames", batch.nicknames),
        ("privileged_subjects", batch.privileged_subjects),
        ("argus_users", batch.argus_users),
        ("actor_watchlist_entries", batch.watchlist_entries),
        ("network_sessions", batch.network_sessions),
        ("network_sessions_current", batch.network_sessions_current),
        ("backend_sessions", batch.backend_sessions),
        ("backend_sessions_current", batch.backend_sessions_current),
        ("chat_messages", batch.chat_messages),
        ("punishments", batch.punishments),
        ("reports", batch.reports),
        ("report_comments", batch.report_comments),
    ]
    counts: dict[str, int] = {}
    for table, rows in order:
        counts[table] = insert_rows(conn, table, rows)
    return counts

