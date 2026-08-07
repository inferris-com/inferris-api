from __future__ import annotations

import argparse
from dataclasses import replace

from .catalog import load_catalog
from .config import (
    DEFAULT_GENERATIONS,
    DEFAULT_PROBABILITIES,
    GENERATION_NAMES,
    PRESETS,
    Counts,
)
from .db import connect
from .generate import StressGenerator
from .insert import persist


def _csv(value: str | None) -> set[str]:
    if not value:
        return set()
    values = {item.strip() for item in value.split(",") if item.strip()}
    unknown = values - set(GENERATION_NAMES)
    if unknown:
        raise argparse.ArgumentTypeError(
            f"Unknown generation(s): {', '.join(sorted(unknown))}. "
            f"Known: {', '.join(GENERATION_NAMES)}"
        )
    return values


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Generate artificial stress-test data. This complements Kysely seeds and "
            "assumes the base dev seed has already created catalog data."
        )
    )
    parser.add_argument(
        "--preset",
        choices=sorted(PRESETS),
        default="default",
        help="Starting count profile.",
    )
    parser.add_argument("--only", type=_csv, help="Comma-separated generations to run.")
    parser.add_argument("--skip", type=_csv, help="Comma-separated generations to skip.")
    parser.add_argument("--players", type=int, help="Number of actors/players to generate.")
    parser.add_argument("--chat-messages", type=int, help="Number of chat messages to generate.")
    parser.add_argument("--punishments", type=int, help="Number of punishments to generate.")
    parser.add_argument("--reports", type=int, help="Number of reports to generate.")
    parser.add_argument("--sessions", type=int, help="Number of player sessions to generate.")
    parser.add_argument("--servers", type=int, help="Number of synthetic servers to generate.")
    parser.add_argument("--include-staff", action="store_true", help="Allow generated staff and Argus users.")
    parser.add_argument("--seed", type=int, help="Random seed for repeatable output shape.")
    parser.add_argument("--dry-run", action="store_true", help="Generate and summarize without writing rows.")

    probability_group = parser.add_argument_group("probabilities")
    probability_group.add_argument("--staff-probability", type=float)
    probability_group.add_argument("--admin-given-staff-probability", type=float)
    probability_group.add_argument("--supporter-probability", type=float)
    probability_group.add_argument("--deleted-probability", type=float)
    probability_group.add_argument("--watchlisted-probability", type=float)
    probability_group.add_argument("--muted-probability", type=float)
    probability_group.add_argument("--banned-probability", type=float)
    probability_group.add_argument("--quarantined-probability", type=float)
    probability_group.add_argument("--disabled-probability", type=float)
    probability_group.add_argument("--tester-probability", type=float)
    probability_group.add_argument("--cool-probability", type=float)
    probability_group.add_argument("--nicked-staff-probability", type=float)
    probability_group.add_argument("--vanished-staff-probability", type=float)
    probability_group.add_argument("--random-badge-probability", type=float)
    probability_group.add_argument("--staff-active-channel-probability", type=float)
    probability_group.add_argument("--open-session-probability", type=float)
    probability_group.add_argument("--report-closed-probability", type=float)
    probability_group.add_argument("--punishment-active-probability", type=float)
    return parser


def _counts(args: argparse.Namespace) -> Counts:
    values = dict(PRESETS[args.preset])
    for key, attr in (
        ("players", "players"),
        ("chat_messages", "chat_messages"),
        ("punishments", "punishments"),
        ("reports", "reports"),
        ("sessions", "sessions"),
        ("servers", "servers"),
    ):
        override = getattr(args, attr)
        if override is not None:
            if override < 0:
                raise SystemExit(f"{attr} cannot be negative")
            values[key] = override
    return Counts(**values)


def _probabilities(args: argparse.Namespace):
    probabilities = DEFAULT_PROBABILITIES
    mapping = {
        "staff_probability": "staff",
        "admin_given_staff_probability": "admin_given_staff",
        "supporter_probability": "supporter",
        "deleted_probability": "deleted",
        "watchlisted_probability": "watchlisted",
        "muted_probability": "muted",
        "banned_probability": "banned",
        "quarantined_probability": "quarantined",
        "disabled_probability": "disabled",
        "tester_probability": "tester",
        "cool_probability": "cool",
        "nicked_staff_probability": "nicked_staff",
        "vanished_staff_probability": "vanished_staff",
        "random_badge_probability": "random_badge",
        "staff_active_channel_probability": "staff_active_channel",
        "open_session_probability": "open_session",
        "report_closed_probability": "report_closed",
        "punishment_active_probability": "punishment_active",
    }
    replacements = {}
    for cli_name, field_name in mapping.items():
        value = getattr(args, cli_name)
        if value is not None:
            if not 0 <= value <= 1:
                raise SystemExit(f"--{cli_name.replace('_', '-')} must be between 0 and 1")
            replacements[field_name] = value
    return replace(probabilities, **replacements)


def _generations(args: argparse.Namespace) -> set[str]:
    selected = set(DEFAULT_GENERATIONS if args.only is None else args.only)
    if args.only is None and args.servers is not None and args.servers > 0:
        selected.add("servers")
    selected -= set(args.skip or set())
    if not args.include_staff:
        selected.discard("argus-users")
    return selected


def _summarize(counts: dict[str, int]) -> None:
    for table, count in counts.items():
        if count:
            print(f"{table}: {count}")


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    counts = _counts(args)
    probabilities = _probabilities(args)
    generations = _generations(args)

    with connect() as conn:
        catalog = load_catalog(conn)
        generator = StressGenerator(
            catalog,
            counts,
            probabilities,
            include_staff=args.include_staff,
            seed=args.seed,
        )
        batch = generator.generate(generations)

        planned = {
            "servers": len(batch.servers),
            "server_instances": len(batch.server_instances),
            "actors": len(batch.actors),
            "players": len(batch.players),
            "player_profiles": len(batch.profiles),
            "player_ranks": len(batch.ranks),
            "player_badges": len(batch.badges),
            "player_nicknames": len(batch.nicknames),
            "privileged_subjects": len(batch.privileged_subjects),
            "argus_users": len(batch.argus_users),
            "actor_watchlist_entries": len(batch.watchlist_entries),
            "network_sessions": len(batch.network_sessions),
            "network_sessions_current": len(batch.network_sessions_current),
            "backend_sessions": len(batch.backend_sessions),
            "backend_sessions_current": len(batch.backend_sessions_current),
            "chat_messages": len(batch.chat_messages),
            "punishments": len(batch.punishments),
            "reports": len(batch.reports),
            "report_comments": len(batch.report_comments),
        }

        if args.dry_run:
            print("Dry run. Planned rows:")
            _summarize(planned)
            conn.rollback()
            return 0

        written = persist(conn, batch)
        conn.commit()
        print("Inserted rows, ignoring conflicts:")
        _summarize(written)
        return 0
