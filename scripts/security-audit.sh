#!/bin/bash

# BoosterBeacon Security Audit Script
# Performs comprehensive security testing and vulnerability assessment

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AUDIT_REPORT_DIR="$PROJECT_ROOT/security-audit-reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$AUDIT_REPORT_DIR/security_audit_$TIMESTAMP.md"

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

# Create audit report directory
mkdir -p "$AUDIT_REPORT_DIR"

# Initialize report
cat > "$REPORT_FILE" << EOF
# BoosterBeacon Security Audit Report

**Date:** $(date)
**Auditor:** Automated Security Audit Script
**Version:** $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

## Executive Summary

This report contains the results of a comprehensive security audit performed on the BoosterBeacon application.

## Audit Scope

- Dependency vulnerability scanning
- Code security analysis
- Authentication and authorization testing
- Input validation testing
- API security testing
- Configuration security review
- Docker security assessment
- SSL/TLS configuration review

---

EOF

log_info "Starting comprehensive security audit..."

# 1. Dependency Vulnerability Scanning
log_info "Scanning for dependency vulnerabilities..."
echo "## 1. Dependency Vulnerability Scan" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

cd "$PROJECT_ROOT"

# Backend dependencies
echo "### Backend Dependencies" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
cd backend
if npm audit --audit-level=moderate >> "$REPORT_FILE" 2>&1; then
    log_success "Backend dependencies: No high/critical vulnerabilities found"
    echo "✅ No high/critical vulnerabilities found" >> "$REPORT_FILE"
else
    log_warning "Backend dependencies: Vulnerabilities detected"
    echo "⚠️ Vulnerabilities detected - see details above" >> "$REPORT_FILE"
fi
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Frontend dependencies
cd "$PROJECT_ROOT/frontend"
echo "### Frontend Dependencies" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
if npm audit --audit-level=moderate >> "$REPORT_FILE" 2>&1; then
    log_success "Frontend dependencies: No high/critical vulnerabilities found"
    echo "✅ No high/critical vulnerabilities found" >> "$REPORT_FILE"
else
    log_warning "Frontend dependencies: Vulnerabilities detected"
    echo "⚠️ Vulnerabilities detected - see details above" >> "$REPORT_FILE"
fi
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Extension dependencies
cd "$PROJECT_ROOT/extension"
echo "### Extension Dependencies" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
if npm audit --audit-level=moderate >> "$REPORT_FILE" 2>&1; then
    log_success "Extension dependencies: No high/critical vulnerabilities found"
    echo "✅ No high/critical vulnerabilities found" >> "$REPORT_FILE"
else
    log_warning "Extension dependencies: Vulnerabilities detected"
    echo "⚠️ Vulnerabilities detected - see details above" >> "$REPORT_FILE"
fi
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 2. Code Security Analysis
log_info "Performing code security analysis..."
echo "## 2. Code Security Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

cd "$PROJECT_ROOT"

# Check for common security issues
echo "### Security Pattern Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Check for hardcoded secrets
log_info "Scanning for hardcoded secrets..."
echo "#### Hardcoded Secrets Scan" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

SECRET_PATTERNS=(
    "password\s*=\s*['\"][^'\"]{8,}['\"]"
    "api[_-]?key\s*=\s*['\"][^'\"]{16,}['\"]"
    "secret\s*=\s*['\"][^'\"]{16,}['\"]"
    "token\s*=\s*['\"][^'\"]{20,}['\"]"
    "jwt[_-]?secret\s*=\s*['\"][^'\"]{16,}['\"]"
)

secrets_found=false
for pattern in "${SECRET_PATTERNS[@]}"; do
    if grep -r -i -E "$pattern" --include="*.ts" --include="*.js" --include="*.json" . --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=coverage; then
        secrets_found=true
    fi
done

if [ "$secrets_found" = false ]; then
    log_success "No hardcoded secrets detected"
    echo "✅ No hardcoded secrets detected" >> "$REPORT_FILE"
else
    log_warning "Potential hardcoded secrets found"
    echo "⚠️ Potential hardcoded secrets detected - review above results" >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"

# Check for SQL injection vulnerabilities
log_info "Scanning for SQL injection vulnerabilities..."
echo "#### SQL Injection Vulnerability Scan" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if grep -r -E "(query|execute)\s*\(\s*['\"][^'\"]*\+|query.*\$\{|execute.*\$\{" --include="*.ts" --include="*.js" backend/src/ || true; then
    log_warning "Potential SQL injection vulnerabilities found"
    echo "⚠️ Potential SQL injection patterns detected" >> "$REPORT_FILE"
else
    log_success "No obvious SQL injection patterns found"
    echo "✅ No obvious SQL injection patterns detected" >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"

# Check for XSS vulnerabilities
log_info "Scanning for XSS vulnerabilities..."
echo "#### XSS Vulnerability Scan" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if grep -r -E "innerHTML\s*=|dangerouslySetInnerHTML" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" frontend/src/ || true; then
    log_warning "Potential XSS vulnerabilities found"
    echo "⚠️ Potential XSS patterns detected - review innerHTML usage" >> "$REPORT_FILE"
else
    log_success "No obvious XSS patterns found"
    echo "✅ No obvious XSS patterns detected" >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"

# 3. Authentication and Authorization Testing
log_info "Testing authentication and authorization..."
echo "## 3. Authentication & Authorization Security" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

cd "$PROJECT_ROOT/backend"

# Run security-specific tests
echo "### Security Test Results" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
if npm run test:security >> "$REPORT_FILE" 2>&1; then
    log_success "Security tests passed"
    echo "✅ All security tests passed" >> "$REPORT_FILE"
else
    log_warning "Some security tests failed"
    echo "⚠️ Some security tests failed - see details above" >> "$REPORT_FILE"
fi
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 4. Configuration Security Review
log_info "Reviewing configuration security..."
echo "## 4. Configuration Security Review" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

cd "$PROJECT_ROOT"

# Check environment files
echo "### Environment Configuration" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if [ -f ".env" ]; then
    log_warning ".env file exists in root - ensure it's not committed"
    echo "⚠️ .env file exists in root directory" >> "$REPORT_FILE"
else
    log_success "No .env file in root directory"
    echo "✅ No .env file in root directory" >> "$REPORT_FILE"
fi

# Check for exposed sensitive files
SENSITIVE_FILES=(".env" ".env.local" ".env.production" "config/database.yml" "config/secrets.yml")
for file in "${SENSITIVE_FILES[@]}"; do
    if git ls-files --error-unmatch "$file" 2>/dev/null; then
        log_error "Sensitive file $file is tracked by git"
        echo "❌ Sensitive file $file is tracked by git" >> "$REPORT_FILE"
    fi
done

echo "" >> "$REPORT_FILE"

# Check Docker security
echo "### Docker Security" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if [ -f "Dockerfile.prod" ]; then
    # Check for running as root
    if grep -q "USER root" Dockerfile.prod; then
        log_warning "Dockerfile runs as root user"
        echo "⚠️ Dockerfile runs as root user" >> "$REPORT_FILE"
    else
        log_success "Dockerfile does not explicitly run as root"
        echo "✅ Dockerfile does not explicitly run as root" >> "$REPORT_FILE"
    fi
    
    # Check for COPY with --chown
    if grep -q "COPY --chown" Dockerfile.prod; then
        log_success "Dockerfile uses --chown for proper file ownership"
        echo "✅ Dockerfile uses --chown for proper file ownership" >> "$REPORT_FILE"
    else
        log_warning "Dockerfile may not set proper file ownership"
        echo "⚠️ Consider using COPY --chown for proper file ownership" >> "$REPORT_FILE"
    fi
fi

echo "" >> "$REPORT_FILE"

# 5. API Security Testing
log_info "Testing API security..."
echo "## 5. API Security Testing" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Start the application for testing (if not already running)
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
    log_info "Starting application for security testing..."
    cd "$PROJECT_ROOT/backend"
    npm run dev &
    APP_PID=$!
    sleep 10
    
    # Cleanup function
    cleanup() {
        if [ ! -z "$APP_PID" ]; then
            kill $APP_PID 2>/dev/null || true
        fi
    }
    trap cleanup EXIT
fi

# Test rate limiting
echo "### Rate Limiting Tests" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

log_info "Testing rate limiting..."
rate_limit_test() {
    local endpoint="$1"
    local expected_status="$2"
    
    # Make rapid requests
    for i in {1..25}; do
        response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$endpoint" || echo "000")
        if [ "$response" = "429" ]; then
            echo "✅ Rate limiting active on $endpoint (got 429 after $i requests)" >> "$REPORT_FILE"
            return 0
        fi
    done
    
    echo "⚠️ Rate limiting may not be active on $endpoint" >> "$REPORT_FILE"
    return 1
}

rate_limit_test "/api/auth/login" "429"
rate_limit_test "/api/products/search" "429"

echo "" >> "$REPORT_FILE"

# Test CORS configuration
echo "### CORS Configuration" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

log_info "Testing CORS configuration..."
cors_response=$(curl -s -H "Origin: https://malicious-site.com" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: X-Requested-With" -X OPTIONS http://localhost:3000/api/auth/login)

if echo "$cors_response" | grep -q "Access-Control-Allow-Origin: \*"; then
    log_warning "CORS allows all origins"
    echo "⚠️ CORS allows all origins (*)" >> "$REPORT_FILE"
else
    log_success "CORS is properly configured"
    echo "✅ CORS is properly configured" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"

# Test security headers
echo "### Security Headers" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

log_info "Testing security headers..."
headers_response=$(curl -s -I http://localhost:3000/)

check_header() {
    local header="$1"
    local description="$2"
    
    if echo "$headers_response" | grep -qi "$header"; then
        echo "✅ $description header present" >> "$REPORT_FILE"
    else
        echo "⚠️ $description header missing" >> "$REPORT_FILE"
    fi
}

check_header "X-Content-Type-Options" "X-Content-Type-Options"
check_header "X-Frame-Options" "X-Frame-Options"
check_header "X-XSS-Protection" "X-XSS-Protection"
check_header "Strict-Transport-Security" "HSTS"
check_header "Content-Security-Policy" "CSP"

echo "" >> "$REPORT_FILE"

# 6. Input Validation Testing
log_info "Testing input validation..."
echo "## 6. Input Validation Testing" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Test SQL injection attempts
echo "### SQL Injection Tests" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

sql_payloads=("'; DROP TABLE users; --" "' OR '1'='1" "' UNION SELECT * FROM users --")

for payload in "${sql_payloads[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$payload\",\"password\":\"test\"}" \
        http://localhost:3000/api/auth/login)
    
    if [ "$response" = "400" ] || [ "$response" = "422" ]; then
        echo "✅ SQL injection payload rejected: $payload" >> "$REPORT_FILE"
    else
        echo "⚠️ SQL injection payload not properly handled: $payload (status: $response)" >> "$REPORT_FILE"
    fi
done

echo "" >> "$REPORT_FILE"

# Test XSS attempts
echo "### XSS Tests" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

xss_payloads=("<script>alert('xss')</script>" "javascript:alert('xss')" "<img src=x onerror=alert('xss')>")

for payload in "${xss_payloads[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"test@example.com\",\"firstName\":\"$payload\"}" \
        http://localhost:3000/api/auth/register)
    
    if [ "$response" = "400" ] || [ "$response" = "422" ]; then
        echo "✅ XSS payload rejected: $payload" >> "$REPORT_FILE"
    else
        echo "⚠️ XSS payload not properly handled: $payload (status: $response)" >> "$REPORT_FILE"
    fi
done

echo "" >> "$REPORT_FILE"

# 7. Generate Summary
log_info "Generating audit summary..."
echo "## 7. Audit Summary" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Count issues
critical_issues=$(grep -c "❌" "$REPORT_FILE" || echo "0")
warnings=$(grep -c "⚠️" "$REPORT_FILE" || echo "0")
passed_checks=$(grep -c "✅" "$REPORT_FILE" || echo "0")

echo "### Results Overview" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "- **Critical Issues:** $critical_issues" >> "$REPORT_FILE"
echo "- **Warnings:** $warnings" >> "$REPORT_FILE"
echo "- **Passed Checks:** $passed_checks" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if [ "$critical_issues" -eq 0 ] && [ "$warnings" -eq 0 ]; then
    echo "### Overall Assessment: ✅ PASS" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "No critical security issues or warnings detected. The application appears to follow security best practices." >> "$REPORT_FILE"
    log_success "Security audit completed - No critical issues found"
elif [ "$critical_issues" -eq 0 ]; then
    echo "### Overall Assessment: ⚠️ PASS WITH WARNINGS" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "No critical security issues detected, but some warnings should be addressed to improve security posture." >> "$REPORT_FILE"
    log_warning "Security audit completed - $warnings warnings found"
else
    echo "### Overall Assessment: ❌ FAIL" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "Critical security issues detected that should be addressed immediately." >> "$REPORT_FILE"
    log_error "Security audit completed - $critical_issues critical issues found"
fi

echo "" >> "$REPORT_FILE"
echo "### Recommendations" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "1. **Regular Updates:** Keep all dependencies updated to their latest secure versions" >> "$REPORT_FILE"
echo "2. **Code Reviews:** Implement mandatory security-focused code reviews" >> "$REPORT_FILE"
echo "3. **Automated Scanning:** Integrate security scanning into CI/CD pipeline" >> "$REPORT_FILE"
echo "4. **Penetration Testing:** Consider regular professional penetration testing" >> "$REPORT_FILE"
echo "5. **Security Training:** Ensure development team receives regular security training" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "*Report generated on $(date) by BoosterBeacon Security Audit Script*" >> "$REPORT_FILE"

log_success "Security audit completed. Report saved to: $REPORT_FILE"

# Display summary
echo ""
echo "=== SECURITY AUDIT SUMMARY ==="
echo "Critical Issues: $critical_issues"
echo "Warnings: $warnings"
echo "Passed Checks: $passed_checks"
echo "Report Location: $REPORT_FILE"
echo ""

# Exit with appropriate code
if [ "$critical_issues" -gt 0 ]; then
    exit 1
elif [ "$warnings" -gt 0 ]; then
    exit 2
else
    exit 0
fi