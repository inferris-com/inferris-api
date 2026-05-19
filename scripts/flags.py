#!/usr/bin/env python3

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from typing import Iterable

import psycopg
from dotenv import load_dotenv


@dataclass(frozen=True)
class FlagDefinition:
    flag_key: str
    bit_position: int
    label: str | None
    description: str | None
    is_active: bool


def get_connection() -> psycopg.Connection:
    load_dotenv()

    database_url = os.getenv("DATABASE_URL")

    if database_url:
        return psycopg.connect(database_url)

    required_vars = ["PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD"]
    missing_vars = [name for name in required_vars if not os.getenv(name)]

    if missing_vars:
        raise RuntimeError(
            "Missing database config. Set DATABASE_URL or these variables: "
            + ", ".join(missing_vars)
        )

    return psycopg.connect(
        host=os.getenv("PGHOST"),
        port=int(os.getenv("PGPORT", "5432")),
        dbname=os.getenv("PGDATABASE"),
        user=os.getenv("PGUSER"),
        password=os.getenv("PGPASSWORD"),
    )


def fetch_flags(
    conn: psycopg.Connection,
    *,
    include_inactive: bool = False,
) -> list[FlagDefinition]:
    where_clause = "" if include_inactive else "WHERE is_active = TRUE"

    query = f"""
        SELECT
            flag_key,
            bit_position,
            label,
            description,
            is_active
        FROM player_flag_definitions
        {where_clause}
        ORDER BY bit_position;
    """

    with conn.cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()

    return [
        FlagDefinition(
            flag_key=row[0],
            bit_position=row[1],
            label=row[2],
            description=row[3],
            is_active=row[4],
        )
        for row in rows
    ]


def normalize_key(flag_key: str) -> str:
    return flag_key.strip().upper()


def encode_flags(
    definitions: Iterable[FlagDefinition],
    requested_keys: Iterable[str],
) -> int:
    definitions_by_key = {
        normalize_key(definition.flag_key): definition
        for definition in definitions
    }

    value = 0

    for raw_key in requested_keys:
        key = normalize_key(raw_key)

        definition = definitions_by_key.get(key)

        if definition is None:
            known = ", ".join(sorted(definitions_by_key.keys()))
            raise ValueError(f"Unknown flag key: {raw_key}. Known flags: {known}")

        value |= 1 << definition.bit_position

    return value


def decode_flags(
    definitions: Iterable[FlagDefinition],
    value: int,
) -> list[FlagDefinition]:
    enabled: list[FlagDefinition] = []

    for definition in definitions:
        bit_value = 1 << definition.bit_position

        if value & bit_value:
            enabled.append(definition)

    return enabled


def print_definitions(definitions: Iterable[FlagDefinition]) -> None:
    for definition in definitions:
        status = "active" if definition.is_active else "inactive"

        print(
            f"{definition.flag_key:<24} "
            f"bit={definition.bit_position:<3} "
            f"value={1 << definition.bit_position:<18} "
            f"{status:<8} "
            f"{definition.label or ''}"
        )


def print_decoded_flags(flags: Iterable[FlagDefinition], value: int) -> None:
    flags = list(flags)

    print(f"Value: {value}")
    print(f"Binary: {bin(value)}")

    if not flags:
        print("No matching flags found.")
        return

    print()
    print("Enabled flags:")

    for definition in flags:
        bit_value = 1 << definition.bit_position

        print(
            f"- {definition.flag_key} "
            f"(bit {definition.bit_position}, value {bit_value})"
        )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Encode/decode player bitmask flags using local Postgres flag definitions."
    )

    parser.add_argument(
        "--include-inactive",
        action="store_true",
        help="Include inactive flag definitions.",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    encode_parser = subparsers.add_parser(
        "encode",
        help="Compute a bitmask number from one or more flag keys.",
    )
    encode_parser.add_argument(
        "flags",
        nargs="+",
        help="Flag keys, for example: STAFF VANISHED",
    )

    decode_parser = subparsers.add_parser(
        "decode",
        help="Decode a bitmask number into flag definitions.",
    )
    decode_parser.add_argument(
        "value",
        type=int,
        help="Bitmask value, for example: 3",
    )

    subparsers.add_parser(
        "list",
        help="List known flag definitions.",
    )

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        with get_connection() as conn:
            definitions = fetch_flags(
                conn,
                include_inactive=args.include_inactive,
            )

        if args.command == "encode":
            value = encode_flags(definitions, args.flags)

            print(f"Value: {value}")
            print(f"Binary: {bin(value)}")
            return 0

        if args.command == "decode":
            enabled_flags = decode_flags(definitions, args.value)
            print_decoded_flags(enabled_flags, args.value)
            return 0

        if args.command == "list":
            print_definitions(definitions)
            return 0

        parser.print_help()
        return 1

    except Exception as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

