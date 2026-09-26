# Environment Files Guide

This guide explains the purpose and usage of all environment configuration files in the Arch-Systems (Plantcor) project.

## 📁 File Structure Overview

```
Arch-System/
├── .env.example                         # Root development template (4.9KB)
├── .env                                 # Root actual environment (NEVER commit) (8.3KB)
├── .env.tools                           # Docker tools template (1.9KB)
├── apps/
│   └── portal/
│       ├── env/
│       │   └── .env.example             # Portal development template (4.1KB)
│       ├── .env                        # Portal actual environment (NEVER commit) (5.6KB)
│       └── env/
│           ├── .env.production.example # Portal production template (3.8KB)
│           └── .env.portal.compose.example # Portal Docker Compose template (972B)
└── packages/
    └── eval/
        └── .env                        # Evaluation package environment (Python/DeepEval)
```

## 🔐 Security Rules

### CRITICAL: NEVER Commit Actual .env Files

- Actual `.env` files contain **REAL SECRETS** (API keys, passwords, tokens)
- Only `.env.example` and `.env.production.example` files should be committed
- The `.gitignore` file is configured to exclude actual `.env` files
- If you accidentally commit secrets, **rotate them immediately**

### Environment File Safety Checklist

- [ ] Never include real API keys, passwords, or tokens in committed files
- [ ] Always use `.env.example` or `.env.production.example` as templates
- [ ] Test environment changes in development before production
- [ ] Rotate secrets if accidentally exposed
- [ ] Use different secrets for development, staging, and production

## 📋 File Purposes

### Root Level Environment Files

#### `.env.example` (4.9KB)

**Purpose**: Template for root-level development environment configuration

**When to use**:

- Starting a new development environment
- Setting up the project for the first time
- Reference for all possible root environment variables

**Contains**:

- Server configuration (PORT)
- Supabase configuration (URLs, keys, database URLs)
- Google AI configuration (Project ID, API key)
- Monitoring/Observability (Sentry, OpenTelemetry)
- Tools configuration (Flowise, FUXA)
- Redis configuration
- Notifications/Events (Novu, Inngest)
- Next.js build configuration

#### `.env` (8.3KB) ⚠️ NEVER COMMIT

**Purpose**: Actual root environment configuration with real secrets

**When to use**:

- Local development (main development environment)
- Reference for currently active configuration
- Debugging environment-specific issues

**Contains**: Same variables as `.env.example` but with real values

#### `.env.tools` (1.9KB)

**Purpose**: Template for Docker-based development tools environment

**When to use**:

- Starting Docker tools stack (Flowise, Redis, Langfuse, Qdrant, ClickHouse)
- Configuring auxiliary development services
- Local development with full tooling stack

**Contains**:

- Tool admin credentials
- NextAuth secrets
- Encryption keys
- Database credentials for Langfuse
- ClickHouse configuration

### Application-Specific Environment Files

#### Portal Application (`apps/portal/`)

##### `env/.env.example` (4.1KB)

**Purpose**: Template for portal application development environment

**When to use**:

- Setting up portal development environment
- Portal-specific configuration needs
- Understanding portal-specific environment variables

**Contains**:

- External tools configuration (N8N, Flowise, FUXA)
- Supabase configuration (URLs, keys)
- Google AI configuration (Project ID, API key)
- Redis configuration for caching and rate limiting
- Sentry configuration for error monitoring
- OpenTelemetry configuration (optional)

Copy command:

```bash
cp apps/portal/env/.env.example apps/portal/.env
```

##### `.env` (5.6KB) ⚠️ NEVER COMMIT

**Purpose**: Actual portal environment configuration with real secrets

**When to use**:

- Local portal development
- Portal-specific debugging
- Portal deployment configuration

##### `env/.env.production.example` (3.8KB)

**Purpose**: Template for portal production environment

**When to use**:

- Deploying portal to production
- Understanding production configuration requirements
- Setting up staging or production environments

**Contains**: Production-specific configuration with security-focused defaults

##### `env/.env.portal.compose.example` (972B)

**Purpose**: Template for portal Docker Compose deployment

**When to use**:

- Running portal with Docker Compose
- Container-based deployment
- Understanding Docker environment requirements

### Tool-Specific Environment Files

#### Evaluation Package (`packages/eval/`)

##### `.env` (348B) ⚠️ NEVER COMMIT

**Purpose**: Evaluation package environment for AI testing (DeepEval)

**When to use**:

- Running AI evaluation tests
- DeepEval configuration
- AI compliance testing environment

## 🌳 Usage Decision Tree

### 1. Local Development (Portal Focus)

```
Start → Copy apps/portal/env/.env.example to apps/portal/.env
      → Fill in Supabase credentials (local: http://127.0.0.1:54321)
      → Add tool URLs if using external tools
      → Set Redis URL for caching
      → (Optional) Configure Sentry for error tracking
```

### 2. Local Development (Full Stack with Docker Tools)

```
Start → Copy .env.example to .env
      → Copy .env.tools to actual .env.tools or use as reference
      → Fill in all Supabase credentials
      → Configure all tool credentials (Flowise, etc.)
      → Start Docker tools: docker-compose.tools.yml up -d
      → Use root .env for main application
```

### 3. Docker Compose Development

```
Start → Use apps/portal/env/.env.portal.compose.example as template
      → Configure for containerized deployment
      → Set up networking between containers
      → Configure volume mounts for persistence
      → Start: docker-compose up -d
```

### 4. Production Deployment

```
Start → Copy apps/portal/env/.env.production.example to .env.production
      → Fill in production Supabase credentials
      → Configure production URLs (not localhost)
      → Set up production Sentry DSN
      → Configure production monitoring
      → Use strong, unique secrets
      → Enable rate limiting and security features
```

### 5. CI/CD Environment

```
Start → Use synthetic values from GitHub Secrets
      → Never commit actual secrets
      → Configure environment variables in GitHub Actions
      → Use different secrets for each environment
      → Rotate secrets regularly
```

## 🔧 Configuration Priorities

### High Priority (Required for Basic Functionality)

- **Supabase Configuration**: URL, anon key, service role key
- **Database URLs**: Direct database connection and pooler URLs
- **Basic Auth**: User credentials for Supabase and tools

### Medium Priority (Required for Full Features)

- **Google AI Configuration**: API key for Gemini model access
- **Redis Configuration**: URL for caching and rate limiting
- **Monitoring**: Sentry DSN for error tracking
- **Tools Configuration**: Flowise, FUXA for extended features

### Low Priority (Optional/Development)

- **Observability**: OpenTelemetry endpoint for detailed monitoring
- **Notifications**: Novu, Inngest for event handling
- **Advanced Features**: Langfuse, Qdrant for AI experimentation
- **Build Options**: Skip type check, enable heavy plugins (development only)

## 🚨 Common Issues and Solutions

### Issue: "Database connection failed"

**Solution**: Check Supabase is running, verify DATABASE_URL and credentials in .env

### Issue: "Rate limiting errors"

**Solution**: Configure REDIS_URL, or set DISABLE_RATE_LIMIT=true for development

### Issue: "Docker tools can't connect"

**Solution**: Check .env.tools configuration, ensure Docker network is accessible

### Issue: "Production deployment fails"

**Solution**: Use apps/portal/env/.env.production.example, ensure all production URLs are set (not localhost)

## 📝 Environment Variable Reference

### Supabase Variables

- `NEXT_PUBLIC_SUPABASE_URL`: Client-accessible Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Client-accessible anon key (safe for browser)
- `SUPABASE_URL`: Server-side Supabase URL
- `SUPABASE_ANON_KEY`: Server-side anon key
- `SUPABASE_SERVICE_KEY`: Server-side service role key (NEVER expose to client)
- `DATABASE_URL`: Direct PostgreSQL connection string
- `DATABASE_POOLER_URL`: Connection pooler URL (production recommended)
- `SUPABASE_READ_REPLICA_URL`: Read replica URL (optional, for performance)

### AI/LLM Variables

- `GOOGLE_PROJECT_ID`: Google Cloud project ID for Gemini API access
- `GOOGLE_AI_API_KEY`: Google AI API key for LLM services

### Monitoring Variables

- `SENTRY_DSN`: Server-side Sentry DSN
- `NEXT_PUBLIC_SENTRY_DSN`: Client-side Sentry DSN
- `OTEL_EXPORTER_OTLP_ENDPOINT`: OpenTelemetry endpoint
- `OTEL_SERVICE_NAME`: Service name for observability

### Tool Variables

- `N8N_URL`: n8n workflow automation URL
- `N8N_USER`: n8n username
- `N8N_PASSWORD`: n8n password
- `FLOWISE_URL`: Flowise AI workflow builder URL
- `FLOWISE_USER`: Flowise username
- `FLOWISE_PASSWORD`: Flowise password
- `NEXT_PUBLIC_FUXA_URL`: FUXA SCADA/HMI dashboard URL
- `ALLOWED_SCANNER_SOURCES`: Comma-separated allowed scanner source header values

## 🔍 Validation Checklist

Before committing or deploying:

- [ ] Verify no actual .env files are committed (check git status)
- [ ] Ensure .env.example files are up to date with current variables
- [ ] Test that application starts with example configuration
- [ ] Verify all required variables are documented
- [ ] Check that sensitive variables are marked as "NEVER COMMIT"
- [ ] Validate environment variable naming conventions
- [ ] Test production configuration before actual production deployment

---

**Last Updated**: 2026-09-21
**Maintained by**: Arch-Systems Development Team
