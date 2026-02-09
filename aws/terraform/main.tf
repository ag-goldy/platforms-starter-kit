# AWS Infrastructure for Sub-100ms Zabbix Integration
# 
# This Terraform configuration deploys:
# - VPC with public and private subnets
# - EC2 instance for Zabbix polling
# - ElastiCache Redis for pub/sub
# - Security groups for secure communication
#
# Usage:
#   1. Copy terraform.tfvars.example to terraform.tfvars
#   2. Edit terraform.tfvars with your values
#   3. terraform init
#   4. terraform plan
#   5. terraform apply

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Data source for latest Amazon Linux 2 AMI
data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

# VPC
data "aws_vpc" "existing" {
  count = var.use_existing_vpc ? 1 : 0
  id    = var.existing_vpc_id
}

resource "aws_vpc" "main" {
  count                = var.use_existing_vpc ? 0 : 1
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

locals {
  vpc_id = var.use_existing_vpc ? data.aws_vpc.existing[0].id : aws_vpc.main[0].id
}

# Public Subnet (for EC2)
resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = local.vpc_id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-${count.index + 1}"
  }
}

# Private Subnet (for ElastiCache)
resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = local.vpc_id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.project_name}-private-${count.index + 1}"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  count  = var.use_existing_vpc ? 0 : 1
  vpc_id = local.vpc_id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# Route Table for Public Subnet
resource "aws_route_table" "public" {
  count  = var.use_existing_vpc ? 0 : 1
  vpc_id = local.vpc_id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main[0].id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = var.use_existing_vpc ? 0 : length(var.public_subnet_cidrs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public[0].id
}

# Elastic IP for EC2
resource "aws_eip" "poller" {
  domain = "vpc"

  tags = {
    Name = "${var.project_name}-poller-eip"
  }
}

# Outputs
output "vpc_id" {
  value = local.vpc_id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "elastic_ip" {
  value = aws_eip.poller.public_ip
}
