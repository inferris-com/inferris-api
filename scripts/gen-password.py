#!/usr/bin/env python3

import argparse
import os
from pathlib import Path

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError


DEFAULT_PASSWORD_ENV_VAR = "AUTH_PASSWORD"
DEFAULT_JWT_SECRET_ENV_VAR = "AUTH_JWT_SECRET"

# Argon2id parameters.
# These are reasonable server-side defaults, but tune them for your deployment.
ARGON2_TIME_COST = 3
ARGON2_MEMORY_COST = 64 * 1024  # KiB = 64 MiB
ARGON2_PARALLELISM = 4
ARGON2_HASH_LEN = 32
ARGON2_SALT_LEN = 16


password_hasher = PasswordHasher(
    time_cost=ARGON2_TIME_COST,
    memory_cost=ARGON2_MEMORY_COST,
    parallelism=ARGON2_PARALLELISM,
    hash_len=ARGON2_HASH_LEN,
    salt_len=ARGON2_SALT_LEN,
)


def read_value_or_file_reference(value: str) -> str:
    """
    Resolve a value from either a literal string or a file reference.

    Supported forms:
      - "actual-value"
      - "file:/path/to/value"
      - "@/path/to/value"
    """
    if not value:
        raise ValueError("Value cannot be empty")

    if value.startswith("file:"):
        return read_secret_file(Path(value.removeprefix("file:")))

    if value.startswith("@"):
        return read_secret_file(Path(value.removeprefix("@")))

    return value


def read_secret_file(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"File does not exist: {path}")

    if not path.is_file():
        raise ValueError(f"Path is not a file: {path}")

    value = path.read_text(encoding="utf-8").strip()

    if not value:
        raise ValueError(f"File is empty: {path}")

    return value


def hash_password(password: str) -> str:
    """
    Hash a password using Argon2id.

    Returns an encoded Argon2id hash, for example:
      $argon2id$v=19$m=65536,t=3,p=4$...
    """
    if not password:
        raise ValueError("Password cannot be empty")

    return password_hasher.hash(password)


def verify_password(password: str, stored_hash: str) -> bool:
    """
    Verify a plaintext password against a stored Argon2id hash.
    """
    if not password or not stored_hash:
        return False

    try:
        return password_hasher.verify(stored_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Hash an actual password with Argon2id, while optionally resolving AUTH_JWT_SECRET separately."
    )

    parser.add_argument(
        "--password",
        help="Password to hash, or a file reference such as file:/run/secrets/auth_password.",
    )

    parser.add_argument(
        "--password-env",
        default=DEFAULT_PASSWORD_ENV_VAR,
        help=f"Environment variable containing the password. Defaults to {DEFAULT_PASSWORD_ENV_VAR}.",
    )

    parser.add_argument(
        "--jwt-secret-env",
        default=DEFAULT_JWT_SECRET_ENV_VAR,
        help=f"Environment variable containing the JWT secret. Defaults to {DEFAULT_JWT_SECRET_ENV_VAR}.",
    )

    args = parser.parse_args()

    raw_password = args.password or os.environ.get(args.password_env)

    if not raw_password:
        raise SystemExit(
            f"No password provided. Set {args.password_env}=<password> "
            f"or pass --password <password>."
        )

    password = read_value_or_file_reference(raw_password)

    # Optional: resolve JWT secret separately only to validate that it exists.
    # It is intentionally NOT used as the password.
    raw_jwt_secret = os.environ.get(args.jwt_secret_env)
    if raw_jwt_secret:
        _jwt_secret = read_value_or_file_reference(raw_jwt_secret)

    print(hash_password(password))


if __name__ == "__main__":
    main()
