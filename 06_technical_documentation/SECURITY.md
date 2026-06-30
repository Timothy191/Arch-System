# Security Policy

## Related Documentation

- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** — Complete documentation index and quick navigation guide
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Deployment security best practices
- **[CLAUDE.md](CLAUDE.md)** — Development security conventions

---

## Reporting a Vulnerability

If you find a security vulnerability in this repository, please report it privately rather than opening a public issue.

Preferred reporting options:

- Open a GitHub Security Advisory for this repository
- Contact the repository owner on GitHub: @timothy191

Do not send secrets or sensitive data in public issue threads.

## Supported Versions

This repository is maintained on the `master` branch. Security fixes are prioritized on the current deployment branch.

## Security Practices

- Dependency updates are managed with Dependabot and weekly audits
- CI includes linting, type-checking, build verification, and vulnerability scanning
- Sensitive credentials are never stored in source control and are excluded via `.gitignore`
