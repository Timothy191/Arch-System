#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Secrets Management Helper for Arch-Systems
# PURPOSE: Manage secrets via environment files, Docker secrets, or external vaults
# USAGE: ./scripts/secrets.sh [init|encrypt|decrypt|rotate|export]
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
SECRETS_DIR="$REPO_ROOT/.secrets"
VAULT_DIR="$SECRETS_DIR/vault"
ENCRYPTED_DIR="$SECRETS_DIR/encrypted"
BACKUP_DIR="$SECRETS_DIR/backups"

# Configuration
ENCRYPTION_KEY="${ARCH_SECRETS_KEY:-}"
VAULT_PROVIDER="${VAULT_PROVIDER:-file}"  # file, aws, hashicorp

# AWS Secrets Manager
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_SECRET_PREFIX="${AWS_SECRET_PREFIX:-arch-systems/}"

# HashiCorp Vault
VAULT_ADDR="${VAULT_ADDR:-}"
VAULT_TOKEN="${VAULT_TOKEN:-}"
VAULT_PATH="${VAULT_PATH:-secret/arch-systems}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[SECRETS]${NC} $*"; }
info() { echo -e "${CYAN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Setup ────────────────────────────────────────────────────────────────────
setup_directories() {
    mkdir -p "$VAULT_DIR" "$ENCRYPTED_DIR" "$BACKUP_DIR"
    chmod 700 "$SECRETS_DIR" "$VAULT_DIR"
}

check_encryption_key() {
    if [ -z "$ENCRYPTION_KEY" ]; then
        if [ -f "$SECRETS_DIR/.encryption-key" ]; then
            ENCRYPTION_KEY=$(cat "$SECRETS_DIR/.encryption-key")
            export ENCRYPTION_KEY
        else
            error "No encryption key found. Set ARCH_SECRETS_KEY or run: $0 init"
            exit 1
        fi
    fi
}

# ── Initialize ───────────────────────────────────────────────────────────────
init_vault() {
    log "Initializing secrets vault..."

    setup_directories

    # Generate encryption key if not provided
    if [ -z "$ENCRYPTION_KEY" ]; then
        log "Generating new encryption key..."
        ENCRYPTION_KEY=$(openssl rand -base64 32)
        echo "$ENCRYPTION_KEY" > "$SECRETS_DIR/.encryption-key"
        chmod 600 "$SECRETS_DIR/.encryption-key"
        log "Encryption key saved to: $SECRETS_DIR/.encryption-key"
        log "IMPORTANT: Back up this key securely. Without it, encrypted secrets cannot be recovered."
    fi

    # Create template .env.vault file
    if [ ! -f "$REPO_ROOT/.env.vault" ]; then
        cat > "$REPO_ROOT/.env.vault" << 'EOF'
# Arch-Systems Vault Configuration
# Copy to .env.vault.local and fill in values
# DO NOT COMMIT .env.vault.local TO GIT

# Provider: file, aws, hashicorp
VAULT_PROVIDER=file

# File-based vault (default)
# Encryption key stored in ARCH_SECRETS_KEY env var

# AWS Secrets Manager
# AWS_REGION=us-east-1
# AWS_SECRET_PREFIX=arch-systems/

# HashiCorp Vault
# VAULT_ADDR=https://vault.example.com
# VAULT_TOKEN=hvs.xxxxx
# VAULT_PATH=secret/arch-systems

# Database
# POSTGRES_PASSWORD=
# SUPABASE_SERVICE_KEY=
# REDIS_PASSWORD=

# API Keys
# SENTRY_DSN=
# GROQ_API_KEY=
# NOVU_API_KEY=

# Encryption
# N8N_ENCRYPTION_KEY=
# JWT_SECRET=
EOF
        log "Created template: $REPO_ROOT/.env.vault"
    fi

    # Add to .gitignore
    if ! grep -q "\.env\.vault\.local" "$REPO_ROOT/.gitignore" 2>/dev/null; then
        cat >> "$REPO_ROOT/.gitignore" << 'EOF'

# Secrets
.env.vault.local
.secrets/
!.secrets/README.md
EOF
        log "Updated .gitignore"
    fi

    # Create README
    cat > "$SECRETS_DIR/README.md" << 'EOF'
# Arch-Systems Secrets Vault

## Security

- Encryption key stored in `ARCH_SECRETS_KEY` environment variable
- All secrets encrypted at rest using AES-256-GCM
- File permissions restricted to owner only (chmod 600)

## Usage

```bash
# Initialize (one-time)
./scripts/secrets.sh init

# Set a secret
./scripts/secrets.sh set KEY_NAME value

# Get a secret
./scripts/secrets.sh get KEY_NAME

# Export to environment
source <(./scripts/secrets.sh export)

# Rotate encryption key
./scripts/secrets.sh rotate-key
```

## Providers

### File-based (default)
Secrets stored encrypted in `.secrets/vault/`

### AWS Secrets Manager
```bash
export VAULT_PROVIDER=aws
export AWS_REGION=us-east-1
export AWS_SECRET_PREFIX=arch-systems/
```

### HashiCorp Vault
```bash
export VAULT_PROVIDER=hashicorp
export VAULT_ADDR=https://vault.example.com
export VAULT_TOKEN=hvs.xxxxx
export VAULT_PATH=secret/arch-systems
```
EOF

    log "Vault initialized successfully"
}

# ── Encryption Helpers ───────────────────────────────────────────────────────
encrypt_value() {
    local value="$1"
    check_encryption_key
    echo -n "$value" | openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt -pass "pass:$ENCRYPTION_KEY" -base64 -A
}

decrypt_value() {
    local encrypted="$1"
    check_encryption_key
    echo -n "$encrypted" | openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -d -pass "pass:$ENCRYPTION_KEY" -base64 -A
}

# ── Secret Operations ────────────────────────────────────────────────────────
set_secret() {
    local key="$1"
    local value="$2"
    local vault_file="$VAULT_DIR/$key.enc"

    log "Setting secret: $key"

    local encrypted
    encrypted=$(encrypt_value "$value")

    echo "$encrypted" > "$vault_file"
    chmod 600 "$vault_file"

    log "Secret stored: $vault_file"
}

get_secret() {
    local key="$1"
    local vault_file="$VAULT_DIR/$key.enc"

    if [ ! -f "$vault_file" ]; then
        error "Secret not found: $key"
        exit 1
    fi

    local encrypted
    encrypted=$(cat "$vault_file")

    decrypt_value "$encrypted"
}

list_secrets() {
    log "Available secrets:"
    echo

    if [ -d "$VAULT_DIR" ]; then
        for file in "$VAULT_DIR"/*.enc; do
            if [ -f "$file" ]; then
                local key
                key=$(basename "$file" .enc)
                echo "  - $key"
            fi
        done
    else
        echo "  No secrets found"
    fi
}

delete_secret() {
    local key="$1"
    local vault_file="$VAULT_DIR/$key.enc"

    if [ ! -f "$vault_file" ]; then
        error "Secret not found: $key"
        exit 1
    fi

    rm -f "$vault_file"
    log "Secret deleted: $key"
}

# ── Export ───────────────────────────────────────────────────────────────────
export_secrets() {
    log "Exporting secrets as environment variables..."

    if [ ! -d "$VAULT_DIR" ] || [ -z "$(ls -A "$VAULT_DIR" 2>/dev/null)" ]; then
        warn "No secrets found"
        return 0
    fi

    for file in "$VAULT_DIR"/*.enc; do
        if [ -f "$file" ]; then
            local key
            key=$(basename "$file" .enc)
            local value
            value=$(get_secret "$key")
            echo "export $key='$value'"
        fi
    done
}

# ── AWS Secrets Manager Integration ──────────────────────────────────────────
aws_sync_to_remote() {
    log "Syncing secrets to AWS Secrets Manager..."

    if ! command -v aws &> /dev/null; then
        error "AWS CLI not found. Install with: brew install awscli"
        exit 1
    fi

    for file in "$VAULT_DIR"/*.enc; do
        if [ -f "$file" ]; then
            local key
            key=$(basename "$file" .enc)
            local secret_name="${AWS_SECRET_PREFIX}${key}"
            local secret_string
            secret_string=$(cat "$file")

            aws secretsmanager create-secret \
                --name "$secret_name" \
                --secret-string "$secret_string" \
                --region "$AWS_REGION" \
                --description "Arch-Systems secret: $key" \
                2>/dev/null || aws secretsmanager update-secret \
                --secret-id "$secret_name" \
                --secret-string "$secret_string" \
                --region "$AWS_REGION"

            log "Synced: $secret_name"
        fi
    done
}

aws_sync_from_remote() {
    log "Syncing secrets from AWS Secrets Manager..."

    if ! command -v aws &> /dev/null; then
        error "AWS CLI not found"
        exit 1
    fi

    local secret_names
    secret_names=$(aws secretsmanager list-secrets \
        --filters "Key=name,Values=${AWS_SECRET_PREFIX}" \
        --query 'SecretList[*].Name' \
        --output text \
        --region "$AWS_REGION")

    for secret_name in $secret_names; do
        local key
        key=${secret_name#$AWS_SECRET_PREFIX}
        local secret_string
        secret_string=$(aws secretsmanager get-secret-value \
            --secret-id "$secret_name" \
            --query 'SecretString' \
            --output text \
            --region "$AWS_REGION")

        echo "$secret_string" > "$VAULT_DIR/$key.enc"
        chmod 600 "$VAULT_DIR/$key.enc"
        log "Synced: $key"
    done
}

# ── HashiCorp Vault Integration ──────────────────────────────────────────────
vault_sync_to_remote() {
    log "Syncing secrets to HashiCorp Vault..."

    if [ -z "$VAULT_ADDR" ] || [ -z "$VAULT_TOKEN" ]; then
        error "VAULT_ADDR and VAULT_TOKEN must be set"
        exit 1
    fi

    if ! command -v vault &> /dev/null; then
        error "Vault CLI not found. Install from: https://developer.hashicorp.com/vault/install"
        exit 1
    fi

    export VAULT_TOKEN
    export VAULT_ADDR

    for file in "$VAULT_DIR"/*.enc; do
        if [ -f "$file" ]; then
            local key
            key=$(basename "$file" .enc)
            local secret_string
            secret_string=$(cat "$file")

            vault kv put -mount="${VAULT_PATH%/*}" "${VAULT_PATH##*/}/$key" \
                encrypted="$secret_string"

            log "Synced: $key"
        fi
    done
}

vault_sync_from_remote() {
    log "Syncing secrets from HashiCorp Vault..."

    if [ -z "$VAULT_ADDR" ] || [ -z "$VAULT_TOKEN" ]; then
        error "VAULT_ADDR and VAULT_TOKEN must be set"
        exit 1
    fi

    export VAULT_TOKEN
    export VAULT_ADDR

    local keys
    keys=$(vault kv list -mount="${VAULT_PATH%/*}" "${VAULT_PATH##*/}" 2>/dev/null | tail -n +2)

    for key in $keys; do
        local secret_data
        secret_data=$(vault kv get -mount="${VAULT_PATH%/*}" -format=json "${VAULT_PATH##*/}/$key")
        local secret_string
        secret_string=$(echo "$secret_data" | jq -r '.data.data.encrypted')

        echo "$secret_string" > "$VAULT_DIR/$key.enc"
        chmod 600 "$VAULT_DIR/$key.enc"
        log "Synced: $key"
    done
}

# ── Key Rotation ─────────────────────────────────────────────────────────────
rotate_encryption_key() {
    log "Rotating encryption key..."

    check_encryption_key

    # Backup current vault
    local backup_file="$BACKUP_DIR/vault-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    tar -czf "$backup_file" -C "$SECRETS_DIR" vault
    log "Backup created: $backup_file"

    # Decrypt all secrets with old key
    declare -A secrets
    for file in "$VAULT_DIR"/*.enc; do
        if [ -f "$file" ]; then
            local key
            key=$(basename "$file" .enc)
            local encrypted
            encrypted=$(cat "$file")
            local decrypted
            decrypted=$(decrypt_value "$encrypted")
            secrets[$key]="$decrypted"
        fi
    done

    # Generate new key
    local new_key
    new_key=$(openssl rand -base64 32)

    # Update key file
    if [ -f "$SECRETS_DIR/.encryption-key" ]; then
        mv "$SECRETS_DIR/.encryption-key" "$SECRETS_DIR/.encryption-key.old"
    fi
    echo "$new_key" > "$SECRETS_DIR/.encryption-key"
    chmod 600 "$SECRETS_DIR/.encryption-key"

    # Re-encrypt with new key
    ENCRYPTION_KEY="$new_key"
    export ENCRYPTION_KEY

    for key in "${!secrets[@]}"; do
        set_secret "$key" "${secrets[$key]}"
    done

    log "Encryption key rotated successfully"
    warn "Old key saved to: $SECRETS_DIR/.encryption-key.old"
    warn "Delete the old key file only after verifying all secrets work correctly"
}

# ── Docker Secrets Integration ───────────────────────────────────────────────
create_docker_secret() {
    local secret_name="$1"
    local secret_value="$2"

    log "Creating Docker secret: $secret_name"

    echo -n "$secret_value" | docker secret create "$secret_name" -

    log "Docker secret created: $secret_name"
}

load_docker_secrets() {
    log "Loading Docker secrets..."

    for file in "$VAULT_DIR"/*.enc; do
        if [ -f "$file" ]; then
            local key
            key=$(basename "$file" .enc)
            local value
            value=$(get_secret "$key")

            docker secret create "arch_$key" - <<< "$value" 2>/dev/null || \
                log "Secret already exists: arch_$key"
        fi
    done
}

# ── Main ─────────────────────────────────────────────────────────────────────
show_help() {
    cat << EOF
Arch-Systems Secrets Management

USAGE:
    $0 <command> [options]

COMMANDS:
    init                    Initialize secrets vault
    set <key> <value>       Store a secret
    get <key>               Retrieve a secret
    list                    List all secrets
    delete <key>            Delete a secret
    export                  Export secrets as environment variables

    aws-sync-to             Sync secrets to AWS Secrets Manager
    aws-sync-from           Sync secrets from AWS Secrets Manager

    vault-sync-to           Sync secrets to HashiCorp Vault
    vault-sync-from         Sync secrets from HashiCorp Vault

    rotate-key              Rotate encryption key

    docker-create <name> <value>  Create Docker secret
    docker-load             Load all secrets as Docker secrets

EXAMPLES:
    $0 init
    $0 set POSTGRES_PASSWORD "my-secret-password"
    $0 get POSTGRES_PASSWORD
    source <($0 export)
    $0 aws-sync-to
    $0 rotate-key

ENVIRONMENT VARIABLES:
    ARCH_SECRETS_KEY        Encryption key (auto-generated on init)
    VAULT_PROVIDER          Provider: file, aws, hashicorp
    AWS_REGION              AWS region for Secrets Manager
    AWS_SECRET_PREFIX       Prefix for AWS secret names
    VAULT_ADDR              HashiCorp Vault address
    VAULT_TOKEN             HashiCorp Vault token
    VAULT_PATH              HashiCorp Vault path

EOF
}

main() {
    local command="${1:-help}"
    shift || true

    case "$command" in
        init)
            init_vault
            ;;
        set)
            if [ $# -lt 2 ]; then
                error "Usage: $0 set <key> <value>"
                exit 1
            fi
            setup_directories
            set_secret "$1" "$2"
            ;;
        get)
            if [ $# -lt 1 ]; then
                error "Usage: $0 get <key>"
                exit 1
            fi
            check_encryption_key
            get_secret "$1"
            ;;
        list)
            setup_directories
            list_secrets
            ;;
        delete)
            if [ $# -lt 1 ]; then
                error "Usage: $0 delete <key>"
                exit 1
            fi
            check_encryption_key
            delete_secret "$1"
            ;;
        export)
            check_encryption_key
            export_secrets
            ;;
        aws-sync-to)
            check_encryption_key
            aws_sync_to_remote
            ;;
        aws-sync-from)
            check_encryption_key
            aws_sync_from_remote
            ;;
        vault-sync-to)
            check_encryption_key
            vault_sync_to_remote
            ;;
        vault-sync-from)
            check_encryption_key
            vault_sync_from_remote
            ;;
        rotate-key)
            rotate_encryption_key
            ;;
        docker-create)
            if [ $# -lt 2 ]; then
                error "Usage: $0 docker-create <name> <value>"
                exit 1
            fi
            create_docker_secret "$1" "$2"
            ;;
        docker-load)
            check_encryption_key
            load_docker_secrets
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
