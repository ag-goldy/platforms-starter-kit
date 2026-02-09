#!/bin/bash
#
# AWS Infrastructure Deployment Script
#
# This script deploys the complete AWS infrastructure for sub-100ms Zabbix integration
#
# Prerequisites:
#   - AWS CLI installed and configured
#   - Terraform installed
#   - SSH key pair created in AWS
#
# Usage:
#   ./deploy-aws.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/../terraform"

echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     AWS Zabbix Infrastructure Deployment         ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
echo

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    echo "Install from: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
    exit 1
fi

if ! command -v terraform &> /dev/null; then
    echo -e "${RED}Error: Terraform is not installed${NC}"
    echo "Install from: https://www.terraform.io/downloads"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    echo "Run: aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ AWS Account: $ACCOUNT_ID${NC}"

# Check terraform.tfvars
echo
echo -e "${BLUE}Checking configuration...${NC}"

if [ ! -f "$TERRAFORM_DIR/terraform.tfvars" ]; then
    echo -e "${YELLOW}Warning: terraform.tfvars not found${NC}"
    echo -e "Creating from example..."
    cp "$TERRAFORM_DIR/terraform.tfvars.example" "$TERRAFORM_DIR/terraform.tfvars"
    echo -e "${RED}Please edit $TERRAFORM_DIR/terraform.tfvars with your values${NC}"
    exit 1
fi

# Validate required variables
echo -e "${BLUE}Validating configuration...${NC}"

if grep -q "YOUR_IP/32" "$TERRAFORM_DIR/terraform.tfvars"; then
    echo -e "${RED}Error: Please set my_ip_cidr in terraform.tfvars${NC}"
    echo "Get your IP from: https://ipinfo.io/ip"
    exit 1
fi

if grep -q "your-key-pair-name" "$TERRAFORM_DIR/terraform.tfvars"; then
    echo -e "${RED}Error: Please set ssh_key_name in terraform.tfvars${NC}"
    exit 1
fi

if grep -q "your-super-secret-token" "$TERRAFORM_DIR/terraform.tfvars"; then
    echo -e "${RED}Error: Please set cron_secret_token in terraform.tfvars${NC}"
    exit 1
fi

if grep -q "https://yourdomain.com" "$TERRAFORM_DIR/terraform.tfvars"; then
    echo -e "${RED}Error: Please set app_url in terraform.tfvars${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Configuration valid${NC}"

# Initialize Terraform
echo
echo -e "${BLUE}Initializing Terraform...${NC}"
cd "$TERRAFORM_DIR"
terraform init

# Plan
echo
echo -e "${BLUE}Planning infrastructure...${NC}"
terraform plan -out=tfplan

# Confirm
echo
read -p "Do you want to apply these changes? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    rm -f tfplan
    exit 0
fi

# Apply
echo
echo -e "${BLUE}Deploying infrastructure...${NC}"
terraform apply tfplan
rm -f tfplan

# Get outputs
echo
echo -e "${GREEN}Deployment complete!${NC}"
echo
echo -e "${BLUE}=== Outputs ===${NC}"
terraform output

# Wait for EC2 to be ready
EC2_IP=$(terraform output -raw ec2_public_ip)
echo
echo -e "${BLUE}Waiting for EC2 instance to be ready...${NC}"
sleep 30

# Check if poller is running
echo
echo -e "${BLUE}Checking poller status...${NC}"
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ec2-user@$EC2_IP "sudo systemctl is-active zabbix-poller" && echo -e "${GREEN}✓ Poller is running${NC}" || echo -e "${YELLOW}⚠ Poller may still be starting${NC}"

echo
echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Deployment Complete!                 ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
echo
echo -e "SSH Command:"
echo -e "  ${YELLOW}ssh ec2-user@$EC2_IP${NC}"
echo
echo -e "View Logs:"
echo -e "  ${YELLOW}ssh ec2-user@$EC2_IP 'sudo journalctl -u zabbix-poller -f'${NC}"
echo
echo -e "Redis Endpoint:"
terraform output redis_connection_string
echo
