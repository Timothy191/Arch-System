#!/usr/bin/env python3
"""Remove all ephemeral staging and clear active checkouts."""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib.common import ACTIVE_FILE, RUN_DIR, STAGING_DIR, save_active  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Purge all lending-library ephemeral state")
    parser.add_argument("--force", action="store_true", help="Skip confirmation")
    args = parser.parse_args()

    if STAGING_DIR.exists():
        shutil.rmtree(STAGING_DIR, ignore_errors=True)
    STAGING_DIR.mkdir(parents=True, exist_ok=True)
    save_active({"resources": []})
    if ACTIVE_FILE.exists():
        ACTIVE_FILE.unlink(missing_ok=True)

    print(f"PURGED: {RUN_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
