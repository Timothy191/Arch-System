"""TDD test: verify MCP tooling artifacts have been fully removed.

Run: python3 -m pytest tests/test_mcp_removed.py -v
  (or: python3 -m pytest tests/test_mcp_removed.py::test_no_mcp_references_in_dev_sh -v)

This test enforces a RED-GREEN-REFACTOR cycle:
  RED   — this test must FAIL before the MCP references are stripped.
  GREEN — after removal, this test must PASS.
  REFACTOR — no behavior is added beyond removal; this is a guardrail.
"""

import re
from pathlib import Path

REPO = Path("/home/timothy/orca/Arch-System")


def _read(rel: str) -> str:
    p = REPO / rel
    if not p.exists():
        return ""
    return p.read_text()


def test_no_mcp_config_file_exists():
    """The tracked MCP config must be gone."""
    assert not (REPO / "config/tools/mcp.json").exists(), (
        "config/tools/mcp.json should be removed from the repo"
    )


def test_no_mcp_sync_script_exists():
    """The MCP sync helper must be deleted."""
    assert not (REPO / "scripts/sync-mcp-config.js").exists(), (
        "scripts/sync-mcp-config.js should be removed"
    )


def test_no_mcp_validate_script_exists():
    """The MCP validation helper must be deleted."""
    assert not (REPO / "scripts/validate-mcp-servers.js").exists(), (
        "scripts/validate-mcp-servers.js should be removed"
    )


def test_no_mcp_references_in_dev_sh():
    """scripts/dev.sh must not invoke MCP sync/validate or start MCP servers."""
    src = _read("scripts/dev.sh")
    # Case-insensitive scan for any remaining MCP invocation.
    hits = [
        line
        for line in src.splitlines()
        if re.search(r"(sync-mcp-config|validate-mcp-servers|firecrawl-mcp|next-devtools-mcp|\.mcp\.json|mcp_config\.json|mcp\.json|MCP Servers|Phase.*MCP|orphan mcp)", line, re.IGNORECASE)
    ]
    assert not hits, (
        "scripts/dev.sh still references MCP:\n"
        + "\n".join(f"  line {i+1}: {h}" for i, h in enumerate(hits))
    )


def test_no_mcp_references_in_readme():
    """AGENTS.md important-files table must not list .mcp.json anymore."""
    src = _read("AGENTS.md")
    hits = [
        line
        for line in src.splitlines()
        if re.search(r"\.mcp\.json", line)
    ]
    assert not hits, (
        "AGENTS.md still references .mcp.json:\n"
        + "\n".join(f"  line {i+1}: {h}" for i, h in enumerate(hits))
    )
