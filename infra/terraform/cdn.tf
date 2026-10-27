# Cloudflare WAF + rate limiting baseline
resource "cloudflare_ruleset" "waf" {
  count       = var.cloudflare_zone_id == "" ? 0 : 1
  zone_id     = var.cloudflare_zone_id
  name        = "arch-system-waf"
  description = "Baseline WAF"
  kind        = "zone"
  phase       = "http_request_firewall_custom"
  rules {
    action      = "block"
    expression  = "(http.request.uri.path contains \"../\")"
    description = "Block path traversal"
  }
}