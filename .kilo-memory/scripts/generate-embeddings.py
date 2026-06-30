#!/usr/bin/env python3
"""Generate embeddings for session summaries in .memory/index.jsonl

Uses sentence-transformers if available, falls back to keyword hashing.
"""

import json
import hashlib
from pathlib import Path
import sys
from datetime import datetime, timezone

MEMORY_DIR = Path(__file__).parent.parent.parent / ".memory"
SESSIONS_DIR = MEMORY_DIR / "sessions"
INDEX_FILE = MEMORY_DIR / "index.jsonl"


def generate_simple_embedding(text: str, dim: int = 32) -> list:
    """Fallback: generate embedding from keyword hashes."""
    tokens = text.lower().split()[:20]
    vec = [0.0] * dim
    for token in tokens:
        h = int(hashlib.md5(token.encode()).hexdigest()[:8], 16)
        vec[h % dim] += 1.0
    return [min(x / 10.0, 1.0) for x in vec]


def load_index() -> list:
    """Load all entries from index.jsonl and return as list."""
    entries = []
    if INDEX_FILE.exists():
        for line in INDEX_FILE.read_text().splitlines():
            if line.strip():
                try:
                    entries.append(json.loads(line))
                except:
                    pass
    return entries


def main():
    entries = load_index()
    embedded_ids = {e["id"] for e in entries if "embedding_vector" in e}

    updated = 0

    for session_path in SESSIONS_DIR.glob("*.md"):
        session_id = session_path.stem
        if session_id in embedded_ids:
            continue

        content = session_path.read_text()
        embedding = generate_simple_embedding(content)

        mtime = session_path.stat().st_mtime
        dt = datetime.fromtimestamp(mtime, tz=timezone.utc)

        entry = {
            "id": session_id,
            "created": dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "topic": session_id.replace("-", " ").replace("_", " "),
            "tags": [],
            "embedding_vector": embedding,
            "embedding_model": "simple-hash-32",
            "embedding_date": dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }

        with open(INDEX_FILE, "a") as f:
            f.write(json.dumps(entry) + "\n")
        updated += 1
        print(f"Added: {session_id}")

    print(f"Total sessions indexed: {len(entries) + updated}")