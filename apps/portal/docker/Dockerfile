# Portal Dockerfile — Turbo-pruned, cache-mounted, standalone-output build
# Four stages: pruner → deps → builder → production

# ── Stage 1: pruner ──────────────────────────────────────
# Generates a filtered workspace with only the packages portal depends on
FROM node:22-alpine AS pruner
RUN apk add --no-cache libc6-compat && \
    npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune --scope=portal --docker

# ── Stage 2: deps ──────────────────────────────────────
# Installs dependencies from the pruned lockfile with pnpm store cache mount
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++ bash && \
    npm install -g pnpm@9.15.9
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml .
# Advisor Note: Explicitly copying libs/ and scripts/ ensures monorepo shared packages and build scripts are available during the dependency installation step.
COPY libs ./libs
COPY scripts ./scripts
RUN --mount=type=cache,target=/pnpm-store \
    pnpm install --no-frozen-lockfile --prefer-offline --ignore-scripts
RUN node scripts/patch-glass-css.mjs

# ── Stage 3: builder ───────────────────────────────────
# Copies pruned source + installed node_modules, then builds with Next.js cache mount
FROM deps AS builder
COPY --from=pruner /app/out/full/ .
# Advisor Note: Similarly, copying libs/ and scripts/ into the builder stage is required because the pruned output might not include everything necessary to run custom build scripts or resolve all local workspace dependencies properly.
COPY scripts ./scripts
COPY libs ./libs
ENV NODE_ENV=production
ARG CI=true
ENV CI=${CI}
# Build-time env vars (Next.js embeds these in the standalone output)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID
ARG NEXT_PUBLIC_FUXA_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_VERCEL_ENV
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_AUTH_TOKEN
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID=${NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID}
ENV NEXT_PUBLIC_FUXA_URL=${NEXT_PUBLIC_FUXA_URL}
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV NEXT_PUBLIC_VERCEL_ENV=${NEXT_PUBLIC_VERCEL_ENV}
ENV SENTRY_ORG=${SENTRY_ORG}
ENV SENTRY_PROJECT=${SENTRY_PROJECT}
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
RUN --mount=type=cache,target=/app/apps/portal/.next/cache \
    SKIP_TYPE_CHECK=true pnpm --filter portal build

# ── Stage 4: production ──────────────────────────────────
# Distroless image with only the standalone output and static assets
FROM gcr.io/distroless/nodejs22-debian12 AS production
WORKDIR /app
COPY --from=builder /app/apps/portal/public ./public
COPY --from=builder /app/apps/portal/.next/standalone ./
COPY --from=builder /app/apps/portal/.next/static ./.next/static
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
USER 65532
EXPOSE 3000
CMD ["server.js"]