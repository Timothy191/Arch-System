terraform {
  backend "s3" {
    bucket         = "arch-system-tfstate"
    key            = "infra/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "arch-system-tfstate-lock"
    encrypt        = true
  }
}