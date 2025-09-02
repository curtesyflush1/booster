#!/bin/bash

# BoosterBeacon Production Deployment Enhancement Script v1.7.0
# Comprehensive production deployment with monitoring, backup, and rollback capabilities
# Updated for latest features: SEO system, price comparison, ML predictions, admin dashboard

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_HOST="${DEPLOY_HOST:-your-vps-host.com}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/booster-beacon}"
BACKUP_PATH="${BACKUP_PATH:-/opt/booster-beacon/backups}"
SERVICE_NAME="booster-beacon"
HEALTH_CHECK_URL="http://localhost:3000/health"
MAX_HEALTH_RETRIES=30
HEALTH_RETRY_DELAY=10
DEPLOYMENT_TIMEOUT=600 # 10 minutes

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

log_debug() {
    echo -e "${CYAN}[DEBUG]${NC} $1"
}

# Deployment state tracking
DEPLOYMENT_ID="deploy_$(date +%Y%m%d_%H%M%S)"
DEPLOYMENT_LOG="/tmp/booster_deployment_${DEPLOYMENT_ID}.log"
ROLLBACK_INFO="/tmp/booster_rollback_${DEPLOYMENT_ID}.json"

# Initialize deployment logging
exec 1> >(tee -a "$DEPLOYMENT_LOG")
exec 2> >(tee -a "$DEPLOYMENT_LOG" >&2)

log_info "Starting BoosterBeacon production deployment: $DEPLOYMENT_ID"
log_info "Deployment log: $DEPLOYMENT_LOG"

# Help function
show_help() {
    cat << EOF
BoosterBeacon Production Deployment Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    deploy          Full production deployment
    quick-deploy    Quick deployment (skip tests and build)
    rollback        Rollback to previous version
    status          Check deployment status
    health          Comprehensive health check
    backup          Create manual backup
    restore         Restore from backup
    logs            View application logs
    monitor         Start deployment monitoring
    cleanup         Clean old deployments and backups
    feature-check   Check status of new features (v1.7.0)

Options:
    --env ENV       Environment (staging|production) [default: production]
    --version VER   Specific version to deploy
    --force         Force deployment without confirmation
    --no-backup     Skip backup creation during deployment
    --no-tests      Skip test execution
    --no-build      Skip build process (use existing build)
    --dry-run       Show what would be deployed without executing
    --timeout SEC   Deployment timeout in seconds [default: 600]
    --help          Show this help message

Examples:
    $0 deploy --env production
    $0 quick-deploy --no-tests
    $0 rollback
    $0 status
    $0 health --verbose
    $0 monitor --duration 300

Environment Variables:
    DEPLOY_USER     SSH user for deployment server
    DEPLOY_HOST     Deployment server hostname
    DEPLOY_PATH     Application deployment path
    BACKUP_PATH     Backup storage path
    SKIP_TESTS      Skip test execution (true/false)
    FORCE_DEPLOY    Force deployment without confirmation

EOF
}

# Parse command line arguments
COMMAND=""
ENVIRONMENT="production"
VERSION=""
FORCE=false
NO_BACKUP=false
NO_TESTS=false
NO_BUILD=false
DRY_RUN=false
VERBOSE=false
MONITOR_DURATION=0

while [[ $# -gt 0 ]]; do
    case $1 in
        deploy|quick-deploy|rollback|status|health|backup|restore|logs|monitor|cleanup|feature-check)
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
        --no-tests)
            NO_TESTS=true
            shift
            ;;
        --no-build)
            NO_BUILD=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --timeout)
            DEPLOYMENT_TIMEOUT="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --duration)
            MONITOR_DURATION="$2"
            shift 2
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
        source "$config_file"
        set +a
    else
        log_warning "Configuration file $config_file not found"
    fi
    
    # Override with environment variables
    [[ -n "$SKIP_TESTS" ]] && NO_TESTS=true
    [[ -n "$FORCE_DEPLOY" ]] && FORCE=true
    
    # Validate critical new environment variables for v1.7.0
    log_info "Validating environment configuration for v1.7.0..."
    
    # Check for ML service configuration
    if [[ -z "$ML_MODEL_PATH" ]]; then
        log_warning "ML_MODEL_PATH not set - ML predictions may not work"
    fi
    
    # Check for price comparison service configuration
    if [[ -z "$PRICE_COMPARISON_CACHE_TTL" ]]; then
        log_info "PRICE_COMPARISON_CACHE_TTL not set - using default"
    fi
    
    # Check for SEO configuration
    if [[ -z "$SEO_BASE_URL" ]]; then
        log_warning "SEO_BASE_URL not set - SEO features may not work properly"
    fi
    
    # Check for admin dashboard configuration
    if [[ -z "$ADMIN_SESSION_SECRET" ]]; then
        log_warning "ADMIN_SESSION_SECRET not set - admin sessions may not be secure"
    fi
    
    # Check for new retailer API keys
    local retailer_apis=("BESTBUY_API_KEY" "WALMART_API_KEY" "COSTCO_API_KEY" "SAMS_CLUB_API_KEY")
    for api_key in "${retailer_apis[@]}"; do
        if [[ -z "${!api_key}" ]]; then
            log_warning "$api_key not set - retailer integration may be limited"
        fi
    done
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking deployment prerequisites..."
    
    # Check if required tools are installed
    local required_tools=("docker" "docker-compose" "git" "ssh" "rsync" "jq" "curl" "bc" "pg_dump")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is required but not installed"
            exit 1
        fi
    done
    
    # Check Node.js version (required 18+)
    if command -v node &> /dev/null; then
        local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $node_version -lt 18 ]]; then
            log_error "Node.js 18+ is required, found version $node_version"
            exit 1
        fi
        log_success "Node.js version check passed: $(node --version)"
    else
        log_error "Node.js is required but not installed"
        exit 1
    fi
    
    # Check npm version (required 9+)
    if command -v npm &> /dev/null; then
        local npm_version=$(npm --version | cut -d'.' -f1)
        if [[ $npm_version -lt 9 ]]; then
            log_error "npm 9+ is required, found version $npm_version"
            exit 1
        fi
        log_success "npm version check passed: $(npm --version)"
    else
        log_error "npm is required but not installed"
        exit 1
    fi
    
    # Check if we can connect to the deployment server
    if ! ssh -o ConnectTimeout=10 "$DEPLOY_USER@$DEPLOY_HOST" "echo 'Connection test successful'" &> /dev/null; then
        log_error "Cannot connect to deployment server $DEPLOY_USER@$DEPLOY_HOST"
        log_info "Please ensure SSH key authentication is set up"
        exit 1
    fi
    
    # Check disk space on deployment server
    local available_space=$(ssh "$DEPLOY_USER@$DEPLOY_HOST" "df $DEPLOY_PATH | tail -1 | awk '{print \$4}'")
    if [[ $available_space -lt 1048576 ]]; then # Less than 1GB
        log_warning "Low disk space on deployment server: ${available_space}KB available"
    fi
    
    log_success "Prerequisites check passed"
}

# Pre-deployment validation
validate_deployment() {
    log_step "Validating deployment readiness..."
    
    cd "$PROJECT_ROOT"
    
    # Check git status
    if [[ -n "$(git status --porcelain)" ]]; then
        log_warning "Working directory has uncommitted changes"
        if [[ "$FORCE" != "true" ]]; then
            log_error "Use --force to deploy with uncommitted changes"
            exit 1
        fi
    fi
    
    # Check if on main/master branch for production
    if [[ "$ENVIRONMENT" == "production" ]]; then
        local current_branch=$(git branch --show-current)
        if [[ "$current_branch" != "main" && "$current_branch" != "master" ]]; then
            log_warning "Not on main/master branch for production deployment"
            if [[ "$FORCE" != "true" ]]; then
                log_error "Use --force to deploy from non-main branch to production"
                exit 1
            fi
        fi
    fi
    
    # Validate environment files
    if [[ ! -f ".env.$ENVIRONMENT" ]]; then
        log_error "Environment file .env.$ENVIRONMENT not found"
        exit 1
    fi
    
    # Check for required environment variables
    local required_env_vars=("DATABASE_URL" "REDIS_URL" "JWT_SECRET")
    source ".env.$ENVIRONMENT"
    
    for var in "${required_env_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            log_error "Required environment variable $var is not set in .env.$ENVIRONMENT"
            exit 1
        fi
    done
    
    # Validate workspace structure for monorepo
    local required_dirs=("backend" "frontend" "extension" "scripts")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            log_error "Required directory $dir not found"
            exit 1
        fi
    done
    
    # Check for package.json files
    local package_files=("package.json" "backend/package.json" "frontend/package.json" "extension/package.json")
    for file in "${package_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Required package file $file not found"
            exit 1
        fi
    done
    
    log_success "Deployment validation passed"
}

# Run tests
run_tests() {
    if [[ "$NO_TESTS" == "true" ]]; then
        log_info "Skipping tests (--no-tests flag)"
        return 0
    fi
    
    log_step "Running test suite..."
    
    cd "$PROJECT_ROOT"
    
    # Backend tests
    log_info "Running backend tests..."
    cd backend
    if ! npm test -- --passWithNoTests; then
        log_error "Backend tests failed"
        return 1
    fi
    cd ..
    
    # Frontend tests
    log_info "Running frontend tests..."
    cd frontend
    if ! npm test -- --passWithNoTests --watchAll=false; then
        log_error "Frontend tests failed"
        return 1
    fi
    cd ..
    
    # Extension tests
    log_info "Running extension tests..."
    cd extension
    if ! npm test -- --passWithNoTests; then
        log_error "Extension tests failed"
        return 1
    fi
    cd ..
    
    # Integration tests
    log_info "Running integration tests..."
    cd backend
    if ! npm run test:integration; then
        log_warning "Integration tests failed (continuing deployment)"
        # Log specific test failures for debugging
        log_info "Check test logs for integration test failures"
    fi
    cd ..
    
    # Run linting for all components
    log_info "Running linting checks..."
    if ! npm run lint; then
        log_warning "Linting issues found (continuing deployment)"
    fi
    
    log_success "Test suite completed"
}

# Build application
build_application() {
    if [[ "$NO_BUILD" == "true" ]]; then
        log_info "Skipping build (--no-build flag)"
        return 0
    fi
    
    log_step "Building application..."
    
    cd "$PROJECT_ROOT"
    
    # Install root dependencies
    log_info "Installing root dependencies..."
    npm ci --production=false
    
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
    npm ci --production=false
    npm run build
    
    # Verify frontend build
    if [[ ! -f "dist/index.html" ]]; then
        log_error "Frontend build failed - index.html not found"
        exit 1
    fi
    cd ..
    
    # Build extension for both browsers
    log_info "Building extension..."
    cd extension
    npm ci --production=false
    npm run build:chrome
    npm run build:firefox
    
    # Verify extension builds
    if [[ ! -d "dist" ]]; then
        log_error "Extension build failed - dist directory not found"
        exit 1
    fi
    cd ..
    
    # Verify builds
    if [[ ! -d "backend/dist" ]]; then
        log_error "Backend build failed - dist directory not found"
        exit 1
    fi
    
    if [[ ! -d "frontend/dist" ]]; then
        log_error "Frontend build failed - dist directory not found"
        exit 1
    fi
    
    if [[ ! -d "extension/dist" ]]; then
        log_error "Extension build failed - dist directory not found"
        exit 1
    fi
    
    log_success "Application built successfully"
}

# Create deployment backup
create_deployment_backup() {
    if [[ "$NO_BACKUP" == "true" ]]; then
        log_info "Skipping backup creation (--no-backup flag)"
        return 0
    fi
    
    log_step "Creating pre-deployment backup..."
    
    local backup_name="pre_deploy_${DEPLOYMENT_ID}"
    
    ssh "$DEPLOY_USER@$DEPLOY_HOST" << EOF
        set -e
        cd "$DEPLOY_PATH"
        
        # Create backup directory if it doesn't exist
        mkdir -p "$BACKUP_PATH"
        
        # Create rollback info
        cat > "$BACKUP_PATH/rollback_${DEPLOYMENT_ID}.json" << EOJ
{
  "deployment_id": "$DEPLOYMENT_ID",
  "timestamp": "$(date -Iseconds)",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "environment": "$ENVIRONMENT",
  "backup_name": "$backup_name"
}
EOJ
        
        # Backup application files
        echo "Creating application backup..."
        tar -czf "$BACKUP_PATH/app_${backup_name}.tar.gz" \
            --exclude=node_modules \
            --exclude=logs \
            --exclude=backups \
            --exclude=coverage \
            --exclude=.git \
            . 2>/dev/null || true
        
        # Backup database
        echo "Creating database backup..."
        if [[ -f .env ]]; then
            source .env
            if [[ -n "\$DATABASE_URL" ]]; then
                # Extract database name from URL
                DB_NAME=\$(echo "\$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
                if [[ -n "\$DB_NAME" ]]; then
                    docker exec \$(docker ps -q -f name=postgres) \
                        pg_dump "\$DATABASE_URL" > "$BACKUP_PATH/db_${backup_name}.sql" 2>/dev/null || \
                        echo "Database backup failed (continuing deployment)"
                fi
            fi
        fi
        
        # Backup environment files
        echo "Backing up configuration..."
        cp .env* "$BACKUP_PATH/" 2>/dev/null || true
        
        echo "Backup created: ${backup_name}"
EOF
    
    if [[ $? -eq 0 ]]; then
        log_success "Backup created successfully: $backup_name"
        echo "$backup_name" > /tmp/last_backup_name
        
        # Store rollback info locally
        cat > "$ROLLBACK_INFO" << EOF
{
  "deployment_id": "$DEPLOYMENT_ID",
  "backup_name": "$backup_name",
  "timestamp": "$(date -Iseconds)",
  "environment": "$ENVIRONMENT"
}
EOF
    else
        log_error "Backup creation failed"
        exit 1
    fi
}

# Deploy application files
deploy_application_files() {
    log_step "Deploying application files..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would sync files to $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH"
        return 0
    fi
    
    # Sync files to server
    log_info "Syncing files to server..."
    rsync -avz --delete \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=logs \
        --exclude=backups \
        --exclude=coverage \
        --exclude=.env \
        --exclude=.env.* \
        --exclude=*.log \
        --exclude=tmp \
        --progress \
        "$PROJECT_ROOT/" "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"
    
    # Copy environment file
    log_info "Deploying environment configuration..."
    scp "$PROJECT_ROOT/.env.$ENVIRONMENT" "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/.env"
    
    log_success "Application files deployed"
}

# Deploy services
deploy_services() {
    log_step "Deploying services..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would deploy services"
        return 0
    fi
    
    ssh "$DEPLOY_USER@$DEPLOY_HOST" << EOF
        set -e
        cd "$DEPLOY_PATH"
        
        # Load environment variables
        source .env
        
        # Stop existing services gracefully
        echo "Stopping existing services..."
        docker-compose -f docker-compose.prod.yml down --timeout 30 || true
        
        # Clean up orphaned containers
        docker container prune -f || true
        
        # Pull latest images
        echo "Pulling latest Docker images..."
        docker-compose -f docker-compose.prod.yml pull
        
        # Install production dependencies
        echo "Installing production dependencies..."
        cd backend && npm ci --production && cd ..
        
        # Run database migrations
        echo "Running database migrations..."
        cd backend && npm run migrate:up && cd ..
        
        # Verify database schema
        echo "Verifying database schema..."
        cd backend
        if ! npm run migrate:status 2>/dev/null; then
            echo "Warning: Could not verify migration status"
        fi
        
        # Check for new tables added in v1.7.0
        echo "Verifying new database tables for v1.7.0..."
        if [[ -n "\$DATABASE_URL" ]]; then
            # Check for ML tables
            docker exec \$(docker ps -q -f name=postgres) \
                psql "\$DATABASE_URL" -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ml_price_predictions');" || \
                echo "ML tables may not be created yet"
            
            # Check for price comparison tables
            docker exec \$(docker ps -q -f name=postgres) \
                psql "\$DATABASE_URL" -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'price_comparisons');" || \
                echo "Price comparison tables may not be created yet"
            
            # Check for admin audit tables
            docker exec \$(docker ps -q -f name=postgres) \
                psql "\$DATABASE_URL" -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'admin_audit_logs');" || \
                echo "Admin audit tables may not be created yet"
        fi
        cd ..
        
        # Start services
        echo "Starting services..."
        docker-compose -f docker-compose.prod.yml up -d
        
        # Wait for services to initialize
        echo "Waiting for services to initialize..."
        sleep 30
        
        # Initialize new services for v1.7.0
        echo "Initializing new services..."
        
        # Start ML data collection service
        docker-compose -f docker-compose.prod.yml exec -T app \
            node -e "require('./backend/dist/services/dataCollectionService').DataCollectionService.scheduleDataCollection()" || \
            echo "ML data collection service initialization failed"
        
        # Initialize price comparison cache
        docker-compose -f docker-compose.prod.yml exec -T app \
            node -e "require('./backend/dist/services/priceComparisonService').initializeCache()" || \
            echo "Price comparison cache initialization failed"
        
        # Generate initial sitemaps
        docker-compose -f docker-compose.prod.yml exec -T app \
            node -e "require('./backend/dist/services/sitemapService').generateAllSitemaps()" || \
            echo "Sitemap generation failed"
EOF
    
    log_success "Services deployed"
}

# Comprehensive health check
perform_health_check() {
    log_step "Performing comprehensive health check..."
    
    local retries=0
    local health_passed=false
    
    while [[ $retries -lt $MAX_HEALTH_RETRIES ]]; do
        log_info "Health check attempt $((retries + 1))/$MAX_HEALTH_RETRIES..."
        
        # Basic health check
        if ssh "$DEPLOY_USER@$DEPLOY_HOST" "curl -f -s $HEALTH_CHECK_URL" &> /dev/null; then
            log_success "Basic health check passed"
            
            # Detailed health check
            local health_response=$(ssh "$DEPLOY_USER@$DEPLOY_HOST" "curl -s $HEALTH_CHECK_URL/detailed" 2>/dev/null)
            
            if [[ -n "$health_response" ]]; then
                # Parse health response
                local db_status=$(echo "$health_response" | jq -r '.database.status' 2>/dev/null || echo "unknown")
                local redis_status=$(echo "$health_response" | jq -r '.redis.status' 2>/dev/null || echo "unknown")
                
                if [[ "$db_status" == "healthy" && "$redis_status" == "healthy" ]]; then
                    log_success "Detailed health check passed"
                    health_passed=true
                    break
                else
                    log_warning "Detailed health check failed - DB: $db_status, Redis: $redis_status"
                fi
            else
                log_warning "Could not retrieve detailed health status"
            fi
        else
            log_warning "Basic health check failed"
        fi
        
        retries=$((retries + 1))
        if [[ $retries -lt $MAX_HEALTH_RETRIES ]]; then
            log_info "Retrying in ${HEALTH_RETRY_DELAY}s..."
            sleep $HEALTH_RETRY_DELAY
        fi
    done
    
    if [[ "$health_passed" != "true" ]]; then
        log_error "Health check failed after $MAX_HEALTH_RETRIES attempts"
        return 1
    fi
    
    # Additional service checks
    log_info "Performing additional service checks..."
    
    # Check API endpoints (updated for v1.7.0)
    local api_endpoints=(
        "/api/v1/status"
        "/health"
        "/health/detailed"
        "/api/products/search?q=test&limit=1"
        "/api/price-comparison/deals?limit=1"
        "/api/ml/trending-products?limit=1"
        "/api/admin/dashboard/stats"
    )
    
    for endpoint in "${api_endpoints[@]}"; do
        local url="http://localhost:3000$endpoint"
        if ssh "$DEPLOY_USER@$DEPLOY_HOST" "curl -f -s '$url'" &> /dev/null; then
            log_success "API endpoint $endpoint is responsive"
        else
            log_warning "API endpoint $endpoint is not responsive"
        fi
    done
    
    # Check Docker services
    local service_status=$(ssh "$DEPLOY_USER@$DEPLOY_HOST" "cd $DEPLOY_PATH && docker-compose -f docker-compose.prod.yml ps --format json" 2>/dev/null)
    if [[ -n "$service_status" ]]; then
        log_success "Docker services are running"
        if [[ "$VERBOSE" == "true" ]]; then
            echo "$service_status" | jq -r '.[] | "\(.Name): \(.State)"'
        fi
    else
        log_warning "Could not retrieve Docker service status"
    fi
    
    log_success "Comprehensive health check completed"
}

# Verify new features and services (v1.7.0)
verify_new_features() {
    log_step "Verifying new features and services..."
    
    # Test ML prediction endpoints
    log_info "Testing ML prediction services..."
    local ml_endpoints=(
        "/api/ml/trending-products"
        "/api/ml/predictions/price/test-product-1"
        "/api/ml/predictions/sellout/test-product-1"
    )
    
    for endpoint in "${ml_endpoints[@]}"; do
        local status_code=$(ssh "$DEPLOY_USER@$DEPLOY_HOST" "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000$endpoint" 2>/dev/null || echo "000")
        if [[ "$status_code" == "200" || "$status_code" == "404" ]]; then
            log_success "ML endpoint $endpoint is accessible"
        else
            log_warning "ML endpoint $endpoint returned status: $status_code"
        fi
    done
    
    # Test price comparison endpoints
    log_info "Testing price comparison services..."
    local price_endpoints=(
        "/api/price-comparison/deals"
        "/api/price-comparison/trending"
    )
    
    for endpoint in "${price_endpoints[@]}"; do
        local status_code=$(ssh "$DEPLOY_USER@$DEPLOY_HOST" "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000$endpoint" 2>/dev/null || echo "000")
        if [[ "$status_code" == "200" ]]; then
            log_success "Price comparison endpoint $endpoint is working"
        else
            log_warning "Price comparison endpoint $endpoint returned status: $status_code"
        fi
    done
    
    # Test SEO and sitemap generation
    log_info "Testing SEO and sitemap services..."
    local seo_endpoints=(
        "/sitemap.xml"
        "/robots.txt"
        "/api/seo/meta-tags"
    )
    
    for endpoint in "${seo_endpoints[@]}"; do
        local status_code=$(ssh "$DEPLOY_USER@$DEPLOY_HOST" "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000$endpoint" 2>/dev/null || echo "000")
        if [[ "$status_code" == "200" ]]; then
            log_success "SEO endpoint $endpoint is working"
        else
            log_warning "SEO endpoint $endpoint returned status: $status_code"
        fi
    done
    
    # Test admin dashboard (requires authentication)
    log_info "Testing admin dashboard accessibility..."
    local admin_status=$(ssh "$DEPLOY_USER@$DEPLOY_HOST" "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/admin/dashboard/stats" 2>/dev/null || echo "000")
    if [[ "$admin_status" == "401" || "$admin_status" == "403" ]]; then
        log_success "Admin dashboard is protected (status: $admin_status)"
    elif [[ "$admin_status" == "200" ]]; then
        log_warning "Admin dashboard is accessible without authentication"
    else
        log_warning "Admin dashboard returned unexpected status: $admin_status"
    fi
    
    # Test CSV import/export endpoints
    log_info "Testing CSV import/export services..."
    local csv_status=$(ssh "$DEPLOY_USER@$DEPLOY_HOST" "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/csv/template/watches" 2>/dev/null || echo "000")
    if [[ "$csv_status" == "200" ]]; then
        log_success "CSV services are working"
    else
        log_warning "CSV services returned status: $csv_status"
    fi
    
    log_success "New features verification completed"
}

# Post-deployment verification
verify_deployment() {
    log_step "Verifying deployment..."
    
    # Check application version
    local deployed_version=$(ssh "$DEPLOY_USER@$DEPLOY_HOST" "cd $DEPLOY_PATH && git rev-parse HEAD 2>/dev/null || echo 'unknown'")
    local local_version=$(cd "$PROJECT_ROOT" && git rev-parse HEAD 2>/dev/null || echo 'unknown')
    
    if [[ "$deployed_version" == "$local_version" ]]; then
        log_success "Version verification passed: $deployed_version"
    else
        log_warning "Version mismatch - Local: $local_version, Deployed: $deployed_version"
    fi
    
    # Check file permissions
    ssh "$DEPLOY_USER@$DEPLOY_HOST" << EOF
        cd "$DEPLOY_PATH"
        
        # Check critical file permissions
        if [[ -r .env && -r package.json && -x backend/dist/index.js ]]; then
            echo "File permissions are correct"
        else
            echo "File permission issues detected"
        fi
EOF
    
    # Performance verification
    log_info "Checking application performance..."
    local response_time=$(ssh "$DEPLOY_USER@$DEPLOY_HOST" "curl -s -o /dev/null -w '%{time_total}' http://localhost:3000/health" 2>/dev/null || echo "0")
    
    if [[ $(echo "$response_time < 2.0" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
        log_success "Response time is acceptable: ${response_time}s"
    else
        log_warning "Response time is slow: ${response_time}s"
    fi
    
    log_success "Deployment verification completed"
}

# Rollback deployment
rollback_deployment() {
    log_step "Rolling back deployment..."
    
    local backup_name
    if [[ -f /tmp/last_backup_name ]]; then
        backup_name=$(cat /tmp/last_backup_name)
    elif [[ -f "$ROLLBACK_INFO" ]]; then
        backup_name=$(jq -r '.backup_name' "$ROLLBACK_INFO")
    else
        log_error "No backup information found for rollback"
        exit 1
    fi
    
    log_info "Rolling back to backup: $backup_name"
    
    ssh "$DEPLOY_USER@$DEPLOY_HOST" << EOF
        set -e
        cd "$DEPLOY_PATH"
        
        # Stop current services
        echo "Stopping current services..."
        docker-compose -f docker-compose.prod.yml down --timeout 30 || true
        
        # Restore application files
        if [[ -f "$BACKUP_PATH/app_${backup_name}.tar.gz" ]]; then
            echo "Restoring application files..."
            tar -xzf "$BACKUP_PATH/app_${backup_name}.tar.gz"
        else
            echo "Application backup not found: $BACKUP_PATH/app_${backup_name}.tar.gz"
            exit 1
        fi
        
        # Restore database
        if [[ -f "$BACKUP_PATH/db_${backup_name}.sql" ]]; then
            echo "Restoring database..."
            source .env
            if [[ -n "\$DATABASE_URL" ]]; then
                docker exec \$(docker ps -q -f name=postgres) \
                    psql "\$DATABASE_URL" < "$BACKUP_PATH/db_${backup_name}.sql" || \
                    echo "Database restore failed (continuing rollback)"
            fi
        fi
        
        # Restart services
        echo "Restarting services..."
        docker-compose -f docker-compose.prod.yml up -d
        
        # Wait for services
        sleep 30
EOF
    
    # Verify rollback
    if perform_health_check; then
        log_success "Rollback completed successfully"
    else
        log_error "Rollback failed - manual intervention required"
        exit 1
    fi
}

# Get deployment status
get_deployment_status() {
    log_step "Getting deployment status..."
    
    ssh "$DEPLOY_USER@$DEPLOY_HOST" << 'EOF'
        cd /opt/booster-beacon
        
        echo "=== Deployment Information ==="
        echo "Deployment Path: $(pwd)"
        echo "Git Commit: $(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
        echo "Git Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
        echo "Last Modified: $(stat -c %y .env 2>/dev/null || echo 'unknown')"
        
        echo -e "\n=== Docker Services ==="
        docker-compose -f docker-compose.prod.yml ps
        
        echo -e "\n=== System Resources ==="
        echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
        echo "Memory Usage: $(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}')"
        echo "Disk Usage: $(df -h / | awk 'NR==2{print $5}')"
        
        echo -e "\n=== Application Health ==="
        curl -s http://localhost:3000/health | jq '.' 2>/dev/null || echo "Health check failed"
        
        echo -e "\n=== Detailed Health Check ==="
        curl -s http://localhost:3000/health/detailed | jq '.' 2>/dev/null || echo "Detailed health check failed"
        
        echo -e "\n=== New Features Status ==="
        echo "Price Comparison API: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/price-comparison/deals?limit=1)"
        echo "ML Predictions API: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/ml/trending-products?limit=1)"
        echo "Admin Dashboard API: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/admin/dashboard/stats)"
        echo "SEO Sitemap: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/sitemap.xml)"
        
        echo -e "\n=== Recent Logs ==="
        docker-compose -f docker-compose.prod.yml logs --tail=10 app 2>/dev/null || echo "Could not retrieve logs"
        
        echo -e "\n=== Available Backups ==="
        ls -la "$BACKUP_PATH" 2>/dev/null | tail -5 || echo "No backups found"
EOF
}

# Monitor deployment
monitor_deployment() {
    local duration=${MONITOR_DURATION:-300} # Default 5 minutes
    log_step "Monitoring deployment for ${duration} seconds..."
    
    local start_time=$(date +%s)
    local end_time=$((start_time + duration))
    
    while [[ $(date +%s) -lt $end_time ]]; do
        # Check health
        if ssh "$DEPLOY_USER@$DEPLOY_HOST" "curl -f -s http://localhost:3000/health" &> /dev/null; then
            echo -n "✓"
        else
            echo -n "✗"
        fi
        
        sleep 10
    done
    
    echo ""
    log_success "Monitoring completed"
}

# Cleanup old deployments and backups
cleanup_old_deployments() {
    log_step "Cleaning up old deployments and backups..."
    
    ssh "$DEPLOY_USER@$DEPLOY_HOST" << EOF
        cd "$BACKUP_PATH"
        
        # Keep last 10 backups
        echo "Cleaning up old backups..."
        ls -t app_*.tar.gz 2>/dev/null | tail -n +11 | xargs rm -f
        ls -t db_*.sql 2>/dev/null | tail -n +11 | xargs rm -f
        ls -t rollback_*.json 2>/dev/null | tail -n +11 | xargs rm -f
        
        # Clean up Docker
        echo "Cleaning up Docker resources..."
        docker system prune -f
        docker volume prune -f
        
        echo "Cleanup completed"
EOF
    
    log_success "Cleanup completed"
}

# Main deployment function
deploy_full() {
    local start_time=$(date +%s)
    
    log_info "Starting full production deployment to $ENVIRONMENT environment"
    
    # Confirmation prompt
    if [[ "$FORCE" != "true" && "$DRY_RUN" != "true" ]]; then
        echo -n "Deploy to $ENVIRONMENT environment? (y/N): "
        read -r confirmation
        if [[ "$confirmation" != "y" && "$confirmation" != "Y" ]]; then
            log_info "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Execute deployment steps
    check_prerequisites
    validate_deployment
    run_tests
    build_application
    create_deployment_backup
    deploy_application_files
    deploy_services
    
    # Health check with timeout
    timeout $DEPLOYMENT_TIMEOUT bash -c 'perform_health_check' || {
        log_error "Deployment health check timed out"
        log_info "Initiating automatic rollback..."
        rollback_deployment
        exit 1
    }
    
    verify_deployment
    verify_new_features
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "Deployment completed successfully in ${duration} seconds"
    log_info "Deployment ID: $DEPLOYMENT_ID"
    log_info "Deployment log: $DEPLOYMENT_LOG"
    
    # Post-deployment monitoring
    if [[ "$MONITOR_DURATION" -gt 0 ]]; then
        monitor_deployment
    fi
}

# Quick deployment function
deploy_quick() {
    log_info "Starting quick deployment (skipping tests and build verification)"
    
    NO_TESTS=true
    
    deploy_full
}

# Main execution
main() {
    load_config
    
    case "$COMMAND" in
        deploy)
            deploy_full
            ;;
        quick-deploy)
            deploy_quick
            ;;
        rollback)
            rollback_deployment
            ;;
        status)
            get_deployment_status
            ;;
        health)
            perform_health_check
            ;;
        backup)
            create_deployment_backup
            ;;
        monitor)
            monitor_deployment
            ;;
        cleanup)
            cleanup_old_deployments
            ;;
        logs)
            ssh "$DEPLOY_USER@$DEPLOY_HOST" "cd $DEPLOY_PATH && docker-compose -f docker-compose.prod.yml logs -f --tail=${2:-50}"
            ;;
        feature-check)
            verify_new_features
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Trap for cleanup on exit
cleanup_on_exit() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        log_error "Deployment failed with exit code $exit_code"
        log_info "Deployment log available at: $DEPLOYMENT_LOG"
        
        if [[ -f "$ROLLBACK_INFO" ]]; then
            log_info "Rollback information available at: $ROLLBACK_INFO"
        fi
    fi
}

trap cleanup_on_exit EXIT

# Run main function
main "$@"
