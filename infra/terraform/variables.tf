variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "arch-system"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "domain_name" {
  type    = string
  default = "portal.example.com"
}