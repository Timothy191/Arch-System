terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws        = { source = "hashicorp/aws", version = "~> 5.0" }
    cloudflare = { source = "cloudflare/cloudflare", version = "~> 4.0" }
    openrouter = { source = "OpenRouterTeam/openrouter", version = "~> 0.3.0" }
  }
}
provider "aws" { region = var.aws_region }
provider "cloudflare" {}