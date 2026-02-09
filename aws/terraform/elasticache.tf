# ElastiCache Redis for Pub/Sub

# Subnet Group for ElastiCache
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project_name}-redis-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-redis-subnet"
  }
}

# Parameter Group for Redis
resource "aws_elasticache_parameter_group" "redis" {
  family = "redis7"
  name   = "${var.project_name}-redis-params"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }
}

# ElastiCache Redis Cluster
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.project_name}-redis"
  engine               = "redis"
  node_type            = var.elasticache_node_type
  num_cache_nodes      = 1
  parameter_group_name = aws_elasticache_parameter_group.redis.name
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.elasticache.id]
  port                 = 6379

  at_rest_encryption_enabled = true
  transit_encryption_enabled = false # Simpler for now, enable in production

  tags = {
    Name = "${var.project_name}-redis"
  }
}

# Outputs
output "redis_endpoint" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "redis_port" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].port
}

output "redis_connection_string" {
  value = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:${aws_elasticache_cluster.redis.cache_nodes[0].port}"
}
