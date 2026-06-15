#!/usr/bin/env python3

import argparse
import base64
import hashlib
import hmac
import os
from pathlib import Path


DEFAULT_PASSWORD_ENV_VAR = "AUTH_PASSWORD"
DEFAULT_JWT_SECRET_ENV_VAR = "AUTH_JWT_SECRET"
DEFAULT_ITERATIONS = 600_000


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


def hash_password(password: str, salt: bytes | None = None) -> str:
    """
    Hash a password using PBKDF2-SHA256.

    Returns:
      pbkdf2_sha256$iterations$salt$hash
    """
    if not password:
        raise ValueError("Password cannot be empty")

    salt = salt or os.urandom(16)

    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        DEFAULT_ITERATIONS,
        dklen=32,
    )

    salt_b64 = base64.b64encode(salt).decode("utf-8")
    hash_b64 = base64.b64encode(derived_key).decode("utf-8")

    return f"pbkdf2_sha256${DEFAULT_ITERATIONS}${salt_b64}${hash_b64}"


def verify_password(password: str, stored_hash: str) -> bool:
    """
    Verify a plaintext password against a stored PBKDF2 hash.
    """
    try:
        algorithm, iterations_raw, salt_b64, expected_hash_b64 = stored_hash.split("$")
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    try:
        iterations = int(iterations_raw)
        salt = base64.b64decode(salt_b64)
        expected_hash = base64.b64decode(expected_hash_b64)
    except Exception:
        return False

    actual_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
        dklen=len(expected_hash),
    )

    return hmac.compare_digest(actual_hash, expected_hash)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Hash an actual password, while optionally resolving AUTH_JWT_SECRET separately."
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
