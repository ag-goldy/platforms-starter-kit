# EC2 Instance for Zabbix Poller

# IAM Role for EC2
resource "aws_iam_role" "poller" {
  name = "${var.project_name}-poller-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policy for CloudWatch Logs
resource "aws_iam_role_policy" "poller_cloudwatch" {
  name = "${var.project_name}-poller-cloudwatch"
  role = aws_iam_role.poller.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "poller" {
  name = "${var.project_name}-poller-profile"
  role = aws_iam_role.poller.name
}

# EC2 Instance
resource "aws_instance" "poller" {
  ami                    = data.aws_ami.amazon_linux_2.id
  instance_type          = var.ec2_instance_type
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.poller.id]
  iam_instance_profile   = aws_iam_instance_profile.poller.name
  key_name               = var.ssh_key_name

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
  }

  user_data = base64encode(templatefile("${path.module}/../scripts/user-data.sh", {
    app_url           = var.app_url
    cron_secret_token = var.cron_secret_token
    sync_interval_ms  = var.sync_interval_ms
    org_id            = var.org_id
    redis_endpoint    = aws_elasticache_cluster.redis.cache_nodes[0].address
    use_redis         = var.use_elasticache
    use_webhook       = var.use_webhook_relay
    webhook_secret    = var.webhook_secret
  }))

  tags = {
    Name = "${var.project_name}-poller"
  }

  depends_on = [aws_elasticache_cluster.redis]
}

# Elastic IP Association
resource "aws_eip_association" "poller" {
  instance_id   = aws_instance.poller.id
  allocation_id = aws_eip.poller.id
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "poller" {
  name              = "/${var.project_name}/poller"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-poller-logs"
  }
}

output "ec2_instance_id" {
  value = aws_instance.poller.id
}

output "ec2_public_ip" {
  value = aws_eip.poller.public_ip
}

output "ec2_private_ip" {
  value = aws_instance.poller.private_ip
}

output "ssh_command" {
  value = "ssh -i ~/.ssh/${var.ssh_key_name}.pem ec2-user@${aws_eip.poller.public_ip}"
}
