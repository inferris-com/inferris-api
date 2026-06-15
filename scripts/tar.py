#!/usr/bin/env python3
"""
make_targz.py

Create a .tar.gz archive from files and/or directories.

Examples:

  # Archive the contents of ./projects/hello directly into hello.tar.gz
  python make_targz.py hello.tar.gz ./projects/hello

  # Archive the directory itself, so archive contains hello/<files>
  python make_targz.py hello.tar.gz ./projects/hello --include-top-dir

  # Archive multiple files/directories
  python make_targz.py bundle.tar.gz README.md src/ assets/

  # Exclude files or directories
  python make_targz.py bundle.tar.gz ./project --exclude "*.log" --exclude node_modules/

  # Disable default exclusions: .git/, .vs/, out/
  python make_targz.py bundle.tar.gz ./project --no-default-excludes
"""

from __future__ import annotations

import argparse
import fnmatch
import os
import tarfile
from pathlib import Path
from typing import Iterable


DEFAULT_EXCLUDES = [
    ".git/",
    ".vs/",
    "out/",
]


def normalize_path(path: Path) -> str:
    """
    Convert a path to a portable archive-style path using forward slashes.
    """
    return path.as_posix().lstrip("./")


def is_dir_pattern(pattern: str) -> bool:
    """
    Treat patterns ending with / as directory patterns.
    """
    return pattern.endswith("/") or pattern.endswith(os.sep)


def clean_pattern(pattern: str) -> str:
    """
    Normalize user-provided exclude patterns without destroying names like .vs or .git.
    """
    pattern = pattern.replace("\\", "/")

    if pattern.startswith("./"):
        pattern = pattern[2:]

    return pattern


def should_exclude(
    source_path: Path,
    archive_path: Path,
    exclude_patterns: Iterable[str],
) -> bool:
    """
    Decide whether a file or directory should be excluded.

    Patterns may match:
      - archive-relative path, e.g. src/cache/file.tmp
      - basename, e.g. *.log
      - directory names, e.g. .git/ or node_modules/

    Directory patterns ending in / exclude that directory and everything under it.
    """
    archive_name = normalize_path(archive_path)
    basename = source_path.name

    for raw_pattern in exclude_patterns:
        pattern = clean_pattern(raw_pattern)

        if not pattern:
            continue

        if is_dir_pattern(pattern):
            dirname = pattern.rstrip("/")

            parts = archive_path.parts
            if dirname in parts:
                return True

            if basename == dirname:
                return True

            continue

        if fnmatch.fnmatch(archive_name, pattern):
            return True

        if fnmatch.fnmatch(basename, pattern):
            return True

        # Also allow patterns like "build" to exclude a directory named "build"
        # and everything beneath it.
        if source_path.is_dir() and basename == pattern:
            return True

        if pattern in archive_path.parts:
            return True

    return False


def iter_paths_for_archive(
    input_path: Path,
    include_top_dir: bool,
) -> Iterable[tuple[Path, Path]]:
    """
    Yield pairs of:

      source_path: actual filesystem path
      archive_path: path to use inside the tar archive

    If include_top_dir is False and input_path is a directory:
      ./hello/a.txt becomes a.txt

    If include_top_dir is True and input_path is a directory:
      ./hello/a.txt becomes hello/a.txt

    Files are always added using their basename unless multiple source paths
    require their relative parent context.
    """
    input_path = input_path.resolve()

    if input_path.is_file():
        yield input_path, Path(input_path.name)
        return

    if not input_path.is_dir():
        raise FileNotFoundError(f"Input path does not exist or is not supported: {input_path}")

    if include_top_dir:
        archive_root = Path(input_path.name)
        base_dir = input_path.parent
    else:
        archive_root = Path(".")
        base_dir = input_path

    for root, dirs, files in os.walk(input_path):
        root_path = Path(root)

        # Yield directories too, so empty directories are preserved unless excluded.
        rel_root = root_path.relative_to(base_dir)

        if not include_top_dir and rel_root == Path("."):
            archive_dir = Path(".")
        else:
            archive_dir = rel_root

        if archive_dir != Path("."):
            yield root_path, archive_dir

        for filename in files:
            source_file = root_path / filename
            rel_file = source_file.relative_to(base_dir)

            if include_top_dir:
                archive_file = rel_file
            else:
                archive_file = source_file.relative_to(input_path)

            if archive_root != Path(".") and not str(archive_file).startswith(str(archive_root)):
                archive_file = archive_root / archive_file

            yield source_file, archive_file


def create_tar_gz(
    output_file: Path,
    input_paths: list[Path],
    exclude_patterns: list[str],
    include_top_dir: bool,
    verbose: bool,
) -> None:
    output_file = output_file.resolve()

    with tarfile.open(output_file, "w:gz") as tar:
        added = set()

        for input_path in input_paths:
            if not input_path.exists():
                raise FileNotFoundError(f"Input path does not exist: {input_path}")

            for source_path, archive_path in iter_paths_for_archive(
                input_path=input_path,
                include_top_dir=include_top_dir,
            ):
                if archive_path == Path("."):
                    continue

                if should_exclude(source_path, archive_path, exclude_patterns):
                    if verbose:
                        print(f"excluded: {archive_path}")
                    continue

                archive_name = normalize_path(archive_path)

                # Avoid duplicate archive entries when multiple inputs overlap.
                if archive_name in added:
                    if verbose:
                        print(f"skipped duplicate: {archive_name}")
                    continue

                tar.add(source_path, arcname=archive_name, recursive=False)
                added.add(archive_name)

                if verbose:
                    print(f"added: {archive_name}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a .tar.gz archive from files and/or directories."
    )

    parser.add_argument(
        "output",
        type=Path,
        help="Output archive path, e.g. archive.tar.gz",
    )

    parser.add_argument(
        "inputs",
        nargs="+",
        type=Path,
        help="Files and/or directories to include in the archive.",
    )

    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        help=(
            "Exclude a file or directory pattern. "
            "Can be used multiple times. "
            "Examples: --exclude '*.log' --exclude node_modules/ --exclude build/"
        ),
    )

    parser.add_argument(
        "--no-default-excludes",
        action="store_true",
        help="Disable default exclusions: .git/, .vs/, out/",
    )

    parser.add_argument(
        "--include-top-dir",
        action="store_true",
        help=(
            "When an input is a directory, include the directory itself at the "
            "archive root. By default, only the directory contents are archived."
        ),
    )

    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Print files as they are added or excluded.",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    excludes = []

    if not args.no_default_excludes:
        excludes.extend(DEFAULT_EXCLUDES)

    excludes.extend(args.exclude)

    create_tar_gz(
        output_file=args.output,
        input_paths=args.inputs,
        exclude_patterns=excludes,
        include_top_dir=args.include_top_dir,
        verbose=args.verbose,
    )


if __name__ == "__main__":
    main()

