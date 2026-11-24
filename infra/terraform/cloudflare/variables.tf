variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare Account ID for Arch-System platform resources."
  default     = "d7646260887677f91b94383b08472d0d"

  validation {
    condition     = can(regex("^[a-f0-9]{32}$", var.cloudflare_account_id))
    error_message = "cloudflare_account_id must be a 32-character lowercase hexadecimal Cloudflare account ID."
  }
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Optional Cloudflare Zone ID for WAF and edge ruleset provisioning."
  default     = ""
}

variable "project_name" {
  type        = string
  description = "Project prefix applied to Cloudflare resource names."
  default     = "arch-system"
}

variable "portal_hostname" {
  type        = string
  description = "Primary hostname protected by Turnstile and edge policies."
  default     = "arch-system-dun.vercel.app"
}

variable "account_token_name" {
  type        = string
  description = "Display name of the Cloudflare Account API Token."
  default     = "black-dew-879e"
}

variable "token_scope_profile" {
  type        = string
  description = "Permission scope profile for the account token: readonly (monitoring) or platform (read+write)."
  default     = "readonly"

  validation {
    condition     = contains(["readonly", "platform"], var.token_scope_profile)
    error_message = "token_scope_profile must be either 'readonly' or 'platform'."
  }
}

variable "manage_account_token" {
  type        = bool
  description = "Enable Terraform management of the Cloudflare Account API Token."
  default     = false
}

variable "enable_r2_storage" {
  type        = bool
  description = "Provision private R2 shift report object storage bucket."
  default     = false
}

variable "enable_tunnel" {
  type        = bool
  description = "Provision Cloudflare Tunnel for on-site SCADA/origin connectivity."
  default     = false
}

variable "enable_queues" {
  type        = bool
  description = "Provision Cloudflare telemetry ingest and dead-letter queues."
  default     = false
}

variable "enable_turnstile" {
  type        = bool
  description = "Provision Cloudflare Turnstile widget for the portal login flow."
  default     = false
}

variable "enable_waf_baseline" {
  type        = bool
  description = "Provision custom baseline WAF ruleset on var.cloudflare_zone_id."
  default     = false
}
