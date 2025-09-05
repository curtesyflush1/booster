#!/bin/bash

# BoosterBeacon Deployment Script
# Streamlined deployment for Docker-based production environment

set -e  # Exit on any error

# Configuration
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
BACKUP_PATH="${BACKUP_PATH:-/opt/booster/backups}"
SSH_OPTS="${SSH_OPTS:-}"
RSYNC_OPTS="${RSYNC_OPTS:-}"
SERVICE_NAME="booster-beacon"
HEALTH_CHECK_URL="http://localhost:3000/health"
MAX_HEALTH_RETRIES=30
HEALTH_RETRY_DELAY=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Help function
show_help() {
    cat << EOF
BoosterBeacon Deployment Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    deploy          Deploy application to production
    rollback        Rollback to previous version
    status          Check deployment status
    backup          Create manual backup
    restore         Restore from backup
    logs            View application logs
    health          Check application health

Options:
    --env ENV       Environment (staging|production) [default: production]
    --version VER   Specific version to deploy
    --force         Force deployment without confirmation
    --no-backup     Skip backup creation during deployment
    --help          Show this help message

Examples:
    $0 deploy --env production
    $0 rollback
    $0 status
    $0 backup
    $0 logs --tail 100

EOF
}

# Parse command line arguments
COMMAND=""
ENVIRONMENT="production"
VERSION=""
FORCE=false
NO_BACKUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        deploy|rollback|status|backup|restore|logs|health)
            COMMAND="$1"
            shift
            ;;
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --no-backup)
            NO_BACKUP=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate command
if [[ -z "$COMMAND" ]]; then
    log_error "No command specified"
    show_help
    exit 1
fi

# Load environment-specific configuration
load_config() {
    local config_file="$PROJECT_ROOT/.env.$ENVIRONMENT"
    if [[ -f "$config_file" ]]; then
        log_info "Loading configuration from $config_file"
        set -a  # Automatically export variables
        # Safely load only simple KEY=VALUE lines (no spaces or parentheses)
        while IFS= read -r line; do
            # Skip comments/empty
            [[ -z "$line" || "$line" =~ ^\s*# ]] && continue
            # Only accept KEY=VALUE without spaces and parentheses
            if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= && ! "$line" =~ [\ \(\)] ]]; then
                export "$line"
            fi
        done < "$config_file"
        set +a
    else
        log_warning "Configuration file $config_file not found"
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if required tools are installed (local)
    local required_tools=("git" "ssh" "rsync" "npm")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is required but not installed"
            exit 1
        fi
    done
    
    # Check if we can connect to the deployment server
    if ! ssh $SSH_OPTS -o ConnectTimeout=10 "$DEPLOY_USER@$DEPLOY_HOST" "echo 'Connection test successful'" &> /dev/null; then
        log_error "Cannot connect to deployment server $DEPLOY_USER@$DEPLOY_HOST"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Create backup before deployment
create_backup() {
    if [[ "$NO_BACKUP" == "true" ]]; then
        log_info "Skipping backup creation (--no-backup flag)"
        return 0
    fi
    
    log_info "Creating backup before deployment..."
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_name="pre_deploy_${timestamp}"
    
    ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" << 'EOF'
        cd "$DEPLOY_PATH"
        # Resolve docker compose command
        if command -v docker-compose >/dev/null 2>&1; then DC="docker-compose"; else DC="docker compose"; fi
        
        # Create backup directory if it doesn't exist
        mkdir -p "$BACKUP_PATH"
        
        # Backup application files
        tar -czf "$BACKUP_PATH/app_${backup_name}.tar.gz" \
            --exclude=node_modules \
            --exclude=logs \
            --exclude=backups \
            .
        
        # Backup database
        if [[ -f .env ]]; then
            source .env
            if [[ -n "\$DATABASE_URL" ]]; then
                docker exec \$(docker ps -q -f name=postgres) \
                    pg_dump "\$DATABASE_URL" > "$BACKUP_PATH/db_${backup_name}.sql"
            fi
        fi
        
        echo "Backup created: ${backup_name}"
EOF
    
    if [[ $? -eq 0 ]]; then
        log_success "Backup created successfully"
        echo "$backup_name" > /tmp/last_backup_name
    else
        log_error "Backup creation failed"
        exit 1
    fi
}

# Build application
build_application() {
    log_info "Building application..."
    
    cd "$PROJECT_ROOT"
    
    # Build backend
    log_info "Building backend..."
    cd backend
    npm ci --production=false
    npm run build
    
    # Verify backend build
    if [[ ! -f "dist/index.js" ]]; then
        log_error "Backend build failed - main entry point not found"
        exit 1
    fi
    cd ..
    
    # Build frontend
    log_info "Building frontend..."
    cd frontend
    if [[ -f package-lock.json ]]; then
      npm ci --production=false
    else
      npm install --legacy-peer-deps
    fi
    npm run build
    
    # Verify frontend build
    if [[ ! -f "dist/index.html" ]]; then
        log_error "Frontend build failed - index.html not found"
        exit 1
    fi
    cd ..
    
    # Build extension (optional) — skipping for core deploy
    log_info "Skipping browser extension build for production deploy"
    
    log_success "Application built successfully"
}

# Deploy application
deploy_application() {
    log_info "Deploying application to $ENVIRONMENT..."
    
    # Confirmation prompt
    if [[ "$FORCE" != "true" ]]; then
        echo -n "Deploy to $ENVIRONMENT environment? (y/N): "
        read -r confirmation
        if [[ "$confirmation" != "y" && "$confirmation" != "Y" ]]; then
            log_info "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Create backup
    create_backup
    
    # Build application locally
    build_application
    
    # Sync files to server (preserve server-managed SSL contents)
    log_info "Syncing files to server..."
    rsync -avz --delete $RSYNC_OPTS \
        --exclude='nginx/ssl/**' \
        --exclude='.env' \
        --exclude='.env.production' \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=logs \
        --exclude=backups \
        --exclude=coverage \
        --exclude=.env.development \
        --exclude=.env.test \
        --exclude=tmp \
        --exclude=*.log \
        "$PROJECT_ROOT/" "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"
    
    # Deploy on server (inject variables into remote environment)
    ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" "DEPLOY_PATH=\"$DEPLOY_PATH\" DOMAIN=\"$DOMAIN\" bash -s" << 'EOF'
        cd "$DEPLOY_PATH"
        # Resolve docker compose command
        if command -v docker-compose >/dev/null 2>&1; then DC="docker-compose"; else DC="docker compose"; fi
        
        # Ensure production environment file exists (fallback to ./current)
        if [[ ! -f .env.production ]]; then
            if [[ -f current/.env.production ]]; then
              echo "Using environment from ./current/.env.production"
              cp current/.env.production .env.production
            elif [[ -f .env ]]; then
              echo "Found .env; proceeding with existing environment"
            elif [[ -f current/.env ]]; then
              echo "Using environment from ./current/.env"
              cp current/.env .env
            else
              echo "Production environment file not found!" >&2
              exit 1
            fi
        fi
        
        # Copy production environment
        cp .env.production .env
        
        # Prepare SSL bundle if provided on server
        mkdir -p nginx/ssl || true
        BUNDLE="boosterbeacon.com-ssl-bundle.zip"
        if [[ -f "$BUNDLE" ]]; then
          echo "Found SSL bundle: $BUNDLE"
          if command -v unzip >/dev/null 2>&1; then
            unzip -o "$BUNDLE" -d nginx/ssl || true
          elif command -v unrar >/dev/null 2>&1; then
            unrar x -o+ "$BUNDLE" nginx/ssl/ || true
          else
            echo "Warning: neither unzip nor unrar found; cannot extract SSL bundle"
          fi
          # If typical PEM names are present, update nginx cert paths
          CERT_PATH=$(find nginx/ssl -type f -name 'domain.cert.pem' | head -n1)
          KEY_PATH=$(find nginx/ssl -type f -name 'private.key.pem' | head -n1)
          if [[ -n "$CERT_PATH" && -n "$KEY_PATH" && -f nginx/nginx.conf ]]; then
            echo "Updating nginx ssl_certificate paths"
            sed -i "s#^\s*ssl_certificate\s\+.*;#        ssl_certificate /etc/ssl/${CERT_PATH#nginx/ssl/};#" nginx/nginx.conf || true
            sed -i "s#^\s*ssl_certificate_key\s\+.*;#        ssl_certificate_key /etc/ssl/${KEY_PATH#nginx/ssl/};#" nginx/nginx.conf || true
          fi
        fi
        
        # Update nginx server_name if DOMAIN env is provided
        if [[ -n "$DOMAIN" && -f nginx/nginx.conf ]]; then
            sed -i "s/server_name your-domain.com;/server_name $DOMAIN;/g" nginx/nginx.conf || true
        fi
        
        # Stop existing services gracefully
        echo "Stopping existing services..."
        $DC -f docker-compose.prod.yml down --timeout 30 || true
        
        # Clean up unused Docker resources
        docker system prune -f || true
        
        # Build and start services
        echo "Building and starting services..."
        $DC -f docker-compose.prod.yml up -d --build
        
        # Wait for services to initialize
        echo "Waiting for services to initialize..."
        sleep 45
        
        # Run database migrations
        echo "Running database migrations..."
        $DC -f docker-compose.prod.yml exec -T app sh -c "cd backend && npm run migrate:up" || true
        
        # Optional: import products from CSV if present on server
        if [[ -f backend/data/products.csv ]]; then
          echo "Found backend/data/products.csv; running importer"
          $DC -f docker-compose.prod.yml exec -T app sh -c "cd backend && npm run import:products" || true
        else
          echo "No backend/data/products.csv found; skipping import"
        fi
EOF
    
    # Health check
    if check_health; then
        log_success "Deployment completed successfully"
        
        # Show deployment status
        ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" "DEPLOY_PATH=\"$DEPLOY_PATH\" bash -s" << 'EOF'
            cd "$DEPLOY_PATH"
            echo "=== Deployment Status ==="
            if command -v docker-compose >/dev/null 2>&1; then DC="docker-compose"; else DC="docker compose"; fi
            $DC -f docker-compose.prod.yml ps
            echo ""
            echo "=== Application Health ==="
            curl -s http://localhost:3000/health | jq '.' 2>/dev/null || echo "Health endpoint not responding"
EOF
    else
        log_error "Deployment failed health check"
        rollback_deployment
        exit 1
    fi
}

# Check application health
check_health() {
    log_info "Performing health check..."
    
    local retries=0
    while [[ $retries -lt $MAX_HEALTH_RETRIES ]]; do
        if ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" "curl -f $HEALTH_CHECK_URL" &> /dev/null; then
            log_success "Health check passed"
            return 0
        fi
        
        retries=$((retries + 1))
        log_info "Health check attempt $retries/$MAX_HEALTH_RETRIES failed, retrying in ${HEALTH_RETRY_DELAY}s..."
        sleep $HEALTH_RETRY_DELAY
    done
    
    log_error "Health check failed after $MAX_HEALTH_RETRIES attempts"
    return 1
}

# Rollback deployment
rollback_deployment() {
    log_info "Rolling back deployment..."
    
    local backup_name
    if [[ -f /tmp/last_backup_name ]]; then
        backup_name=$(cat /tmp/last_backup_name)
    else
        log_error "No backup name found for rollback"
        exit 1
    fi
    
    ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" << EOF
        cd "$DEPLOY_PATH"
        
        # Stop current services
        docker-compose -f docker-compose.prod.yml down || true
        
        # Restore application files
        if [[ -f "$BACKUP_PATH/app_${backup_name}.tar.gz" ]]; then
            tar -xzf "$BACKUP_PATH/app_${backup_name}.tar.gz"
        fi
        
        # Restore database
        if [[ -f "$BACKUP_PATH/db_${backup_name}.sql" ]]; then
            source .env
            if [[ -n "\$DATABASE_URL" ]]; then
                docker exec \$(docker ps -q -f name=postgres) \
                    psql "\$DATABASE_URL" < "$BACKUP_PATH/db_${backup_name}.sql"
            fi
        fi
        
        # Restart services
        docker-compose -f docker-compose.prod.yml up -d
EOF
    
    if check_health; then
        log_success "Rollback completed successfully"
    else
        log_error "Rollback failed"
        exit 1
    fi
}

# Get deployment status
get_status() {
    log_info "Getting deployment status..."
    
    ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" << EOF
        cd "$DEPLOY_PATH"
        
        echo "=== Docker Services ==="
        docker-compose -f docker-compose.prod.yml ps
        
        echo -e "\n=== System Resources ==="
        echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
        echo "Memory Usage: $(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}')"
        echo "Disk Usage: $(df -h / | awk 'NR==2{print $5}')"
        
        echo -e "\n=== Application Health ==="
        curl -s http://localhost:3000/health | jq '.' 2>/dev/null || echo "Health check failed"
        
        echo -e "\n=== Recent Logs ==="
        docker-compose -f docker-compose.prod.yml logs --tail=10 app
EOF
}

# View logs
view_logs() {
    local tail_lines="${1:-50}"
    
    log_info "Viewing application logs (last $tail_lines lines)..."
    
    ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" << EOF
        cd "$DEPLOY_PATH"
        docker-compose -f docker-compose.prod.yml logs --tail=$tail_lines -f
EOF
}

# Main execution
main() {
    load_config
    
    case "$COMMAND" in
        deploy)
            check_prerequisites
            deploy_application
            ;;
        rollback)
            rollback_deployment
            ;;
        status)
            get_status
            ;;
        backup)
            create_backup
            ;;
        health)
            check_health
            ;;
        logs)
            view_logs "${2:-50}"
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
