# Support

## How to Get Help

### Documentation

- 📖 **[Documentation Index](DOCUMENTATION_INDEX.md)** —
  Start here for complete documentation
- 📖 **[README.md](../README.md)** —
  Project overview and quick start guide
- 📖 **[CONTRIBUTING.md](CONTRIBUTING.md)** — Contribution guidelines
- 📖 **[DESIGN.md](DESIGN.md)** — Design system and component rules
- 📖 **[Packages Overview](../packages/README.md)** —
  Core monorepo packages explanation
- 📖 **[Infrastructure Setup](../infra/README.md)** —
  Docker, Redis cluster, and systemd configurations
- 📖 **[Operations & SCADA](operations/supervisor-workflow.md)** —
  Control room operations and supervisor workflows
- 📖 **[Architecture Diagrams](../apps/portal/public/media/diagrams/)** —
  Interactive system flows and pipeline diagrams

### Common Issues

#### Development Environment Setup

- Ensure Node.js `>=24.0.0` and `pnpm@9.15.9` are installed.
- Run `pnpm install --frozen-lockfile` to install dependencies.
- Copy `apps/portal/.env.example` to `apps/portal/.env` and configure your Cloud Supabase credentials and local Redis URL (`redis://localhost:6379`).
- Start local Redis: `pnpm redis:up` (`infra/docker/compose.redis.yml`).

#### Build & Performance

- Run `pnpm agent:verify` or `pnpm quality` to verify linting, type checking, architectural boundaries, and tests.
- Clear local Turbo cache safely: `rm -rf .turbo/cache`.
- For selective checks on changed files:
  `pnpm turbo:affected:type-check` or `pnpm agent:verify`.
- Update dependencies safely: `pnpm deps:lint` and then `pnpm deps:fix`.

#### Remote Cache (Self-hosted)

- If you see unexpectedly slow builds, verify your local MinIO bucket
  is reachable and the environment variables `TURBO_REMOTE_CACHE_URL`
  and `TURBO_REMOTE_CACHE_SIGNATURE_KEY` are set.
- Run `rm -rf .turbo/cache` to clear local cache and force remote retrieval testing.

#### Database Issues

- Run migration and RLS checks locally: `pnpm --filter @repo/database test` and `pnpm lint:migrations`
- Regenerate TypeScript types: `pnpm --filter @repo/supabase supabase:gen-types`
- Check migration status in `packages/database/migrations/`

#### Control-Room & Operations

- **Dashboard not updating**: Verify the `infra/monitoring/docker-compose.yml` stack
  status (`pnpm monitor:grafana`) — OpenTelemetry Collector, Prometheus, Grafana — and check FUXA configurations/alerts.
- **Pin reset procedure**: See [Pin Reset Runbook](operations/pin-reset-procedure.md).
- **Shift closeout**: Refer to [Shift Closeout Runbook](operations/shift-closeout-runbook.md).
- **SCADA/FUXA Troubleshooting**: Refer to [FUXA Troubleshooting Guide](operations/fuxa-troubleshooting.md).
- **Runbooks for common scenarios**: Check the
  [operations/runbooks/](operations/runbooks/) directory.

### Getting Help

#### GitHub Issues

- 🐛 Report bugs:
  [Create an issue](https://github.com/Timothy191/Arch-System/issues/new?template=bug_report.md)
- 💡 Request features:
  [Create an issue](https://github.com/Timothy191/Arch-System/issues/new?template=feature_request.md)
- ❓ Ask questions:
  [Create an issue or discussion](https://github.com/Timothy191/Arch-System/issues)

#### Community

- 💬 Issues & Q&A:
  [GitHub Issues](https://github.com/Timothy191/Arch-System/issues)
- 🔒 Security Issues: See [SECURITY.md](SECURITY.md) or [GitHub Private Vulnerability Reporting](https://github.com/Timothy191/Arch-System/security/advisories/new) for responsible disclosure.
- 🏢 Enterprise Support: Contact repository administrators or use
  internal operations support channels.

### Resources

#### Official Documentation

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [pnpm Documentation](https://pnpm.io)

#### Project-Specific Guides

- [Deployment Guide](DEPLOYMENT.md)
- [Agent Development Guidelines](CLAUDE.md)
- [AI Integration Guide](GEMINI.md)

### Response Time

- **Critical Issues**: 12-24 hours
- **Feature Requests**: 1-2 weeks
- **Questions**: 1-2 business days
- **Enterprise Support**: SLA-based response times (within local
  business hours, UTC+2)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for
guidelines on how to get started.

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE)
file for details.
