#!/usr/bin/env python3
"""Semantic search over session summaries in .memory/index.jsonl

Usage: python3 semantic-search.py "query string" [limit=5]
"""

import json
import sys
import math
from pathlib import Path
from datetime import datetime

MEMORY_DIR = Path(__file__).parent.parent.parent / ".memory"
INDEX_FILE = MEMORY_DIR / "index.jsonl"


def dot_product(a: list, b: list) -> float:
    return sum(x * y for x, y in zip(a, b))


def magnitude(v: list) -> float:
    return math.sqrt(sum(x * x for x in v))


def cosine_similarity(a: list, b: list) -> float:
    if magnitude(a) == 0 or magnitude(b) == 0:
        return 0.0
    return dot_product(a, b) / (magnitude(a) * magnitude(b))


def generate_query_embedding(query: str, dim: int = 32) -> list:
    """Generate simple embedding for query."""
    import hashlib
    tokens = query.lower().split()[:20]
    vec = [0.0] * dim
    for token in tokens:
        h = int(hashlib.md5(token.encode()).hexdigest()[:8], 16)
        vec[h % dim] += 1.0
    return [min(x / 10.0, 1.0) for x in vec]


def search(query: str, limit: int = 5) -> list:
    if not INDEX_FILE.exists():
        return []

    query_vec = generate_query_embedding(query)
    results = []

    for line in INDEX_FILE.read_text().splitlines():
        if line.strip():
            data = json.loads(line)
            vec = data.get("embedding_vector", [])
            if vec:
                # Semantic similarity + recency boost
                sim = cosine_similarity(query_vec, vec)
                recency_boost = 1.0
                results.append((sim, data))

    return sorted(results, key=lambda x: x[0], reverse=True)[:limit]


def main():
    if len(sys.argv) < 2:
        print("Usage: semantic-search.py <query> [limit]", file=sys.stderr)
        sys.exit(1)

    query = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 5

    for score, entry in search(query, limit):
        print(f"{entry['id']}\t{score:.3f}\t{entry.get('topic', entry['id'])}")


if __name__ == "__main__":
    main()