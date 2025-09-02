#!/bin/bash

# BoosterBeacon Quick Deployment Script
# For rapid deployment without full build process

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_USER="${DEPLOY_USER:-derek}"
DEPLOY_HOST="${DEPLOY_HOST:-82.180.162.48}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/booster}"

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

# Quick deployment function
quick_deploy() {
    log_info "Starting quick deployment..."
    
    cd "$PROJECT_ROOT"
    
    # Quick build check
    if [[ ! -f "backend/dist/index.js" ]]; then
        log_warning "Backend not built, building now..."
        cd backend && npm run build && cd ..
    fi
    
    if [[ ! -f "frontend/dist/index.html" ]]; then
        log_warning "Frontend not built, building now..."
        cd frontend && npm run build && cd ..
    fi
    
    # Sync only essential files
    log_info "Syncing files to server..."
    rsync -avz --delete \
        --include='backend/dist/' \
        --include='backend/dist/**' \
        --include='frontend/dist/' \
        --include='frontend/dist/**' \
        --include='extension/dist/' \
        --include='extension/dist/**' \
        --include='docker-compose.prod.yml' \
        --include='Dockerfile.prod' \
        --include='.env.production' \
        --include='nginx/' \
        --include='nginx/**' \
        --include='monitoring/' \
        --include='monitoring/**' \
        --include='backend/migrations/' \
        --include='backend/migrations/**' \
        --include='backend/package.json' \
        --include='backend/knexfile.js' \
        --exclude='*' \
        "$PROJECT_ROOT/" "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"
    
    # Restart services
    log_info "Restarting services..."
    ssh "$DEPLOY_USER@$DEPLOY_HOST" << EOF
        cd "$DEPLOY_PATH"
        
        # Copy production environment
        cp .env.production .env
        
        # Restart only the app container
        docker-compose -f docker-compose.prod.yml up -d --no-deps app
        
        # Wait a moment
        sleep 10
        
        # Check status
        docker-compose -f docker-compose.prod.yml ps
        
        # Quick health check
        curl -f http://localhost:3000/health || echo "Health check failed"
EOF
    
    log_success "Quick deployment completed!"
}

# Health check function
check_health() {
    log_info "Performing health check..."
    
    local retries=0
    local max_retries=10
    
    while [[ $retries -lt $max_retries ]]; do
        if ssh "$DEPLOY_USER@$DEPLOY_HOST" "curl -f -s http://localhost:3000/health" &> /dev/null; then
            log_success "Health check passed"
            return 0
        fi
        
        retries=$((retries + 1))
        log_info "Health check attempt $retries/$max_retries failed, retrying in 5s..."
        sleep 5
    done
    
    log_error "Health check failed after $max_retries attempts"
    return 1
}

# Show status
show_status() {
    log_info "Getting deployment status..."
    
    ssh "$DEPLOY_USER@$DEPLOY_HOST" << 'EOF'
        cd /opt/booster
        
        echo "=== Docker Services ==="
        docker-compose -f docker-compose.prod.yml ps
        
        echo -e "\n=== Application Health ==="
        curl -s http://localhost:3000/health | jq '.' 2>/dev/null || echo "Health check failed"
        
        echo -e "\n=== Recent Logs (last 20 lines) ==="
        docker-compose -f docker-compose.prod.yml logs --tail=20 app
EOF
}

# Main execution
case "${1:-deploy}" in
    deploy)
        quick_deploy
        check_health
        ;;
    status)
        show_status
        ;;
    health)
        check_health
        ;;
    *)
        echo "Usage: $0 [deploy|status|health]"
        exit 1
        ;;
esac
