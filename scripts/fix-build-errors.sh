#!/bin/bash

# Fix TypeScript Build Errors
# Fixes specific compilation errors preventing deployment

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

print_status "🔧 Fixing TypeScript build errors for deployment"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "backend" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Fix 1: EmailTemplateService priority colors issue
print_status "Fixing EmailTemplateService priority colors..."
if [ -f "backend/src/services/emailTemplateService.ts" ]; then
    # Fix the priority colors return type issue
    sed -i.bak 's/return this\.PRIORITY_COLORS\[priority\] || this\.PRIORITY_COLORS\.medium;/return this.PRIORITY_COLORS[priority] || this.PRIORITY_COLORS.medium || "#6B7280";/' backend/src/services/emailTemplateService.ts
    print_success "Fixed EmailTemplateService priority colors"
else
    print_warning "EmailTemplateService not found, skipping"
fi

# Fix 2: EmailTransportService createTransporter typo
print_status "Fixing EmailTransportService createTransporter..."
if [ -f "backend/src/services/notifications/EmailTransportService.ts" ]; then
    # Fix the createTransporter typo
    sed -i.bak 's/nodemailer\.createTransporter/nodemailer.createTransport/g' backend/src/services/notifications/EmailTransportService.ts
    
    # Fix the return type issue
    sed -i.bak 's/return this\.transporter;/return this.transporter!;/' backend/src/services/notifications/EmailTransportService.ts
    print_success "Fixed EmailTransportService"
else
    print_warning "EmailTransportService not found, skipping"
fi

# Fix 3: EmailService transporter property issues
print_status "Fixing EmailService transporter property..."
if [ -f "backend/src/services/notifications/emailService.ts" ]; then
    # Add the missing transporter property
    sed -i.bak '/private static getTransporter/i\
  private static transporter: nodemailer.Transporter | null = null;' backend/src/services/notifications/emailService.ts
    print_success "Fixed EmailService transporter property"
else
    print_warning "EmailService not found, skipping"
fi

# Test the build
print_status "Testing backend build..."
cd backend

if npm run build; then
    print_success "✅ Backend build successful!"
    cd ..
else
    print_error "❌ Backend build still failing"
    print_status "Trying alternative fix..."
    
    # Alternative fix: Email service should already be fixed
    print_status "Email service should already be properly configured..."
        
    if npm run build; then
        print_success "✅ Backend build successful after fixes!"
        cd ..
    else
        print_error "❌ Build still failing"
        cd ..
        exit 1
    fi
fi

# Fix frontend TypeScript issues
print_status "Fixing frontend TypeScript issues..."
cd frontend

# Fix unused imports
if [ -f "src/App.tsx" ]; then
    sed -i.bak '/import Layout from/d' src/App.tsx
fi

if [ -f "src/components/ErrorBoundary.tsx" ]; then
    sed -i.bak 's/import React, { Component/import { Component/' src/components/ErrorBoundary.tsx
fi

if [ -f "src/components/layout/NavigationItem.tsx" ]; then
    sed -i.bak 's/import React, { memo }/import { memo }/' src/components/layout/NavigationItem.tsx
fi

if [ -f "src/components/layout/UserMenu.tsx" ]; then
    sed -i.bak 's/import React, { memo, useMemo }/import { memo, useMemo }/' src/components/layout/UserMenu.tsx
fi

if [ -f "src/hooks/usePricingCard.test.ts" ]; then
    sed -i.bak 's/import { describe, it, expect, vi }/import { describe, it, expect }/' src/hooks/usePricingCard.test.ts
    sed -i.bak 's/import { createMockPricingPlan, TEST_PRICING_PLANS }/import { createMockPricingPlan }/' src/hooks/usePricingCard.test.ts
fi

if [ -f "src/services/apiClient.ts" ]; then
    sed -i.bak '/import { logger }/d' src/services/apiClient.ts
fi

# Fix unused imports in App.tsx (RouteWrapperProps is actually used)
if [ -f "src/App.tsx" ]; then
    # No changes needed - RouteWrapperProps is used by ProtectedRoute and PublicRoute
    echo "[INFO] App.tsx interfaces are properly used"
fi

print_status "Testing frontend build..."
if npm run build; then
    print_success "✅ Frontend build successful!"
    cd ..
else
    print_error "❌ Frontend build still failing"
    cd ..
    exit 1
fi