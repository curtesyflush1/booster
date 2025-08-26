#!/bin/bash

# BoosterBeacon Deployment Script
# Deploys the application to production VPS using rsync

set -e

# Configuration
REMOTE_HOST="derek@82.180.162.48"
REMOTE_PATH="/opt/booster"
LOCAL_PATH="."

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

# Setup server environment (install Node.js, PM2, create directories, etc.)
setup_server() {
    print_status "Setting up server environment..."
    
    # Check if Node.js is installed
    if ! ssh $REMOTE_HOST "command -v node > /dev/null 2>&1"; then
        print_error "Node.js is not installed on the server."
        print_error "Please run the following commands on your VPS manually:"
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
    ssh $REMOTE_HOST "mkdir -p $REMOTE_PATH/{releases,logs,backups}"
    print_success "Directories created"
    
    print_success "Server environment setup complete"
}

# Run tests before deployment
run_tests() {
    print_status "Running tests before deployment..."
    if npm test; then
        print_success "All tests passed"
    else
        print_error "Tests failed. Deployment aborted."
        exit 1
    fi
}

# Build the application
build_app() {
    print_status "Building application..."
    print_status "Building backend, frontend, and extension..."
    if npm run build; then
        print_success "Build completed successfully"
    else
        print_error "Build failed. Deployment aborted."
        exit 1
    fi
}

# Sync files to remote server
sync_files() {
    print_status "Syncing files to $REMOTE_HOST:$REMOTE_PATH..."
    
    # Create rsync exclude file if it doesn't exist
    if [ ! -f .rsyncignore ]; then
        cat > .rsyncignore << EOF
node_modules/
.git/
.env.local
.env.development
.env.test
*.log
logs/
coverage/
.nyc_output/
dist/
build/
.DS_Store
Thumbs.db
*.tmp
*.temp
.kiro/
tests/
*.test.ts
*.test.js
*.spec.ts
*.spec.js
docker-compose.dev.yml
README.md
docs/
scripts/
.github/
extension/src/
extension/tests/
extension/manifest/
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
    
    # Install root dependencies first (handles workspaces)
    print_status "Installing root dependencies..."
    ssh $REMOTE_HOST "cd $REMOTE_PATH/$DEPLOY_DIR && npm ci --production --silent"
    
    print_success "Dependencies installed"
}

# Run database migrations on remote server
run_migrations() {
    print_status "Running database migrations..."
    if ssh $REMOTE_HOST "cd $REMOTE_PATH/$DEPLOY_DIR/backend && npm run migrate:up"; then
        print_success "Database migrations completed"
    else
        print_warning "Database migrations failed - continuing without migrations"
        print_warning "You may need to set up the database manually"
    fi
}

# Atomic deployment - switch to new release
atomic_deploy() {
    print_status "Switching to new release (atomic deployment)..."
    
    # Remove current directory if it exists and create symlink to new release
    ssh $REMOTE_HOST "cd $REMOTE_PATH && rm -rf current && ln -sfn $DEPLOY_DIR current"
    
    print_success "Symlink updated to new release"
}

# Restart services on remote server
restart_services() {
    print_status "Restarting services on remote server..."
    if ssh $REMOTE_HOST "cd $REMOTE_PATH/current && pm2 restart ecosystem.config.js"; then
        print_success "Services restarted"
    else
        print_status "Starting services for the first time..."
        ssh $REMOTE_HOST "cd $REMOTE_PATH/current && pm2 start ecosystem.config.js"
        print_success "Services started"
    fi
}

# Health check
health_check() {
    print_status "Performing health check..."
    sleep 5  # Give services time to start
    
    # Check if PM2 process is running
    if ssh $REMOTE_HOST "pm2 list | grep -q 'booster-beacon-api'"; then
        print_status "PM2 process is running, checking HTTP endpoint..."
        
        # Try health endpoint
        if ssh $REMOTE_HOST "curl -f http://localhost:3000/health > /dev/null 2>&1"; then
            print_success "Health check passed - application is running"
        else
            print_warning "HTTP health check failed, but PM2 process is running"
            print_status "Application logs:"
            ssh $REMOTE_HOST "cd $REMOTE_PATH/current && pm2 logs booster-beacon-api --lines 10"
        fi
    else
        print_warning "PM2 process not found"
        ssh $REMOTE_HOST "cd $REMOTE_PATH/current && pm2 list"
    fi
}

# Cleanup old releases (keep last 5)
cleanup_releases() {
    print_status "Cleaning up old releases..."
    ssh $REMOTE_HOST "cd $REMOTE_PATH/releases && ls -t | tail -n +6 | xargs -r rm -rf"
    print_success "Old releases cleaned up"
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

# Main deployment function
deploy() {
    echo "🚀 Starting deployment to production..."
    echo "Target: $REMOTE_HOST:$REMOTE_PATH"
    echo ""
    
    check_connection
    setup_server
    run_tests
    build_app
    sync_files
    install_dependencies
    run_migrations
    atomic_deploy
    restart_services
    health_check
    cleanup_releases
    
    echo ""
    print_success "🎉 Deployment completed successfully!"
    echo ""
    echo "You can check the application status with:"
    echo "  ssh $REMOTE_HOST 'cd $REMOTE_PATH/current && pm2 status'"
    echo ""
    echo "View logs with:"
    echo "  ssh $REMOTE_HOST 'cd $REMOTE_PATH/current && pm2 logs'"
    echo ""
    echo "Rollback if needed with:"
    echo "  ./scripts/deploy.sh rollback"
}

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        deploy
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
    *)
        echo "Usage: $0 [deploy|rollback|sync-only|restart-only|check|setup]"
        echo ""
        echo "Commands:"
        echo "  deploy      - Full deployment (default)"
        echo "  rollback    - Rollback to previous release"
        echo "  sync-only   - Only sync files, no restart"
        echo "  restart-only - Only restart services"
        echo "  check       - Check connection and health"
        echo "  setup       - Setup server environment (install PM2, create dirs)"
        exit 1
        ;;
esac