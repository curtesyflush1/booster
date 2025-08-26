#!/bin/bash

# BoosterBeacon VPS Setup Script
# Run this script directly on your VPS to install dependencies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "🚀 Setting up BoosterBeacon VPS environment..."
echo ""

# Update system packages
print_status "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y
print_success "System packages updated"

# Install Node.js 18.x
print_status "Installing Node.js 18.x..."
if ! command -v node > /dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_success "Node.js installed: $(node --version)"
else
    print_success "Node.js already installed: $(node --version)"
fi

# Install PM2
print_status "Installing PM2..."
if ! command -v pm2 > /dev/null 2>&1; then
    sudo npm install -g pm2
    print_success "PM2 installed: v$(pm2 --version)"
else
    print_success "PM2 already installed: v$(pm2 --version)"
fi

# Setup PM2 startup
print_status "Setting up PM2 startup script..."
pm2 startup
print_warning "IMPORTANT: Copy and run the command above that starts with 'sudo env'"
print_warning "This will ensure PM2 starts automatically on server reboot"

# Install additional useful packages
print_status "Installing additional packages..."
sudo apt-get install -y curl wget git htop nginx certbot python3-certbot-nginx
print_success "Additional packages installed"

# Create application directory
print_status "Creating application directory..."
sudo mkdir -p /opt/booster
sudo chown $USER:$USER /opt/booster
mkdir -p /opt/booster/{releases,logs,backups}
print_success "Application directory created: /opt/booster"

# Setup basic firewall
print_status "Setting up firewall..."
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable
print_success "Firewall configured"

echo ""
print_success "🎉 VPS setup completed!"
echo ""
echo "Next steps:"
echo "1. Run the PM2 startup command shown above (starts with 'sudo env')"
echo "2. Configure your domain DNS to point to this server"
echo "3. Run deployment from your local machine: ./scripts/deploy.sh"
echo ""
echo "Server info:"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  PM2: v$(pm2 --version)"
echo "  Application directory: /opt/booster"