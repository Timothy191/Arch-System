# Cloudflare Account API Token configuration aligned with provider v5 (`cloudflare_account_token`).
# Permission group UUIDs correspond to account token `black-dew-879e` (`1ca648ce7cd165499f637b0e3f7b2da1`).

locals {
  account_readonly_permission_ids = [
    "c1fde68c7bcc44588cbb6ddbc16d6480", # Account Settings Read
    "477938ebf30f4bc781d5cb94a8710606", # Audit Logs Read
    "da1261c3d38544a4bba805b22566f8b6", # Workers Metadata Read-Only
    "1a71c399035b4950a1bd1466bbe4f420", # Workers Scripts Read
    "b4992e1108244f5d8bfbd5744320c2e1", # Workers R2 Storage Read
    "84a7755d54c646ca87cd50682a34bf7c", # Queues Read
    "5d78fd7895974fd0bdbbbb079482721b", # Turnstile Sites Read
    "4dc8917b4b40457d88d3035d5dadb054", # AI Gateway Read
    "efea2ab8357b47888938f101ae5e053f", # Cloudflare Tunnel Read
    "2dd44e425a914fb98f8d1ddbbcd66915", # Access: Apps Read
    "84b9a6a947474555aeb43a82300ce145", # Access: Policies Read
    "91f7ce32fa614d73b7e1fc8f0e78582b", # Access: Service Tokens Read
    "7ea222f6d5064cfa89ea366d7c1fee89", # Access: Apps and Policies Read
    "ece81d7757ff406cad61f221a4920d55", # Account Security Center Insights Read
  ]

  account_write_permission_ids = [
    "1af1fa2adc104452b74a9a3364202f20", # Account Settings Write
    "98d78cd2433d4c3687191bc0244ef948", # Workers Admin
    "e086da7e2179491d91ee5f35b3ca210a", # Workers Scripts Write
    "bf7481a1826f439697cb59a20b22293e", # Workers R2 Storage Write
    "366f57075ffc42689627bcf8242a1b6d", # Queues Write
    "755c05aa014b4f9ab263aa80b8167bd8", # Turnstile Sites Write
    "6c8a3737f07f46369c1ea1f22138daaf", # AI Gateway Write
    "644535f4ed854494a59cb289d634b257", # AI Gateway Run
    "c07321b023e944ff818fec44d8203567", # Cloudflare Tunnel Write
    "ad7a6f88896d498f98eb30592abfbbf4", # Access: Apps Write
    "e9e3e5ccdebf43dbb1c9576fe74dfaab", # Access: Policies Write
    "a1c0fec57cf94af79479a6d827fa518c", # Access: Service Tokens Write
    "1e13c5124ca64b72b1969a67e8829049", # Access: Apps and Policies Write
    "cfa2e2893226455c9b945914969dff7c", # Account Security Center Insights Write
  ]

  zone_readonly_permission_ids = [
    "c8fed203ed3043cba015a93ad1616f1f", # Zone Read
    "517b21aee92c4d89936c976ba6e4be55", # Zone Settings Read
    "dbc512b354774852af2b5a5f4ba3d470", # Zone WAF Read
    "82e64a83756745bbbb1c9c2701bf816b", # DNS Read
    "7b7216b327b04b8fbc8f524e1f9b7531", # SSL and Certificates Read
    "2072033d694d415a936eaeb94e6405b8", # Workers Routes Read
    "69ca0c60ffc24f5386ccb38885112c44", # Zone Observability Read
    "9858d41ad0164b57b7b8cd1a1b37b1b0", # Zone Security Center Insights Read
  ]

  zone_write_permission_ids = [
    "e6d2666161e84845a636613608cee8d5", # Zone Write
    "fb6778dc191143babbfaa57993f1d275", # Zone WAF Write
    "4755a26eedb94da69e1066d98aa820be", # DNS Write
  ]

  effective_account_permission_ids = concat(
    local.account_readonly_permission_ids,
    var.token_scope_profile == "platform" ? local.account_write_permission_ids : []
  )

  effective_zone_permission_ids = concat(
    local.zone_readonly_permission_ids,
    var.token_scope_profile == "platform" ? local.zone_write_permission_ids : []
  )
}

resource "cloudflare_account_token" "arch_system_platform" {
  count = var.manage_account_token ? 1 : 0

  account_id = var.cloudflare_account_id
  name       = var.account_token_name

  policies = [
    {
      effect = "allow"
      permission_groups = [
        for permission_id in local.effective_account_permission_ids : {
          id = permission_id
        }
      ]
      resources = jsonencode({
        "com.cloudflare.api.account.${var.cloudflare_account_id}" = "*"
      })
    },
    {
      effect = "allow"
      permission_groups = [
        for permission_id in local.effective_zone_permission_ids : {
          id = permission_id
        }
      ]
      resources = jsonencode({
        "com.cloudflare.api.account.${var.cloudflare_account_id}" = {
          "com.cloudflare.api.account.zone.*" = "*"
        }
      })
    },
  ]
}
