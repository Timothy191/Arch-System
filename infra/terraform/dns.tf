variable "cloudflare_zone_id" {
  type    = string
  default = ""
}

resource "cloudflare_record" "portal" {
  count   = var.cloudflare_zone_id == "" ? 0 : 1
  zone_id = var.cloudflare_zone_id
  name    = "portal"
  value   = "portal.example.com"
  type    = "CNAME"
  proxied = true
}