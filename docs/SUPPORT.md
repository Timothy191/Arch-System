# Support

## How to Get Help

### Documentation

- 📖 **[Documentation Index](DOCUMENTATION_INDEX.md)** — Start here for complete documentation
- 📖 **[README.md](../README.md)** — Project overview and quick start guide
- 📖 **[CONTRIBUTING.md](CONTRIBUTING.md)** — Contribution guidelines
- 📖 **[DESIGN.md](DESIGN.md)** — Design system and component rules

### Common Issues

**Development Environment Setup**

- Ensure Node.js ≥22 and pnpm 9.15.9 are installed
- Run `pnpm install` to install dependencies
- Copy `apps/portal/.env.example` to `apps/portal/.env` and configure environment variables
- Start Supabase locally: `pnpm --filter @repo/database supabase:dev`

**Build Errors**

- Run `pnpm quality` to check for linting, type checking, and dependency issues
- Ensure all dependencies are up to date: `pnpm deps:lint` and `pnpm deps:fix`
- Clear Nx cache: `rm -rf .nx/cache`

**Database Issues**

- Reset local Supabase: `pnpm --filter @repo/database supabase:reset`
- Regenerate TypeScript types: `pnpm --filter @repo/database supabase:gen`
- Check migration status in `packages/database/migrations/`

### Getting Help

**GitHub Issues**

- 🐛 Report bugs: [Create an issue](https://github.com/your-org/arch-system/issues/new?template=bug_report.md)
- 💡 Request features: [Create an issue](https://github.com/your-org/arch-system/issues/new?template=feature_request.md)
- ❓ Ask questions: [Create a discussion](https://github.com/your-org/arch-system/discussions)

**Community**

- 💬 Discussions: [GitHub Discussions](https://github.com/your-org/arch-system/discussions)
- 📧 Email: <support@example.com> (for enterprise support)

**Security Issues**

- 🔒 Security vulnerabilities: See [SECURITY.md](SECURITY.md) for responsible disclosure

### Resources

**Official Documentation**

- [Nx Documentation](https://nx.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [pnpm Documentation](https://pnpm.io)

**Project-Specific Guides**

- [Deployment Guide](DEPLOYMENT.md)
- [Agent Development Guidelines](CLAUDE.md)
- [AI Integration Guide](GEMINI.md)

### Response Time

- **Critical Issues**: 24-48 hours
- **Feature Requests**: 1-2 weeks
- **Questions**: 2-3 business days
- **Enterprise Support**: SLA-based response times

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
