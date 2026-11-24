# Opt-in Cloudflare v5 infrastructure resources for Arch-System.
# Every resource stays gated behind an explicit boolean variable (default = false)
# so validation and planning remain safe until explicitly enabled.

resource "cloudflare_r2_bucket" "shift_reports" {
  count = var.enable_r2_storage ? 1 : 0

  account_id = var.cloudflare_account_id
  name       = "${var.project_name}-shift-reports"
}

resource "cloudflare_zero_trust_tunnel_cloudflared" "scada_edge" {
  count = var.enable_tunnel ? 1 : 0

  account_id = var.cloudflare_account_id
  name       = "${var.project_name}-scada-edge"
  config_src = "cloudflare"
}

resource "cloudflare_queue" "telemetry_ingest" {
  count = var.enable_queues ? 1 : 0

  account_id = var.cloudflare_account_id
  queue_name = "${var.project_name}-telemetry-ingest"
}

resource "cloudflare_queue" "telemetry_dlq" {
  count = var.enable_queues ? 1 : 0

  account_id = var.cloudflare_account_id
  queue_name = "${var.project_name}-telemetry-dlq"
}

resource "cloudflare_turnstile_widget" "portal" {
  count = var.enable_turnstile ? 1 : 0

  account_id = var.cloudflare_account_id
  name       = "${var.project_name}-portal"
  mode       = "managed"
  domains    = [var.portal_hostname]
}

resource "cloudflare_ruleset" "waf_baseline" {
  count = var.enable_waf_baseline && var.cloudflare_zone_id != "" ? 1 : 0

  zone_id     = var.cloudflare_zone_id
  name        = "${var.project_name}-waf-baseline"
  description = "Baseline path traversal protection for Arch-System portal"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules = [
    {
      action      = "block"
      expression  = "(http.request.uri.path contains \"../\")"
      description = "Block path traversal"
      enabled     = true
    },
  ]
}
