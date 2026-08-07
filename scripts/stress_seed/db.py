from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Iterator

import psycopg
from dotenv import load_dotenv


@contextmanager
def connect() -> Iterator[psycopg.Connection]:
    load_dotenv()

    database_url = os.getenv("DATABASE_URL")
    if database_url:
        with psycopg.connect(database_url) as conn:
            yield conn
        return

    required_vars = ["PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD"]
    missing = [name for name in required_vars if not os.getenv(name)]
    if missing:
        raise RuntimeError(
            "Missing database config. Set DATABASE_URL or these variables: "
            + ", ".join(missing)
        )

    with psycopg.connect(
        host=os.getenv("PGHOST"),
        port=int(os.getenv("PGPORT", "5432")),
        dbname=os.getenv("PGDATABASE"),
        user=os.getenv("PGUSER"),
        password=os.getenv("PGPASSWORD"),
    ) as conn:
        yield conn

