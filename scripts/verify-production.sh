#!/bin/bash

# BoosterBeacon Production Environment Verification Script
# Verifies that the production environment is properly configured

set -e

# Configuration
# Resolve project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load optional project-level deploy config if present (overrides defaults)
if [[ -f "$PROJECT_ROOT/deploy.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PROJECT_ROOT/deploy.env"
  set +a
fi

DEPLOY_USER="${DEPLOY_USER:-derek}"
DEPLOY_HOST="${DEPLOY_HOST:-82.180.162.48}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/booster}"
SSH_OPTS="${SSH_OPTS:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse args
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
  esac
done

# Check local environment
check_local_environment() {
    log_info "Checking local environment..."
    
    # Check if production environment file exists
    if [[ -f ".env.production" ]]; then
        log_success "Production environment file exists"
    else
        log_error "Production environment file (.env.production) not found"
        return 1
    fi
    
    # Check if Docker is running (skip in dry-run)
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "Skipping Docker check (dry-run)"
    else
        if docker info &> /null; then
            log_success "Docker is running"
    else
        log_warning "Docker is not running locally (will build on server or use existing artifacts)"
    fi
    fi
    
    # Check if builds exist
    if [[ -f "backend/dist/index.js" ]]; then
        log_success "Backend build exists"
    else
        log_warning "Backend build not found - will build during deployment"
    fi
    
    if [[ -f "frontend/dist/index.html" ]]; then
        log_success "Frontend build exists"
    else
        log_warning "Frontend build not found - will build during deployment"
    fi
    
    return 0
}

# Check remote server
check_remote_server() {
    log_info "Checking remote server..."
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "Skipping remote server checks (dry-run)"
        return 0
    fi
    
    # Test SSH connection
    if ssh $SSH_OPTS -o ConnectTimeout=10 "$DEPLOY_USER@$DEPLOY_HOST" "echo 'SSH connection successful'" &> /dev/null; then
        log_success "SSH connection to server successful"
    else
        log_error "Cannot connect to server $DEPLOY_USER@$DEPLOY_HOST"
        return 1
    fi
    
    # Check server requirements
    ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" << 'EOF'
        # Check if Docker is installed
        if command -v docker &> /dev/null; then
            echo -e "\033[0;32m[SUCCESS]\033[0m Docker is installed: $(docker --version)"
        else
            echo -e "\033[0;31m[ERROR]\033[0m Docker is not installed"
            exit 1
        fi
        
        # Check if Docker Compose (v1 or v2) is available
        if command -v docker-compose &> /dev/null; then
            echo -e "\033[0;32m[SUCCESS]\033[0m Docker Compose (v1) is installed: $(docker-compose --version)"
        elif docker compose version &> /dev/null; then
            echo -e "\033[0;32m[SUCCESS]\033[0m Docker Compose (v2) is available: $(docker compose version)"
        else
            echo -e "\033[0;31m[ERROR]\033[0m Docker Compose not found (install docker compose plugin or docker-compose)"
            exit 1
        fi
        
        # Check deployment directory
        if [[ -d "/opt/booster" ]]; then
            echo -e "\033[0;32m[SUCCESS]\033[0m Deployment directory exists"
        else
            echo -e "\033[0;33m[WARNING]\033[0m Deployment directory does not exist - will be created"
            mkdir -p /opt/booster
        fi
        
        # Check disk space
        available_space=$(df /opt | tail -1 | awk '{print $4}')
        if [[ $available_space -gt 2097152 ]]; then  # 2GB
            echo -e "\033[0;32m[SUCCESS]\033[0m Sufficient disk space available"
        else
            echo -e "\033[0;33m[WARNING]\033[0m Low disk space: ${available_space}KB available"
        fi
        
        # Check if ports are available
        if ! netstat -tuln | grep -q ":80 "; then
            echo -e "\033[0;32m[SUCCESS]\033[0m Port 80 is available"
        else
            echo -e "\033[0;33m[WARNING]\033[0m Port 80 is in use"
        fi
        
        if ! netstat -tuln | grep -q ":443 "; then
            echo -e "\033[0;32m[SUCCESS]\033[0m Port 443 is available"
        else
            echo -e "\033[0;33m[WARNING]\033[0m Port 443 is in use"
        fi
EOF
    
    return $?
}

# Check current deployment status
check_deployment_status() {
    log_info "Checking current deployment status..."
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "Skipping remote deployment status (dry-run)"
        return 0
    fi
    
    ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" << 'EOF'
        cd /opt/booster 2>/dev/null || { echo -e "\033[0;33m[INFO]\033[0m No existing deployment found"; exit 0; }
        
        echo "=== Current Deployment Status ==="
        
        # Check if services are running
        if [[ -f "docker-compose.prod.yml" ]]; then
            echo "Docker services status:"
            docker-compose -f docker-compose.prod.yml ps 2>/dev/null || echo "No services running"
        else
            echo "No docker-compose.prod.yml found"
        fi
        
        # Check application health
        echo -e "\nApplication health:"
        curl -s http://localhost:3000/health 2>/dev/null | jq '.' || echo "Application not responding"
        
        # Check logs for errors
        echo -e "\nRecent errors in logs:"
        if [[ -d "logs" ]]; then
            find logs -name "*.log" -type f -exec grep -l "ERROR\|FATAL" {} \; 2>/dev/null | head -3 | while read logfile; do
                echo "Errors in $logfile:"
                tail -5 "$logfile" | grep "ERROR\|FATAL" || echo "No recent errors"
            done
        else
            echo "No log directory found"
        fi
EOF
}

# Main verification
main() {
    echo "🔍 BoosterBeacon Production Environment Verification"
    echo "=================================================="
    echo ""
    
    local local_check=0
    local remote_check=0
    
    # Check local environment
    if check_local_environment; then
        local_check=1
    fi
    
    echo ""
    
    # Check remote server
    if check_remote_server; then
        remote_check=1
    fi
    
    echo ""
    
    # Check deployment status
    check_deployment_status
    
    echo ""
    echo "=================================================="
    
    if [[ $local_check -eq 1 && ( "$DRY_RUN" == "true" || $remote_check -eq 1 ) ]]; then
        log_success "✅ Production environment verification passed!"
        log_info "You can now run: ./scripts/deploy.sh deploy"
        exit 0
    else
        log_error "❌ Production environment verification failed!"
        log_info "Please fix the issues above before deploying"
        exit 1
    fi
}

# Run verification
main "$@"
