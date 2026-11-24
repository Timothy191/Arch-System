# Arch-System Cloudflare Provider v5 Terraform Stack

This directory defines the dedicated Cloudflare Provider `~> 5.0` infrastructure stack for Arch-System. It lives separately from [`../main.tf`](../main.tf) (which pins `~> 4.0` for legacy AWS/Cloudflare resources) so provider v5 resources such as `cloudflare_account_token` stay isolated and cleanly validated.

## Managed Capabilities

- **Account API Token (`account_token.tf`)**: Parameterized `cloudflare_account_token` matching account `d7646260887677f91b94383b08472d0d` (`black-dew-879e`), with a strict `readonly` default profile and opt-in `platform` read/write scope profile.
- **Opt-In Edge Subsystems (`infrastructure.tf`)**: Gated modules for R2 private storage, `cloudflared` SCADA edge tunnels, telemetry Queues + DLQ, Turnstile managed widgets, and custom zone WAF rulesets.

## Local Validation

Initialize plugins without backend state and verify formatting and syntax:

```bash
cd infra/terraform/cloudflare
terraform init -backend=false
terraform fmt -check
terraform validate
```

## Importing the Existing Account Token

Never commit `CLOUDFLARE_API_TOKEN` or token secrets to HCL or state files checked into git. Export `CLOUDFLARE_API_TOKEN` in your shell and import the existing `black-dew-879e` account token (`1ca648ce7cd165499f637b0e3f7b2da1`) before setting `manage_account_token = true`:

```bash
export CLOUDFLARE_API_TOKEN="<your-cfat-token>"
terraform import \
  -var="manage_account_token=true" \
  -var="token_scope_profile=platform" \
  'cloudflare_account_token.arch_system_platform[0]' \
  'd7646260887677f91b94383b08472d0d/1ca648ce7cd165499f637b0e3f7b2da1'
```

## Portal & Vercel Runtime Environment

Configure these variables in Vercel (`arch-system`) and local `apps/portal/.env`:

- `CLOUDFLARE_ACCOUNT_ID`: `d7646260887677f91b94383b08472d0d`
- `CLOUDFLARE_API_TOKEN`: Active account or user bearer token (`cfat_*` / `cfut_*`)
- `CLOUDFLARE_ZONE_ID` (optional): Automatically discovered via active account zones when omitted
- `CLOUDFLARE_TUNNEL_ID` (optional): Active `cloudflared` tunnel UUID
- `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` / `CLOUDFLARE_TURNSTILE_SECRET_KEY` (optional)
- `CLOUDFLARE_AI_GATEWAY_ENABLED`: `false` by default (opt-in)
