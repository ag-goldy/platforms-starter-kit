# Variables

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-southeast-1" # Singapore - closest to your Neon DB
}

variable "project_name" {
  description = "Name prefix for all resources"
  type        = string
  default     = "agr-zabbix"
}

variable "use_existing_vpc" {
  description = "Whether to use an existing VPC"
  type        = bool
  default     = false
}

variable "existing_vpc_id" {
  description = "ID of existing VPC (if use_existing_vpc is true)"
  type        = string
  default     = ""
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.3.0/24", "10.0.4.0/24"]
}

variable "availability_zones" {
  description = "Availability zones to use"
  type        = list(string)
  default     = ["ap-southeast-1a", "ap-southeast-1b"]
}

# EC2 Variables
variable "ec2_instance_type" {
  description = "EC2 instance type for poller (m7i-flex.large recommended for high-frequency polling)"
  type        = string
  default     = "m7i-flex.large"
}

variable "ssh_key_name" {
  description = "Name of SSH key pair to use for EC2"
  type        = string
}

# Security Variables
variable "my_ip_cidr" {
  description = "Your IP address in CIDR format (e.g., 1.2.3.4/32)"
  type        = string
}

variable "zabbix_server_cidr" {
  description = "Zabbix server IP in CIDR format"
  type        = string
  default     = "0.0.0.0/0" # Restrict this in production!
}

# Application Variables
variable "app_url" {
  description = "Your Vercel app URL"
  type        = string
}

variable "cron_secret_token" {
  description = "Secret token for cron authentication"
  type        = string
  sensitive   = true
}

variable "sync_interval_ms" {
  description = "Sync interval in milliseconds"
  type        = string
  default     = "1000" # 1 second
}

variable "org_id" {
  description = "Organization ID to sync (or ALL)"
  type        = string
  default     = "ALL"
}

# Feature Flags
variable "use_elasticache" {
  description = "Whether to deploy ElastiCache Redis"
  type        = bool
  default     = true
}

variable "use_webhook_relay" {
  description = "Whether to enable webhook relay mode"
  type        = bool
  default     = false
}

variable "create_rds" {
  description = "Whether to create RDS instance (if not using Neon)"
  type        = bool
  default     = false
}

variable "create_websocket_api" {
  description = "Whether to create API Gateway WebSocket API"
  type        = bool
  default     = false
}

variable "webhook_secret" {
  description = "Secret for webhook verification"
  type        = string
  sensitive   = true
  default     = ""
}

# ElastiCache Variables
variable "elasticache_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}
