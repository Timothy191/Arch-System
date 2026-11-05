# Portal Dockerfile — Turborepo v2 pruned, BuildKit cache-mounted, standalone-output build
# Four stages: pruner → deps → builder → production

# ── Stage 1: pruner ──────────────────────────────────────
# Generates a filtered workspace with only the packages portal depends on
FROM node:24-alpine AS pruner
# hadolint ignore=DL3018
RUN apk add --no-cache libc6-compat && \
    npm install -g turbo@2.5.4
WORKDIR /app
COPY . .
RUN turbo prune portal --docker && \
    cp -r scripts out/json/ && \
    cp -r scripts out/full/ && \
    cp tsconfig.json out/full/

# ── Stage 2: deps ──────────────────────────────────────
# Installs dependencies from the pruned lockfile with pnpm store BuildKit cache mount
FROM node:24-alpine AS deps
# hadolint ignore=DL3018
RUN apk add --no-cache libc6-compat python3 make g++ && \
    npm install -g pnpm@9.15.9
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --no-frozen-lockfile --prefer-offline --config.store-dir=/pnpm/store

# ── Stage 3: builder ───────────────────────────────────
# Copies pruned source + installed node_modules, then builds via Turborepo with cache mounts
FROM deps AS builder
COPY --from=pruner /app/out/full/ .
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ARG CI=true
ENV CI=${CI}
# Optional Turborepo Remote Cache credentials
ARG TURBO_TEAM
ARG TURBO_TOKEN
ENV TURBO_TEAM=${TURBO_TEAM}
ENV TURBO_TOKEN=${TURBO_TOKEN}
# Build-time env vars (Next.js embeds NEXT_PUBLIC_* in the client bundle)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_VERCEL_ENV
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_AUTH_TOKEN
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID=${NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID}
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV NEXT_PUBLIC_VERCEL_ENV=${NEXT_PUBLIC_VERCEL_ENV}
ENV SENTRY_ORG=${SENTRY_ORG}
ENV SENTRY_PROJECT=${SENTRY_PROJECT}
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
RUN --mount=type=cache,id=turbo,target=/app/.turbo/cache \
    --mount=type=cache,id=nextjs,target=/app/apps/portal/.next/cache \
    SKIP_TYPE_CHECK=true pnpm turbo run build --filter=portal...

# ── Stage 4: production ──────────────────────────────────
# Distroless Node 24 image with only the standalone output and static/public assets
FROM gcr.io/distroless/nodejs24-debian12 AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/apps/portal/.next/standalone ./
COPY --from=builder /app/apps/portal/.next/static ./apps/portal/.next/static
COPY --from=builder /app/apps/portal/public ./apps/portal/public
USER 65532
EXPOSE 3000
CMD ["apps/portal/server.js"]
