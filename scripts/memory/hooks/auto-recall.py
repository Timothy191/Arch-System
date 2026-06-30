#!/usr/bin/env python3
"""Auto-recall hook — generate context suggestions on session start.

Reads git context, runs semantic search, writes suggestions to .memory/.recall-suggestions.md
"""

import subprocess
import json
from pathlib import Path

MEMORY_DIR = Path(__file__).parent.parent.parent / ".memory"
SUGGESTIONS_FILE = MEMORY_DIR / ".recall-suggestions.md"
INDEX_FILE = MEMORY_DIR / "index.jsonl"


def get_recent_topics(limit: int = 3) -> list:
    """Get most recent commit messages for topic extraction."""
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--pretty=%s"],
            capture_output=True,
            text=True,
        )
        return [result.stdout.strip()] if result.stdout.strip() else []
    except:
        return []


def simple_search(query: str, limit: int = 3) -> list:
    """Simple keyword-based search over index.jsonl."""
    results = []
    if not INDEX_FILE.exists():
        return results

    query_lower = query.lower()
    for line in INDEX_FILE.read_text().splitlines():
        if line.strip():
            try:
                entry = json.loads(line)
                topic = entry.get("topic", "").lower()
                if any(word in topic for word in query_lower.split()):
                    results.append(entry["id"])
            except:
                pass

    return results[:limit]


def main():
    topics = get_recent_topics()
    suggestions = []

    for topic in topics:
        suggestions.extend(simple_search(topic))

    # Deduplicate and limit
    suggestions = list(dict.fromkeys(suggestions))[:5]

    if suggestions:
        content = "# Auto-Recall Suggestions\n\n"
        content += "Loading relevant context from prior sessions:\n\n"
        for suggestion in suggestions:
            content += f"- [`{suggestion}`](sessions/{suggestion}.md)\n"

        SUGGESTIONS_FILE.write_text(content)
        print(f"Wrote suggestions to {SUGGESTIONS_FILE}")


if __name__ == "__main__":
    main()