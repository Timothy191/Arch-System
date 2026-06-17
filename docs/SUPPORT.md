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

- Ensure Node.js ≥22 and pnpm 9.15.9 are installed.
- Run `pnpm install` to install dependencies.
- Copy `apps/portal/env/.env.example` to `apps/portal/.env` and
  configure environment variables.
- Start Supabase locally: `pnpm --filter @repo/database supabase:dev`.

#### Build & Performance

- Run `pnpm quality` to check for linting, type checking, and dependency issues.
- Clear local Nx cache safely: `nx reset` (or `rm -rf .nx/cache`).
- For selective checks on changed files:
  `nx affected --target=lint,test,build` or `pnpm quality`.
- Update dependencies safely: `pnpm deps:lint` and then `pnpm deps:fix`.

#### Remote Cache (Self-hosted)

- If you see unexpectedly slow builds, verify your local MinIO bucket
  is reachable and the environment variables `NXCACHE_S3_*` are set.
- Run `nx reset` to clear local cache and force remote retrieval testing.

#### Database Issues

- Reset local Supabase database: `pnpm --filter @repo/database supabase:reset`
- Regenerate TypeScript types: `pnpm --filter @repo/database supabase:gen`
- Check migration status in `packages/database/migrations/`

#### Control-Room & Operations

- **Dashboard not updating**: Verify the `infra/observability/` stack
  status (Prometheus, Grafana) and check FUXA configurations/alerts.
- **Pin reset procedure**: See [Pin Reset Runbook](operations/pin-reset-procedure.md).
- **Shift closeout**: Refer to [Shift Closeout Runbook](operations/shift-closeout-runbook.md).
- **SCADA/FUXA Troubleshooting**: Refer to [FUXA Troubleshooting Guide](operations/fuxa-troubleshooting.md).
- **Runbooks for common scenarios**: Check the
  [operations/runbooks/](operations/runbooks/) directory.

### Getting Help

#### GitHub Issues

- 🐛 Report bugs:
  [Create an issue](https://github.com/DRACOSFN/Turborepo-Fullstack-Starter-Template/issues/new?template=bug_report.md)
- 💡 Request features:
  [Create an issue](https://github.com/DRACOSFN/Turborepo-Fullstack-Starter-Template/issues/new?template=feature_request.md)
- ❓ Ask questions:
  [Create a discussion](https://github.com/DRACOSFN/Turborepo-Fullstack-Starter-Template/discussions)

#### Community

- 💬 Discussions:
  [GitHub Discussions](https://github.com/DRACOSFN/Turborepo-Fullstack-Starter-Template/discussions)
- 🔒 Security Issues: See [SECURITY.md](SECURITY.md) for responsible disclosure.
- 🏢 Enterprise Support: Contact repository administrators or use
  internal operations support channels.

### Resources

#### Official Documentation

- [Nx Documentation](https://nx.dev)
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
