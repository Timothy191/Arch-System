provider "aws" {
  region = var.aws_region
}

resource "aws_elasticache_subnet_group" "amca_redis_subnet" {
  name       = "amca-redis-subnet"
  subnet_ids = var.subnet_ids
}

resource "aws_elasticache_replication_group" "amca_redis_cluster" {
  replication_group_id          = "amca-cluster"
  description                   = "AMCA remote cache and telemetry cluster"
  node_type                     = var.node_type
  port                          = 6379
  parameter_group_name          = "default.redis7.cluster.on"
  subnet_group_name             = aws_elasticache_subnet_group.amca_redis_subnet.name
  automatic_failover_enabled    = true

  cluster_mode {
    replicas_per_node_group = 1
    num_node_groups         = 3
  }

  security_group_ids = var.security_group_ids
}
