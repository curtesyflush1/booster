#!/bin/bash

# KMS Integration Test Script
# This script tests the KMS integration to ensure it's working correctly

set -e

echo "🔐 Testing KMS Integration..."

# Check if backend is running
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo "❌ Backend server is not running. Please start it first with 'npm run dev:backend'"
    exit 1
fi

echo "✅ Backend server is running"

# Test basic encryption/decryption
echo "📝 Testing basic encryption/decryption..."
cd backend
npm run test:simple-kms

if [ $? -eq 0 ]; then
    echo "✅ Basic KMS functionality test passed"
else
    echo "❌ Basic KMS functionality test failed"
    exit 1
fi

# Test KMS integration
echo "🔧 Testing KMS integration..."
npm run test:kms-integration

if [ $? -eq 0 ]; then
    echo "✅ KMS integration test passed"
else
    echo "❌ KMS integration test failed"
    exit 1
fi

echo ""
echo "🎉 All KMS integration tests passed!"
echo ""
echo "📋 KMS Configuration:"
echo "   Provider: ${KMS_PROVIDER:-env}"
echo "   Key ID: ${KMS_KEY_ID:-default}"
echo "   Encryption Key Set: $([ -n "$ENCRYPTION_KEY" ] && echo "Yes" || echo "No")"
echo ""
echo "📚 Documentation:"
echo "   - Setup Guide: docs/kms-integration.md"
echo "   - API Reference: docs/api-reference.md#key-management-service-kms-endpoints"
echo "   - Implementation Summary: KMS_INTEGRATION_SUMMARY.md"