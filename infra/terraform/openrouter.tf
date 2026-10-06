# OpenRouter Official Terraform Provider
# Provider Source: OpenRouterTeam/openrouter
# Manages OpenRouter API keys, workspace configurations, guardrails, and model routing.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    openrouter = {
      source  = "OpenRouterTeam/openrouter"
      version = "~> 0.3.0"
    }
  }
}

variable "openrouter_api_key" {
  type        = string
  description = "OpenRouter inference API key for agents"
  sensitive   = true
  default     = ""
}

variable "openrouter_management_key" {
  type        = string
  description = "OpenRouter provisioning and management key"
  sensitive   = true
  default     = ""
}

provider "openrouter" {
  api_key = coalesce(var.openrouter_management_key, var.openrouter_api_key)
}
