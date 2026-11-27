#!/usr/bin/env bash
set -euo pipefail

# Arch-System Automated Idempotent Docker Swarm Deployment Script
# Orchestrates environment validation, Swarm/network/secret preflight,
# stack config verification, rolling deployment, convergence polling,
# automated failure recovery/rollback, and post-deployment health probes.

readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

STACK_NAME="${STACK_NAME:-arch-system}"
STACK_FILE="${STACK_FILE:-$SCRIPT_DIR/stack.arch-system.yml}"
ENV_FILE="${ENV_FILE:-}"
CONVERGE_TIMEOUT="${CONVERGE_TIMEOUT:-180}"
POLL_INTERVAL="${POLL_INTERVAL:-5}"
LOCAL_IMAGE=false
RESOLVE_IMAGE="${RESOLVE_IMAGE:-always}"
CADDY_HTTP_PORT="${CADDY_HTTP_PORT:-8080}"
CADDY_HTTPS_PORT="${CADDY_HTTPS_PORT:-8443}"
PROBE_URL="${PROBE_URL:-}"
SKIP_PROBES=false
DRY_RUN=false
VALIDATE_ONLY=false

readonly REQUIRED_SECRETS=(
  "arch_supabase_service_key"
  "arch_database_url"
  "arch_redis_password"
  "arch_cron_secret"
  "arch_webhook_secret"
)

readonly DEPLOY_SERVICES=(
  "redis"
  "portal"
  "caddy"
)

ts() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

info() {
  printf '[%s] [INFO] %s\n' "$(ts)" "$*"
}

warn() {
  printf '[%s] [WARN] %s\n' "$(ts)" "$*" >&2
}

error() {
  printf '[%s] [ERROR] %s\n' "$(ts)" "$*" >&2
}

dry_run() {
  printf '[%s] [DRY-RUN] %s\n' "$(ts)" "$*"
}

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS]

Automated, idempotent Docker Swarm deployment for Arch-System.

Options:
  --stack-name <name>      Swarm stack name (default: arch-system)
  --stack-file <path>      Path to Swarm stack YAML (default: infra/docker/swarm/stack.arch-system.yml)
  --env-file <path>        Optional non-secret env file to source before validation
  --timeout <seconds>      Service convergence timeout in seconds (default: 180)
  --poll-interval <sec>    Convergence polling interval in seconds (default: 5)
  --probe-url <url>        Post-deploy health probe URL (default: http://127.0.0.1:<http-port>/api/health)
  --http-port <port>       Public Caddy HTTP port (default: 8080)
  --https-port <port>      Public Caddy HTTPS port (default: 8443)
  --local-image            Use local image without registry pull (--resolve-image never)
  --resolve-image <mode>   Swarm resolve-image mode: always, never, changed (default: always)
  --skip-probes            Skip post-deployment HTTP health probes
  --dry-run                Validate config and print planned actions without mutating Swarm
  --validate-only          Run environment, preflight, and stack config validation only
  -h, --help               Show this help message and exit
EOF
}

cleanup() {
  local exit_code=$?
  if [ "$exit_code" -ne 0 ]; then
    error "Deployment script exited with code $exit_code"
  fi
}

trap cleanup EXIT

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --stack-name)
        [ "$#" -ge 2 ] || { error "--stack-name requires a value"; exit 2; }
        STACK_NAME="$2"
        shift 2
        ;;
      --stack-file)
        [ "$#" -ge 2 ] || { error "--stack-file requires a value"; exit 2; }
        STACK_FILE="$2"
        shift 2
        ;;
      --env-file)
        [ "$#" -ge 2 ] || { error "--env-file requires a value"; exit 2; }
        ENV_FILE="$2"
        shift 2
        ;;
      --timeout)
        [ "$#" -ge 2 ] || { error "--timeout requires a value"; exit 2; }
        CONVERGE_TIMEOUT="$2"
        shift 2
        ;;
      --poll-interval)
        [ "$#" -ge 2 ] || { error "--poll-interval requires a value"; exit 2; }
        POLL_INTERVAL="$2"
        shift 2
        ;;
      --probe-url)
        [ "$#" -ge 2 ] || { error "--probe-url requires a value"; exit 2; }
        PROBE_URL="$2"
        shift 2
        ;;
      --http-port)
        [ "$#" -ge 2 ] || { error "--http-port requires a value"; exit 2; }
        CADDY_HTTP_PORT="$2"
        shift 2
        ;;
      --https-port)
        [ "$#" -ge 2 ] || { error "--https-port requires a value"; exit 2; }
        CADDY_HTTPS_PORT="$2"
        shift 2
        ;;
      --local-image)
        LOCAL_IMAGE=true
        RESOLVE_IMAGE="never"
        shift
        ;;
      --resolve-image)
        [ "$#" -ge 2 ] || { error "--resolve-image requires a value (always|never|changed)"; exit 2; }
        RESOLVE_IMAGE="$2"
        shift 2
        ;;
      --skip-probes)
        SKIP_PROBES=true
        shift
        ;;
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      --validate-only)
        VALIDATE_ONLY=true
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        error "Unknown argument: $1"
        usage >&2
        exit 2
        ;;
    esac
  done
}

require_positive_int() {
  local name="$1"
  local value="$2"
  if ! [[ "$value" =~ ^[1-9][0-9]*$ ]]; then
    error "$name must be a positive integer (got: '$value')"
    exit 2
  fi
}

validate_environment() {
  info "Phase 1: Validating environment and prerequisites..."

  if ! command -v docker >/dev/null 2>&1; then
    error "docker CLI not found in PATH"
    exit 1
  fi

  require_positive_int "--timeout" "$CONVERGE_TIMEOUT"
  require_positive_int "--poll-interval" "$POLL_INTERVAL"
  require_positive_int "--http-port" "$CADDY_HTTP_PORT"
  require_positive_int "--https-port" "$CADDY_HTTPS_PORT"

  if [ -z "$PROBE_URL" ]; then
    PROBE_URL="http://127.0.0.1:${CADDY_HTTP_PORT}/api/health"
  fi
  export CADDY_HTTP_PORT CADDY_HTTPS_PORT

  if [ ! -f "$STACK_FILE" ]; then
    error "Stack file not found: $STACK_FILE"
    exit 1
  fi

  local caddyfile_path
  caddyfile_path="$(cd "$(dirname "$STACK_FILE")" && pwd)/../Caddyfile"
  if [ ! -f "$caddyfile_path" ]; then
    error "Required Caddyfile not found: $caddyfile_path"
    exit 1
  fi

  if [ -n "$ENV_FILE" ]; then
    if [ ! -f "$ENV_FILE" ]; then
      error "Specified --env-file does not exist: $ENV_FILE"
      exit 1
    fi
    info "Loading non-secret environment variables from $ENV_FILE"
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
  fi

  if [ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ]; then
    if [ "$DRY_RUN" = true ] || [ "$VALIDATE_ONLY" = true ]; then
      export NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.invalid"
      warn "NEXT_PUBLIC_SUPABASE_URL not set; using synthetic placeholder for dry-run/validation"
    else
      error "NEXT_PUBLIC_SUPABASE_URL is required for production Swarm deployment"
      exit 1
    fi
  fi

  if [ -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]; then
    if [ "$DRY_RUN" = true ] || [ "$VALIDATE_ONLY" = true ]; then
      export NEXT_PUBLIC_SUPABASE_ANON_KEY="dry-run-placeholder-key"
      warn "NEXT_PUBLIC_SUPABASE_ANON_KEY not set; using synthetic placeholder for dry-run/validation"
    else
      error "NEXT_PUBLIC_SUPABASE_ANON_KEY is required for production Swarm deployment"
      exit 1
    fi
  fi

  info "Environment validation passed"
}

preflight_swarm() {
  info "Phase 2: Running Docker Swarm, network, and external secret preflight..."

  local swarm_raw
  if ! swarm_raw="$(docker info --format '{{.Swarm.LocalNodeState}}|{{.Swarm.ControlAvailable}}' 2>/dev/null)"; then
    if [ "$DRY_RUN" = true ] || [ "$VALIDATE_ONLY" = true ]; then
      warn "Docker daemon unreachable during dry-run/validation; skipping live Swarm inspection"
      return 0
    fi
    error "Unable to query Docker daemon via 'docker info'"
    exit 1
  fi

  local node_state="${swarm_raw%%|*}"
  local control_avail="${swarm_raw##*|}"

  if [ "$node_state" != "active" ] || [ "$control_avail" != "true" ]; then
    if [ "$DRY_RUN" = true ] || [ "$VALIDATE_ONLY" = true ]; then
      warn "Local Swarm is not an active manager (LocalNodeState=${node_state:-unknown}, ControlAvailable=${control_avail:-unknown}); continuing in dry-run/validation mode"
      return 0
    fi
    error "Docker Swarm manager is required (LocalNodeState=${node_state:-unknown}, ControlAvailable=${control_avail:-unknown})"
    error "Remediation: run 'docker swarm init' on manager node and provision external secrets before deploying"
    exit 1
  fi

  local existing_secrets
  existing_secrets="$(docker secret ls --format '{{.Name}}')"
  local missing_secrets=()
  local secret_name
  for secret_name in "${REQUIRED_SECRETS[@]}"; do
    if ! printf '%s\n' "$existing_secrets" | grep -Fxq "$secret_name"; then
      missing_secrets+=("$secret_name")
    fi
  done

  if [ "${#missing_secrets[@]}" -gt 0 ]; then
    if [ "$DRY_RUN" = true ] || [ "$VALIDATE_ONLY" = true ]; then
      warn "Missing external Swarm secrets (non-blocking in dry-run/validation): ${missing_secrets[*]}"
    else
      error "Missing required external Docker Swarm secrets: ${missing_secrets[*]}"
      error "Create each secret via: printf '<value>' | docker secret create <name> -"
      exit 1
    fi
  else
    info "All ${#REQUIRED_SECRETS[@]} external Docker secrets verified"
  fi

  local existing_nets
  existing_nets="$(docker network ls --format '{{.Name}}')"
  for net_name in "${STACK_NAME}_arch_internal" "${STACK_NAME}_arch_public"; do
    if printf '%s\n' "$existing_nets" | grep -Fxq "$net_name"; then
      info "Overlay network already present: $net_name"
    else
      info "Overlay network will be reconciled on deploy: $net_name"
    fi
  done
}

validate_stack_config() {
  info "Phase 3: Validating Swarm stack manifest ($STACK_FILE)..."

  if grep -Eq '(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.)' "$STACK_FILE"; then
    error "Potential hardcoded secret detected in $STACK_FILE"
    exit 1
  fi

  if ! docker stack config -c "$STACK_FILE" >/dev/null; then
    error "docker stack config validation failed for $STACK_FILE"
    exit 1
  fi

  info "Stack manifest validated cleanly via 'docker stack config'"
}

capture_diagnostics() {
  local service_name="$1"
  local diag_dir="${REPO_ROOT}/.ci-local/swarm-diagnostics-$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$diag_dir"

  warn "Capturing Swarm diagnostics for $service_name into $diag_dir"
  docker service ps --no-trunc "$service_name" >"$diag_dir/${service_name}.ps.txt" 2>&1 || true
  docker service logs --tail 80 --timestamps "$service_name" >"$diag_dir/${service_name}.logs.txt" 2>&1 || true
}

recover_and_rollback() {
  local failed_service="$1"
  error "Failure detected on service '$failed_service'; initiating automated recovery..."

  capture_diagnostics "$failed_service"

  local prev_spec
  prev_spec="$(docker service inspect --format '{{if .PreviousSpec}}yes{{else}}no{{end}}' "$failed_service" 2>/dev/null || echo "no")"
  if [ "$prev_spec" = "yes" ]; then
    warn "Rolling back service '$failed_service' to PreviousSpec..."
    if docker service rollback --detach=false "$failed_service"; then
      info "Rollback completed for '$failed_service'"
    else
      error "Automated rollback failed for '$failed_service'; manual intervention required"
    fi
  else
    warn "No PreviousSpec found for '$failed_service' (initial deploy); skipping docker service rollback"
  fi

  exit 1
}

deploy_stack() {
  info "Phase 4: Deploying Swarm stack '$STACK_NAME'..."

  local deploy_cmd=(docker stack deploy --prune)
  if [ "$LOCAL_IMAGE" = true ] || [ "$RESOLVE_IMAGE" = "never" ]; then
    deploy_cmd+=(--resolve-image never)
  else
    deploy_cmd+=(--with-registry-auth --resolve-image "$RESOLVE_IMAGE")
  fi
  deploy_cmd+=(-c "$STACK_FILE" "$STACK_NAME")

  if [ "$DRY_RUN" = true ]; then
    dry_run "Would execute: ${deploy_cmd[*]}"
    dry_run "Would poll convergence for services: ${DEPLOY_SERVICES[*]} (timeout=${CONVERGE_TIMEOUT}s, interval=${POLL_INTERVAL}s)"
    if [ "$SKIP_PROBES" = false ]; then
      dry_run "Would execute post-deployment health probe against $PROBE_URL"
    else
      dry_run "Would skip post-deployment health probes (--skip-probes)"
    fi
    dry_run "Would capture diagnostics and invoke 'docker service rollback' on convergence or probe failure"
    return 0
  fi

  "${deploy_cmd[@]}"

  info "Stack deploy submitted for '$STACK_NAME'"
}

wait_for_convergence() {
  info "Phase 5: Polling Swarm service convergence (timeout=${CONVERGE_TIMEOUT}s)..."

  if [ "$DRY_RUN" = true ]; then
    dry_run "Convergence polling skipped in --dry-run mode"
    return 0
  fi

  local deadline=$(( $(date +%s) + CONVERGE_TIMEOUT ))
  local svc full_svc replicas running desired update_state

  for svc in "${DEPLOY_SERVICES[@]}"; do
    full_svc="${STACK_NAME}_${svc}"
    info "Waiting for service '$full_svc' to converge..."

    while true; do
      replicas="$(docker service ls --filter "name=^${full_svc}$" --format '{{.Replicas}}' | head -n1 || true)"
      update_state="$(docker service inspect --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{else}}none{{end}}' "$full_svc" 2>/dev/null || echo "unknown")"

      if [[ "$update_state" == rollback_* ]] || [ "$update_state" = "paused" ]; then
        error "Service '$full_svc' entered failure update state: $update_state"
        recover_and_rollback "$full_svc"
      fi

      if [[ "$replicas" =~ ^([0-9]+)/([0-9]+)$ ]]; then
        running="${BASH_REMATCH[1]}"
        desired="${BASH_REMATCH[2]}"
        if [ "$desired" -gt 0 ] && [ "$running" -eq "$desired" ] && [ "$update_state" != "updating" ]; then
          info "Service '$full_svc' converged (${running}/${desired}, update_state=${update_state})"
          break
        fi
      fi

      if [ "$(date +%s)" -ge "$deadline" ]; then
        error "Timed out waiting for '$full_svc' to converge (replicas=${replicas:-unknown}, update_state=${update_state})"
        recover_and_rollback "$full_svc"
      fi

      sleep "$POLL_INTERVAL"
    done
  done

  info "All Swarm services converged cleanly"
}

run_post_deploy_probes() {
  if [ "$SKIP_PROBES" = true ]; then
    info "Phase 6: Post-deployment probes skipped (--skip-probes)"
    return 0
  fi

  info "Phase 6: Running post-deployment verification probe against $PROBE_URL..."

  if [ "$DRY_RUN" = true ]; then
    dry_run "Health probe skipped in --dry-run mode (target: $PROBE_URL)"
    return 0
  fi

  local attempts=0
  local max_attempts=12
  local body=""

  while [ "$attempts" -lt "$max_attempts" ]; do
    if body="$(curl -fsS --max-time 5 "$PROBE_URL" 2>/dev/null)"; then
      if printf '%s' "$body" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"(healthy|degraded)"'; then
        info "Post-deployment health probe succeeded ($PROBE_URL)"
        return 0
      fi
    fi
    attempts=$((attempts + 1))
    sleep 5
  done

  error "Post-deployment health probe failed after $max_attempts attempts ($PROBE_URL)"
  recover_and_rollback "${STACK_NAME}_portal"
}

main() {
  parse_args "$@"
  validate_environment
  preflight_swarm
  validate_stack_config

  if [ "$VALIDATE_ONLY" = true ]; then
    info "Validation-only mode complete; no Swarm changes applied"
    exit 0
  fi

  deploy_stack
  wait_for_convergence
  run_post_deploy_probes

  info "Docker Swarm deployment workflow completed successfully for stack '$STACK_NAME'"
}

main "$@"
