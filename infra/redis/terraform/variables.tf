variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "node_type" {
  type    = string
  default = "cache.t4g.medium"
  description = "The compute and memory capacity of the nodes."
}

variable "subnet_ids" {
  type    = list(string)
  description = "List of VPC Subnet IDs for the Redis cluster."
}

variable "security_group_ids" {
  type    = list(string)
  description = "Security groups to attach to the Redis cluster."
}
