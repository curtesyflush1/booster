#!/bin/bash

# BoosterBeacon Production Server Setup Script
# Run this script on your VPS to prepare it for deployment

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

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run this script as root"
    print_error "Run as your regular user with sudo privileges"
    exit 1
fi

print_status "🚀 Setting up BoosterBeacon production server..."
echo ""

# Update system packages
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y
print_success "System packages updated"

# Install Node.js 18.x
print_status "Installing Node.js 18.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_success "Node.js installed: $(node --version)"
else
    print_success "Node.js already installed: $(node --version)"
fi

# Install PM2
print_status "Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    print_success "PM2 installed: v$(pm2 --version)"
else
    print_success "PM2 already installed: v$(pm2 --version)"
fi

# Setup PM2 startup
print_status "Setting up PM2 startup..."
pm2 startup | grep "sudo env" | bash || true
print_success "PM2 startup configured"

# Install NGINX
print_status "Installing NGINX..."
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
    print_success "NGINX installed and started"
else
    print_success "NGINX already installed"
fi

# Install PostgreSQL
print_status "Installing PostgreSQL..."
if ! command -v psql &> /dev/null; then
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl enable postgresql
    sudo systemctl start postgresql
    print_success "PostgreSQL installed and started"
else
    print_success "PostgreSQL already installed"
fi

# Install Redis
print_status "Installing Redis..."
if ! command -v redis-cli &> /dev/null; then
    sudo apt install -y redis-server
    sudo systemctl enable redis-server
    sudo systemctl start redis-server
    print_success "Redis installed and started"
else
    print_success "Redis already installed"
fi

# Install additional utilities
print_status "Installing additional utilities..."
sudo apt install -y curl wget git htop unzip certbot python3-certbot-nginx
print_success "Additional utilities installed"

# Create application directories
print_status "Creating application directories..."
sudo mkdir -p /opt/booster/{releases,logs,backups,uploads,static}
sudo mkdir -p /opt/booster/logs/{backend,frontend,nginx}
sudo chown -R $USER:$USER /opt/booster
sudo chmod -R 755 /opt/booster
print_success "Application directories created"

# Setup firewall
print_status "Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
print_success "Firewall configured"

# Setup PostgreSQL database
print_status "Setting up PostgreSQL database..."
sudo -u postgres psql -c "CREATE USER booster_user WITH PASSWORD 'your_secure_password_here';" || true
sudo -u postgres psql -c "CREATE DATABASE boosterbeacon_prod OWNER booster_user;" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE boosterbeacon_prod TO booster_user;" || true
print_success "PostgreSQL database setup completed"

# Setup Redis configuration
print_status "Configuring Redis..."
sudo sed -i 's/# requirepass foobared/requirepass your_redis_password_here/' /etc/redis/redis.conf
sudo systemctl restart redis-server
print_success "Redis configured with password"

# Create environment file template
print_status "Creating environment file template..."
cat > /opt/booster/.env.production << 'EOF'
# BoosterBeacon Production Environment Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database Configuration
DATABASE_URL=postgresql://booster_user:your_secure_password_here@localhost:5432/boosterbeacon_prod

# Redis Configuration
REDIS_URL=redis://:your_redis_password_here@localhost:6379

# JWT Configuration
JWT_SECRET=your_very_secure_jwt_secret_key_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend Configuration
FRONTEND_URL=http://your-domain.com

# Email Configuration (Choose one option)
# Option 1: Amazon SES
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
SES_CONFIGURATION_SET=boosterbeacon-emails

# Option 2: SMTP Server
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your_email@domain.com
SMTP_PASS=your_email_password

# Common Email Settings
FROM_EMAIL=alerts@your-domain.com
FROM_NAME=BoosterBeacon

# Twilio SMS (Pro features)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Discord Integration (Pro features)
DISCORD_BOT_TOKEN=your_discord_bot_token

# Web Push Notifications (VAPID)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@your-domain.com

# Retailer APIs
BESTBUY_API_KEY=your_bestbuy_api_key
WALMART_API_KEY=your_walmart_api_key
EOF

print_success "Environment template created at /opt/booster/.env.production"

# Setup log rotation
print_status "Setting up log rotation..."
sudo tee /etc/logrotate.d/boosterbeacon > /dev/null << 'EOF'
/opt/booster/logs/**/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 derek derek
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
print_success "Log rotation configured"

# Setup system monitoring
print_status "Setting up system monitoring..."
sudo tee /etc/systemd/system/booster-monitor.service > /dev/null << 'EOF'
[Unit]
Description=BoosterBeacon System Monitor
After=network.target

[Service]
Type=simple
User=derek
WorkingDirectory=/opt/booster/current
ExecStart=/usr/bin/pm2 monit
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
print_success "System monitoring service created"

echo ""
print_success "🎉 Production server setup completed!"
echo ""
print_warning "⚠️  IMPORTANT: Please complete the following manual steps:"
echo ""
echo "1. 📝 Edit the environment file:"
echo "   nano /opt/booster/.env.production"
echo "   - Update all placeholder values with your actual credentials"
echo "   - Set secure passwords for database and Redis"
echo "   - Configure your email service (SES or SMTP)"
echo ""
echo "2. 🔐 Setup SSL certificate (recommended):"
echo "   sudo certbot --nginx -d your-domain.com"
echo ""
echo "3. 🗄️  Update PostgreSQL password:"
echo "   sudo -u postgres psql"
echo "   ALTER USER booster_user PASSWORD 'your_actual_secure_password';"
echo ""
echo "4. 🔑 Update Redis password:"
echo "   sudo nano /etc/redis/redis.conf"
echo "   # Update the requirepass line with your actual password"
echo "   sudo systemctl restart redis-server"
echo ""
echo "5. 🚀 Deploy the application:"
echo "   ./scripts/deploy.sh"
echo ""
echo "📊 Useful commands after deployment:"
echo "   pm2 status                    # Check application status"
echo "   pm2 logs                      # View logs"
echo "   pm2 monit                     # Monitor resources"
echo "   sudo systemctl status nginx  # Check NGINX status"
echo "   sudo systemctl status postgresql  # Check database status"
echo ""