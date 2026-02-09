# Security Groups

# Security Group for EC2 Poller
resource "aws_security_group" "poller" {
  name_prefix = "${var.project_name}-poller-"
  vpc_id      = local.vpc_id
  description = "Security group for Zabbix poller EC2 instance"

  # SSH access (restrict to your IP)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip_cidr]
    description = "SSH access from my IP"
  }

  # Webhook relay port (if using webhook mode)
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = [var.zabbix_server_cidr]
    description = "Webhook from Zabbix"
  }

  # Outbound - HTTPS for API calls
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS to Vercel/Neon"
  }

  # Outbound - HTTP (for updates)
  egress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  # Outbound - Redis to ElastiCache
  egress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.elasticache.id]
    description     = "Redis to ElastiCache"
  }

  tags = {
    Name = "${var.project_name}-poller-sg"
  }
}

# Security Group for ElastiCache Redis
resource "aws_security_group" "elasticache" {
  name_prefix = "${var.project_name}-redis-"
  vpc_id      = local.vpc_id
  description = "Security group for ElastiCache Redis"

  # Redis access from EC2 poller
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.poller.id]
    description     = "Redis from poller"
  }

  tags = {
    Name = "${var.project_name}-redis-sg"
  }
}

# Security Group for RDS (if using RDS instead of Neon)
resource "aws_security_group" "rds" {
  count       = var.create_rds ? 1 : 0
  name_prefix = "${var.project_name}-rds-"
  vpc_id      = local.vpc_id
  description = "Security group for RDS PostgreSQL"

  # PostgreSQL from EC2 poller
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.poller.id]
    description     = "PostgreSQL from poller"
  }

  tags = {
    Name = "${var.project_name}-rds-sg"
  }
}

# Security Group for WebSocket API (if using API Gateway VPC link)
resource "aws_security_group" "websocket" {
  count       = var.create_websocket_api ? 1 : 0
  name_prefix = "${var.project_name}-websocket-"
  vpc_id      = local.vpc_id
  description = "Security group for WebSocket API"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS from anywhere"
  }

  tags = {
    Name = "${var.project_name}-websocket-sg"
  }
}

output "poller_security_group_id" {
  value = aws_security_group.poller.id
}

output "elasticache_security_group_id" {
  value = aws_security_group.elasticache.id
}
