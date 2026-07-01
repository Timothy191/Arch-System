output "redis_configuration_endpoint" {
  value = aws_elasticache_replication_group.amca_redis_cluster.configuration_endpoint_address
  description = "The configuration endpoint to allow connecting to the Redis cluster."
}

output "redis_port" {
  value = aws_elasticache_replication_group.amca_redis_cluster.port
}
