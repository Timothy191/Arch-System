output "account_id" {
  description = "Configured Cloudflare account identifier."
  value       = var.cloudflare_account_id
}

output "account_token_id" {
  description = "ID of the managed Cloudflare Account API Token when enabled."
  value       = try(cloudflare_account_token.arch_system_platform[0].id, null)
}

output "r2_bucket_name" {
  description = "Name of the private R2 shift reports bucket when enabled."
  value       = try(cloudflare_r2_bucket.shift_reports[0].name, null)
}

output "tunnel_id" {
  description = "ID of the SCADA edge Cloudflare Tunnel when enabled."
  value       = try(cloudflare_zero_trust_tunnel_cloudflared.scada_edge[0].id, null)
}

output "queue_id" {
  description = "ID of the telemetry ingest Cloudflare Queue when enabled."
  value       = try(cloudflare_queue.telemetry_ingest[0].queue_id, null)
}

output "turnstile_sitekey" {
  description = "Public Turnstile widget sitekey when enabled."
  value       = try(cloudflare_turnstile_widget.portal[0].sitekey, null)
}
