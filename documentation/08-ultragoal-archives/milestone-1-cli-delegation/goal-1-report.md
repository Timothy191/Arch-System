# Antigravity CLI Core Configs and Setup Report

## 1. Core Configuration Directories
The Antigravity CLI relies on the XDG Base Directory specification but primarily stores its configuration and state in the following directories:
- `~/.gemini/config/`: Contains core configuration files, rule definitions (`AGENTS.md`, `GEMINI.md`), MCP server definitions, and plugin configurations.
- `~/.gemini/antigravity-cli/`: Contains stateful data, history, conversation databases, caching, crash logs, and the main `settings.json`.

## 2. Key Configuration Files

### `~/.gemini/config/config.json`
Controls the overarching system configurations and global security policies.
**Key settings include:**
- `userSettings.artifactReviewMode`: e.g., `"ARTIFACT_REVIEW_MODE_TURBO"`
- `userSettings.autoExecutionPolicy`: e.g., `"CASCADE_COMMANDS_AUTO_EXECUTION_EAGER"`
- `userSettings.enableTerminalSandbox`: e.g., `false`
- `userSettings.globalPermissionGrants`: Defines whitelisted domains for `read_url` (like GitHub API) and commands allowed to run unsandboxed (like `npm`, `npx`).
- `plugins`: Configuration for external plugins (e.g., `oh-my-antigravity`).

### `~/.gemini/antigravity-cli/settings.json`
Controls the CLI behavior, model selection, and execution permissions.
**Key settings include:**
- `model`: e.g., `"Gemini 3.1 Pro (High)"`
- `agentMode`: e.g., `"accept-edits"`
- `allowNonWorkspaceAccess`: Boolean flag for accessing files outside the workspace.
- `permissions.allow`: A comprehensive array of allowed CLI commands (e.g., `command(cat)`, `command(git clone)`) that the agent can execute without explicit user approval.

### Rules and Guidelines
- `~/.gemini/config/AGENTS.md` and `~/.gemini/config/GEMINI.md`: Contain system-wide instructions for the agent (e.g., Root Cause Analysis gates, Quality gates, ReAct loop constraints, Continue_here.md protocols).

## 3. Setup and Constraints
- **State Management**: State and session history are persistently logged in `~/.gemini/antigravity-cli/history.jsonl` and `conversation_summaries.db`.
- **MCP Configurations**: Stored in `~/.gemini/config/mcp_config.json`.
- **Custom Skills**: Discovered and loaded from `~/.gemini/config/skills/` and `~/.gemini/antigravity-cli/builtin/skills/`.

This setup aligns with the required fail-closed execution, ensuring the agent remains within permitted boundaries defined by `loop-constraints.md` and the configurations listed above.
