# Arch-System Agent Cookbooks

Task-focused playbooks for coding agents working in Arch-System. Read the relevant cookbook before editing; `AGENTS.md` remains the authoritative repository contract.

## Choose a cookbook

| Task                                     | Cookbook                                                     |
| ---------------------------------------- | ------------------------------------------------------------ |
| Add or change a portal feature           | [feature-delivery.md](./feature-delivery.md)                 |
| Change tables, migrations, or contracts  | [database-contract.md](./database-contract.md)               |
| Change auth, proxy, permissions, or APIs | [security-and-api.md](./security-and-api.md)                 |
| Build or update UI                       | [ui-and-design-system.md](./ui-and-design-system.md)         |
| Validate, review, and release work       | [verification-and-release.md](./verification-and-release.md) |

## Universal operating loop

1. Read root and nearest-scope `AGENTS.md` files.
2. Inspect the live caller, data source, and tests before editing.
3. Make the smallest change that preserves existing boundaries.
4. Run the narrowest relevant check first, then the required broader gate.
5. Never print or commit secrets, `.env*` files, generated runtime state, or test credentials.
6. Report evidence, failures, and known pre-existing debt precisely.
