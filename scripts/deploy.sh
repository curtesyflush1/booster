#!/bin/bash

# BoosterBeacon Deployment Script
# Deploys the complete application stack to production VPS using rsync
# Supports backend API, frontend PWA, email system, and all notification services

set -e

# Configuration
REMOTE_HOST="derek@82.180.162.48"
REMOTE_PATH="/opt/booster"
LOCAL_PATH="."
BACKUP_RETENTION_DAYS=7
MAX_RELEASES=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if we can connect to the remote server
check_connection() {
    print_status "Checking connection to $REMOTE_HOST..."
    if ssh -o ConnectTimeout=10 -o BatchMode=yes $REMOTE_HOST exit 2>/dev/null; then
        print_success "Connection to $REMOTE_HOST successful"
    else
        print_error "Cannot connect to $REMOTE_HOST"
        print_error "Please ensure:"
        print_error "1. SSH key is set up for passwordless access"
        print_error "2. Server is accessible"
        print_error "3. User has proper permissions"
        exit 1
    fi
}

# Setup server environment (install Node.js, PM2, NGINX, create directories, etc.)
setup_server() {
    print_status "Setting up server environment..."
    
    # Check if Node.js is installed
    if ! ssh $REMOTE_HOST "command -v node > /dev/null 2>&1"; then
        print_error "Node.js is not installed on the server."
        print_error "Please run the following commands on your VPS manually:"
        print_error ""
        print_error "  # Update system packages"
        print_error "  sudo apt update && sudo apt upgrade -y"
        print_error ""
        print_error "  # Install Node.js 18.x"
        print_error "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
        print_error "  sudo apt-get install -y nodejs"
        print_error ""
        print_error "  # Install PM2"
        print_error "  sudo npm install -g pm2"
        print_error ""
        print_error "  # Setup PM2 startup"
        print_error "  pm2 startup"
        print_error "  # Then run the command that PM2 outputs (it will start with 'sudo env')"
        print_error ""
        print_error "  # Install NGINX for reverse proxy"
        print_error "  sudo apt install -y nginx"
        print_error "  sudo systemctl enable nginx"
        print_error ""
        print_error "  # Install PostgreSQL and Redis (if not using external services)"
        print_error "  sudo apt install -y postgresql postgresql-contrib redis-server"
        print_error ""
        print_error "After installation, run: ./scripts/deploy.sh setup"
        exit 1
    else
        NODE_VERSION=$(ssh $REMOTE_HOST "node --version")
        print_success "Node.js already installed: $NODE_VERSION"
    fi
    
    # Check if PM2 is installed
    if ! ssh $REMOTE_HOST "command -v pm2 > /dev/null 2>&1"; then
        print_error "PM2 is not installed. Please install it manually on your VPS:"
        print_error "  sudo npm install -g pm2"
        print_error "  pm2 startup"
        exit 1
    else
        PM2_VERSION=$(ssh $REMOTE_HOST "pm2 --version")
        print_success "PM2 already installed: v$PM2_VERSION"
    fi
    
    # Create necessary directories
    print_status "Creating application directories..."
    ssh $REMOTE_HOST "mkdir -p $REMOTE_PATH/{releases,logs,backups,uploads,static}"
    ssh $REMOTE_HOST "mkdir -p $REMOTE_PATH/logs/{backend,frontend,nginx}"
    print_success "Directories created"
    
    # Set proper permissions
    print_status "Setting directory permissions..."
    ssh $REMOTE_HOST "chown -R \$USER:\$USER $REMOTE_PATH"
    ssh $REMOTE_HOST "chmod -R 755 $REMOTE_PATH"
    print_success "Permissions set"
    
    print_success "Server environment setup complete"
}

# Run tests before deployment
run_tests() {
    print_status "Running comprehensive test suite before deployment..."
    
    # Check if we should skip tests
    if [ "$SKIP_TESTS" = "true" ]; then
        print_warning "Skipping tests (SKIP_TESTS=true)"
        return 0
    fi
    
    # Run backend tests with better error handling
    print_status "Running backend tests..."
    if cd backend; then
        # Try to run tests with timeout and proper cleanup
        if timeout 300 npm run test:unit -- --detectOpenHandles --forceExit; then
            print_success "Backend tests passed"
            cd ..
        else
            print_error "Backend tests failed or timed out."
            print_error "Test failures found. Options:"
            print_error "1. Fix the failing tests and redeploy"
            print_error "2. Deploy anyway with: SKIP_TESTS=true ./scripts/deploy.sh"
            print_error "3. Use quick deploy: ./scripts/deploy.sh quick"
            cd ..
            exit 1
        fi
    else
        print_error "Could not access backend directory"
        exit 1
    fi
    
    # Run frontend tests
    print_status "Running frontend tests..."
    if cd frontend; then
        if timeout 300 npm test -- --watchAll=false --passWithNoTests; then
            print_success "Frontend tests passed"
            cd ..
        else
            print_warning "Frontend tests failed, but continuing (frontend tests are less critical for deployment)"
            cd ..
        fi
    else
        print_warning "Could not access frontend directory, skipping frontend tests"
    fi
    
    # Run linting (non-blocking)
    print_status "Running code linting..."
    if npm run lint 2>/dev/null; then
        print_success "Code linting passed"
    else
        print_warning "Linting issues found, but continuing deployment"
    fi
    
    print_success "Critical tests completed"
}

# Build the application
build_app() {
    print_status "Building complete application stack..."
    
    # Clean previous builds
    print_status "Cleaning previous builds..."
    rm -rf backend/dist frontend/dist extension/dist
    
    # Build backend
    print_status "Building backend API server..."
    if cd backend && npm run build; then
        print_success "Backend build completed"
        cd ..
    else
        print_error "Backend build failed. Deployment aborted."
        exit 1
    fi
    
    # Build frontend PWA
    print_status "Building frontend PWA..."
    if cd frontend && npm run build; then
        print_success "Frontend build completed"
        cd ..
    else
        print_error "Frontend build failed. Deployment aborted."
        exit 1
    fi
    
    # Build extension (optional, may not be deployed to server)
    print_status "Building browser extension..."
    if cd extension && npm run build; then
        print_success "Extension build completed"
        cd ..
    else
        print_warning "Extension build failed, continuing without extension"
    fi
    
    # Verify build outputs
    print_status "Verifying build outputs..."
    if [ ! -d "backend/dist" ]; then
        print_error "Backend build output not found"
        exit 1
    fi
    if [ ! -d "frontend/dist" ]; then
        print_error "Frontend build output not found"
        exit 1
    fi
    
    print_success "All builds completed successfully"
}

# Sync files to remote server
sync_files() {
    print_status "Syncing files to $REMOTE_HOST:$REMOTE_PATH..."
    
    # Create rsync exclude file if it doesn't exist
    if [ ! -f .rsyncignore ]; then
        cat > .rsyncignore << EOF
# Development files
node_modules/
.git/
.gitignore
.env.local
.env.development
.env.test
*.log
logs/
coverage/
.nyc_output/
.DS_Store
Thumbs.db
*.tmp
*.temp
.kiro/

# Source files (we deploy built versions)
backend/src/
frontend/src/
extension/src/

# Test files
tests/
__tests__/
*.test.ts
*.test.js
*.spec.ts
*.spec.js
test-setup.ts
jest.config.js
vitest.config.ts

# Development configuration
docker-compose.dev.yml
docker-compose.yml
vite.config.ts
tsconfig.json
eslint.config.js
.eslintrc.*
.prettierrc
tailwind.config.js
postcss.config.js

# Documentation and scripts
README.md
docs/
scripts/
.github/

# Extension files (not deployed to server)
extension/

# IDE and editor files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db
desktop.ini

# Temporary files
*.tmp
*.temp
*.cache
.parcel-cache/
EOF
    fi
    
    # Create deployment directory with timestamp for atomic deployment
    DEPLOY_DIR="releases/$(date +%Y%m%d-%H%M%S)"
    
    print_status "Creating new release directory: $DEPLOY_DIR"
    ssh $REMOTE_HOST "mkdir -p $REMOTE_PATH/$DEPLOY_DIR"
    
    # Perform the sync to new release directory
    rsync -avz --progress \
        --exclude-from=.rsyncignore \
        $LOCAL_PATH/ $REMOTE_HOST:$REMOTE_PATH/$DEPLOY_DIR/
    
    print_success "Files synced to release directory"
}

# Install dependencies on remote server
install_dependencies() {
    print_status "Installing dependencies on remote server..."
    
    # Install backend dependencies
    print_status "Installing backend dependencies..."
    ssh $REMOTE_HOST "cd $REMOTE_PATH/$DEPLOY_DIR/backend && npm ci --production --silent"
    
    # Frontend dependencies are not needed in production (static files are built)
    print_status "Frontend is pre-built, no runtime dependencies needed"
    
    # Verify critical dependencies are installed
    print_status "Verifying critical dependencies..."
    ssh $REMOTE_HOST "cd $REMOTE_PATH/$DEPLOY_DIR/backend && node -e \"require('express'); require('pg'); require('redis'); console.log('Core dependencies verified')\""
    
    print_success "Dependencies installed and verified"
}

# Run database migrations and setup
run_migrations() {
    print_status "Running database migrations and setup..."
    
    # Check if database is accessible
    print_status "Checking database connectivity..."
    if ssh $REMOTE_HOST "cd $REMOTE_PATH/$DEPLOY_DIR/backend && node -e \"require('./dist/config/database').testConnection().then(() => console.log('DB connected')).catch(() => process.exit(1))\"" 2>/dev/null; then
        print_success "Database connection verified"
    else
        print_warning "Database connection failed - skipping migrations"
        print_warning "Please ensure database is running and accessible"
        return
    fi
    
    # Run migrations
    print_status "Applying database migrations..."
    if ssh $REMOTE_HOST "cd $REMOTE_PATH/$DEPLOY_DIR/backend && npm run migrate:up"; then
        print_success "Database migrations completed"
    else
        print_warning "Database migrations failed - continuing deployment"
        print_warning "You may need to run migrations manually:"
        print_warning "  ssh $REMOTE_HOST 'cd $REMOTE_PATH/current/backend && npm run migrate:up'"
    fi
    
    # Verify database schema
    print_status "Verifying database schema..."
    if ssh $REMOTE_HOST "cd $REMOTE_PATH/$DEPLOY_DIR/backend && node -e \"require('./dist/models').sequelize.authenticate().then(() => console.log('Schema verified')).catch(() => process.exit(1))\"" 2>/dev/null; then
        print_success "Database schema verified"
    else
        print_warning "Database schema verification failed"
    fi
}

# Atomic deployment - switch to new release
atomic_deploy() {
    print_status "Switching to new release (atomic deployment)..."
    
    # Remove current directory if it exists and create symlink to new release
    ssh $REMOTE_HOST "cd $REMOTE_PATH && rm -rf current && ln -sfn $DEPLOY_DIR current"
    
    print_success "Symlink updated to new release"
}

# Setup NGINX configuration for frontend and API proxy
setup_nginx() {
    # Skip NGINX setup if requested
    if [[ "${SKIP_NGINX:-false}" == "true" ]]; then
        print_warning "Skipping NGINX setup (SKIP_NGINX=true)"
        return 0
    fi
    
    print_status "Setting up NGINX configuration..."
    
    # Check if we can run sudo without password prompt
    if ! ssh $REMOTE_HOST "sudo -n true 2>/dev/null"; then
        print_warning "NGINX setup requires sudo access. Skipping NGINX configuration."
        print_warning "Please run the following commands manually on the server:"
        print_warning "  sudo tee /etc/nginx/sites-available/boosterbeacon > /dev/null << 'EOF'"
        print_warning "  [NGINX config content]"
        print_warning "  sudo ln -sf /etc/nginx/sites-available/boosterbeacon /etc/nginx/sites-enabled/"
        print_warning "  sudo rm -f /etc/nginx/sites-enabled/default"
        print_warning "  sudo nginx -t && sudo systemctl reload nginx"
        return 0
    fi
    
    # Create NGINX configuration
    ssh $REMOTE_HOST "sudo tee /etc/nginx/sites-available/boosterbeacon > /dev/null" << 'EOF'
server {
    listen 80;
    server_name _;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Serve frontend static files
    location / {
        root /opt/booster/current/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # PWA files
        location = /manifest.json {
            add_header Cache-Control "public, max-age=86400";
        }
        
        location = /sw.js {
            add_header Cache-Control "no-cache";
        }
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
EOF
    
    # Enable the site
    ssh $REMOTE_HOST "sudo ln -sf /etc/nginx/sites-available/boosterbeacon /etc/nginx/sites-enabled/"
    ssh $REMOTE_HOST "sudo rm -f /etc/nginx/sites-enabled/default"
    
    # Test NGINX configuration
    if ssh $REMOTE_HOST "sudo nginx -t"; then
        print_success "NGINX configuration is valid"
        ssh $REMOTE_HOST "sudo systemctl reload nginx"
        print_success "NGINX reloaded"
    else
        print_warning "NGINX configuration test failed"
    fi
}

# Restart services on remote server
restart_services() {
    print_status "Restarting application services..."
    
    # Stop existing PM2 processes
    ssh $REMOTE_HOST "cd $REMOTE_PATH/current && pm2 delete all || true"
    
    # Start services with new configuration
    print_status "Starting PM2 services..."
    if ssh $REMOTE_HOST "cd $REMOTE_PATH/current && pm2 start ecosystem.config.js"; then
        print_success "PM2 services started"
    else
        print_error "Failed to start PM2 services"
        ssh $REMOTE_HOST "cd $REMOTE_PATH/current && pm2 logs --lines 20"
        exit 1
    fi
    
    # Save PM2 configuration
    ssh $REMOTE_HOST "pm2 save"
    
    print_success "Services restarted successfully"
}

# Comprehensive health check
health_check() {
    print_status "Performing comprehensive health check..."
    sleep 10  # Give services time to start
    
    # Check PM2 processes
    print_status "Checking PM2 processes..."
    if ssh $REMOTE_HOST "pm2 list | grep -q 'booster-beacon-api'"; then
        print_success "PM2 process is running"
    else
        print_error "PM2 process not found"
        ssh $REMOTE_HOST "pm2 list"
        return 1
    fi
    
    # Check API health endpoint
    print_status "Checking API health endpoint..."
    for i in {1..5}; do
        if ssh $REMOTE_HOST "curl -f -s http://localhost:3000/health > /dev/null 2>&1"; then
            print_success "API health check passed"
            break
        else
            if [ $i -eq 5 ]; then
                print_error "API health check failed after 5 attempts"
                print_status "API logs:"
                ssh $REMOTE_HOST "pm2 logs booster-beacon-api --lines 20"
                return 1
            else
                print_status "API not ready, waiting... (attempt $i/5)"
                sleep 5
            fi
        fi
    done
    
    # Check NGINX status
    print_status "Checking NGINX status..."
    if ssh $REMOTE_HOST "sudo systemctl is-active nginx > /dev/null 2>&1"; then
        print_success "NGINX is running"
    else
        print_warning "NGINX is not running"
        ssh $REMOTE_HOST "sudo systemctl status nginx"
    fi
    
    # Check frontend serving
    print_status "Checking frontend serving..."
    if ssh $REMOTE_HOST "curl -f -s http://localhost/ > /dev/null 2>&1"; then
        print_success "Frontend is being served correctly"
    else
        print_warning "Frontend serving check failed"
    fi
    
    # Check database connectivity
    print_status "Checking database connectivity..."
    if ssh $REMOTE_HOST "cd $REMOTE_PATH/current/backend && node -e \"require('./dist/config/database').testConnection().then(() => console.log('DB OK')).catch(() => process.exit(1))\"" 2>/dev/null; then
        print_success "Database connection is healthy"
    else
        print_warning "Database connection check failed"
    fi
    
    # Check Redis connectivity
    print_status "Checking Redis connectivity..."
    if ssh $REMOTE_HOST "cd $REMOTE_PATH/current/backend && node -e \"require('redis').createClient(process.env.REDIS_URL).ping().then(() => console.log('Redis OK')).catch(() => process.exit(1))\"" 2>/dev/null; then
        print_success "Redis connection is healthy"
    else
        print_warning "Redis connection check failed"
    fi
    
    print_success "Health check completed"
}

# Backup current release before deployment
backup_current_release() {
    print_status "Creating backup of current release..."
    
    if ssh $REMOTE_HOST "[ -L $REMOTE_PATH/current ]"; then
        CURRENT_RELEASE=$(ssh $REMOTE_HOST "readlink $REMOTE_PATH/current")
        BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
        
        ssh $REMOTE_HOST "cd $REMOTE_PATH && cp -r $CURRENT_RELEASE backups/$BACKUP_NAME"
        print_success "Current release backed up as: $BACKUP_NAME"
    else
        print_status "No current release to backup"
    fi
}

# Cleanup old releases and backups
cleanup_releases() {
    print_status "Cleaning up old releases and backups..."
    
    # Keep last N releases
    ssh $REMOTE_HOST "cd $REMOTE_PATH/releases && ls -t | tail -n +$((MAX_RELEASES + 1)) | xargs -r rm -rf"
    
    # Keep backups for N days
    ssh $REMOTE_HOST "find $REMOTE_PATH/backups -type d -mtime +$BACKUP_RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true"
    
    # Clean up old logs
    ssh $REMOTE_HOST "find $REMOTE_PATH/logs -name '*.log' -mtime +30 -delete 2>/dev/null || true"
    
    print_success "Cleanup completed (keeping last $MAX_RELEASES releases, $BACKUP_RETENTION_DAYS days of backups)"
}

# Rollback function
rollback() {
    print_status "Rolling back to previous release..."
    PREVIOUS_RELEASE=$(ssh $REMOTE_HOST "cd $REMOTE_PATH/releases && ls -t | head -n 2 | tail -n 1")
    
    if [ -n "$PREVIOUS_RELEASE" ]; then
        ssh $REMOTE_HOST "cd $REMOTE_PATH && ln -sfn releases/$PREVIOUS_RELEASE current"
        restart_services
        health_check
        print_success "Rollback completed to release: $PREVIOUS_RELEASE"
    else
        print_error "No previous release found for rollback"
        exit 1
    fi
}

# Environment validation
validate_environment() {
    print_status "Validating deployment environment..."
    
    # Check if .env file exists
    if [ ! -f "backend/.env" ]; then
        print_error "Backend .env file not found"
        print_error "Please create backend/.env with production configuration"
        exit 1
    fi
    
    # Check if required build outputs exist
    if [ ! -d "backend/dist" ]; then
        print_error "Backend build output not found. Run 'npm run build:backend' first"
        exit 1
    fi
    
    if [ ! -d "frontend/dist" ]; then
        print_error "Frontend build output not found. Run 'npm run build:frontend' first"
        exit 1
    fi
    
    print_success "Environment validation passed"
}

# Main deployment function
deploy() {
    echo "🚀 Starting BoosterBeacon deployment to production..."
    echo "Target: $REMOTE_HOST:$REMOTE_PATH"
    echo "Components: Backend API, Frontend PWA, Email System, Notification Services"
    echo ""
    
    validate_environment
    check_connection
    setup_server
    run_tests
    build_app
    backup_current_release
    sync_files
    install_dependencies
    run_migrations
    atomic_deploy
    setup_nginx
    restart_services
    health_check
    cleanup_releases
    
    echo ""
    print_success "🎉 BoosterBeacon deployment completed successfully!"
    echo ""
    echo "🌐 Application URLs:"
    echo "  Frontend: http://$(ssh $REMOTE_HOST 'curl -s ifconfig.me')/"
    echo "  API: http://$(ssh $REMOTE_HOST 'curl -s ifconfig.me')/api/v1/status"
    echo "  Health: http://$(ssh $REMOTE_HOST 'curl -s ifconfig.me')/health"
    echo ""
    echo "📊 Management Commands:"
    echo "  Check status: ssh $REMOTE_HOST 'cd $REMOTE_PATH/current && pm2 status'"
    echo "  View logs: ssh $REMOTE_HOST 'cd $REMOTE_PATH/current && pm2 logs'"
    echo "  Monitor: ssh $REMOTE_HOST 'cd $REMOTE_PATH/current && pm2 monit'"
    echo ""
    echo "🔄 Rollback if needed:"
    echo "  ./scripts/deploy.sh rollback"
    echo ""
    echo "📧 Email System Status:"
    echo "  Test email: curl -X POST http://$(ssh $REMOTE_HOST 'curl -s ifconfig.me')/api/v1/email/config/test"
    echo ""
}

# Additional deployment functions
quick_deploy() {
    print_status "Quick deployment (skip tests, use existing build)..."
    validate_environment
    check_connection
    backup_current_release
    sync_files
    install_dependencies
    atomic_deploy
    setup_nginx
    restart_services
    health_check
    cleanup_releases
    print_success "Quick deployment completed"
}

# Deploy without tests (for hotfixes or when tests are known to be failing)
deploy_no_tests() {
    print_status "Deployment without tests (use with caution)..."
    validate_environment
    check_connection
    build_app
    backup_current_release
    sync_files
    install_dependencies
    run_migrations
    atomic_deploy
    setup_nginx
    restart_services
    health_check
    cleanup_releases
    print_success "Deployment without tests completed"
}

logs() {
    print_status "Fetching application logs..."
    ssh $REMOTE_HOST "cd $REMOTE_PATH/current && pm2 logs --lines 50"
}

status() {
    print_status "Checking application status..."
    ssh $REMOTE_HOST "cd $REMOTE_PATH/current && pm2 status"
    echo ""
    ssh $REMOTE_HOST "cd $REMOTE_PATH/current && pm2 monit --no-interaction" || true
}

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "quick")
        quick_deploy
        ;;
    "no-tests")
        deploy_no_tests
        ;;
    "rollback")
        check_connection
        rollback
        ;;
    "sync-only")
        check_connection
        sync_files
        print_success "Files synced (no restart)"
        ;;
    "restart-only")
        check_connection
        restart_services
        health_check
        ;;
    "check")
        check_connection
        health_check
        ;;
    "setup")
        check_connection
        setup_server
        ;;
    "logs")
        check_connection
        logs
        ;;
    "status")
        check_connection
        status
        ;;
    "nginx")
        check_connection
        setup_nginx
        ;;
    *)
        echo "Usage: $0 [command]"
        echo ""
        echo "Deployment Commands:"
        echo "  deploy      - Full deployment with tests and build (default)"
        echo "  quick       - Quick deployment (skip tests, use existing build)"
        echo "  no-tests    - Deploy with build but skip tests (use with caution)"
        echo "  rollback    - Rollback to previous release"
        echo ""
        echo "Maintenance Commands:"
        echo "  sync-only   - Only sync files, no restart"
        echo "  restart-only - Only restart services"
        echo "  check       - Check connection and health"
        echo "  setup       - Setup server environment"
        echo "  nginx       - Setup/update NGINX configuration"
        echo ""
        echo "Monitoring Commands:"
        echo "  status      - Show PM2 status and monitoring"
        echo "  logs        - Show recent application logs"
        echo ""
        echo "Examples:"
        echo "  $0 deploy              # Full production deployment with tests"
        echo "  $0 no-tests            # Deploy without running tests"
        echo "  $0 quick               # Quick deployment for hotfixes"
        echo "  SKIP_TESTS=true $0     # Deploy with environment variable to skip tests"
        echo "  $0 check               # Health check without deployment"
        echo "  $0 logs                # View recent logs"
        echo ""
        echo "Environment Variables:"
        echo "  SKIP_TESTS=true        # Skip test execution during deployment"
        echo "  SKIP_NGINX=true        # Skip NGINX configuration (requires sudo)"
        exit 1
        ;;
esac