# Test Troubleshooting Guide

This guide helps resolve common test failures in the BoosterBeacon project.

## Quick Solutions

### 1. Skip Failing Tests (Fastest Solution)
If you need to deploy immediately while specific tests are failing:

```bash
# Skip known failing tests and run remaining tests
./scripts/skip-failing-tests.sh skip

# Or use npm script
npm run test:skip

# Then deploy normally
./scripts/deploy.sh
```

### 2. Deploy Without Tests (Alternative Solution)
If you need to deploy immediately while tests are failing:

```bash
# Option 1: Use no-tests deployment
./scripts/deploy.sh no-tests

# Option 2: Use environment variable
SKIP_TESTS=true ./scripts/deploy.sh

# Option 3: Use quick deployment (uses existing build)
./scripts/deploy.sh quick
```

### 3. Fix Specific Test Categories
Target specific failing test categories:

```bash
# Fix and run alert tests only
./scripts/fix-tests.sh fix-alerts

# Fix and run compliance tests only
./scripts/fix-tests.sh fix-compliance

# Run specific test categories
./scripts/fix-tests.sh alerts
./scripts/fix-tests.sh compliance
```

### 4. Fix Tests Automatically
Run the test fixing script to resolve common issues:

```bash
# Fix common test issues and run tests
./scripts/fix-tests.sh

# Or use npm script
npm run fix-tests
```

### 5. Run Minimal Smoke Tests
If most tests are failing, run basic validation only:

```bash
# Create and run minimal smoke tests
./scripts/skip-failing-tests.sh smoke

# Or use npm script
npm run test:smoke
```

### 6. Clean Test Environment
If tests are failing due to cached data or open handles:

```bash
# Clean test cache and environment
./scripts/fix-tests.sh clean

# Or use npm script
npm run test:clean
```

## Common Test Issues and Solutions

### Issue 1: Open Handles (Jest doesn't exit cleanly)
**Symptoms:**
- Tests complete but Jest hangs
- "Force exiting Jest" message
- `--detectOpenHandles` shows open handles

**Solutions:**
1. Run the fix script: `./scripts/fix-tests.sh`
2. Update Jest configuration with better cleanup
3. Mock external services properly

### Issue 2: Database Connection Issues
**Symptoms:**
- Database connection errors in tests
- SQLite memory database issues
- Migration failures

**Solutions:**
1. Ensure test database configuration is correct
2. Use in-memory SQLite for tests
3. Mock database operations for unit tests

### Issue 3: Redis Connection Issues
**Symptoms:**
- Redis connection timeouts
- Redis client errors in tests

**Solutions:**
1. Mock Redis client in tests
2. Use Redis mock instead of real Redis
3. Ensure Redis is running for integration tests

### Issue 4: External Service Calls
**Symptoms:**
- Network timeouts in tests
- API rate limiting errors
- External service unavailable

**Solutions:**
1. Mock all external HTTP calls
2. Use test doubles for external services
3. Avoid real network calls in unit tests

## Test Categories

Run tests by category to identify problem areas:

```bash
# Test specific categories
./scripts/fix-tests.sh categories

# Or test individual categories
cd backend
npm run test:unit -- --testNamePattern="auth"
npm run test:unit -- --testNamePattern="watch"
npm run test:unit -- --testNamePattern="alert"
npm run test:unit -- --testNamePattern="email"
npm run test:unit -- --testNamePattern="retailer"
```

## Deployment Options During Test Failures

### 1. Full Deployment (Recommended for Production)
```bash
# Fix tests first, then deploy
./scripts/fix-tests.sh
./scripts/deploy.sh
```

### 2. Deploy Without Tests (Use with Caution)
```bash
# Skip tests entirely
./scripts/deploy.sh no-tests

# Or with environment variable
SKIP_TESTS=true ./scripts/deploy.sh
```

### 3. Quick Deployment (For Hotfixes)
```bash
# Uses existing build, skips tests
./scripts/deploy.sh quick
```

## Test Configuration Files

The test fixing script updates these files:

### Jest Configuration (`backend/jest.config.js`)
- Adds better timeout handling
- Enables open handle detection
- Configures proper cleanup

### Test Setup (`backend/tests/setup.ts`)
- Mocks timers and intervals
- Handles async cleanup
- Prevents memory leaks

### Jest Setup (`backend/tests/jest.setup.js`)
- Mocks external services
- Configures test environment
- Sets up database mocking

## Manual Test Fixes

If the automatic fix script doesn't work, try these manual steps:

### 1. Update Jest Configuration
```javascript
// backend/jest.config.js
module.exports = {
  // ... existing config
  testTimeout: 15000,
  forceExit: true,
  detectOpenHandles: true,
  maxWorkers: 1,
  // Add these for better cleanup
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
```

### 2. Mock External Services
```javascript
// In test files
jest.mock('axios');
jest.mock('nodemailer');
jest.mock('redis');
jest.mock('web-push');
```

### 3. Clean Up Async Operations
```javascript
// In test setup
afterEach(async () => {
  // Clear all timers
  jest.clearAllTimers();
  
  // Wait for cleanup
  await new Promise(resolve => setTimeout(resolve, 100));
});
```

## Environment Variables for Testing

Set these environment variables for better test behavior:

```bash
# In backend/.env.test
NODE_ENV=test
DATABASE_URL=sqlite::memory:
JWT_SECRET=test-jwt-secret
LOG_LEVEL=error
REDIS_URL=redis://localhost:6379
```

## Debugging Test Failures

### 1. Run Tests with Verbose Output
```bash
cd backend
npm run test:unit -- --verbose --detectOpenHandles
```

### 2. Run Single Test File
```bash
cd backend
npm run test:unit -- path/to/specific.test.ts
```

### 3. Debug with Node Inspector
```bash
cd backend
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Production Deployment Best Practices

### 1. Always Fix Tests Before Production
- Tests are your safety net
- Fix failing tests rather than skipping them
- Use staging environment for test fixes

### 2. Use Staging Environment
```bash
# Deploy to staging first
./scripts/deploy.sh staging

# Test in staging environment
# Then deploy to production
./scripts/deploy.sh
```

### 3. Monitor Deployment
```bash
# Check deployment status
./scripts/deploy.sh status

# View logs
./scripts/deploy.sh logs

# Health check
./scripts/deploy.sh check
```

## Emergency Deployment Procedures

If you must deploy with failing tests (emergency situations only):

### 1. Document the Issue
- Record which tests are failing
- Note the reason for emergency deployment
- Plan to fix tests after deployment

### 2. Deploy with Caution
```bash
# Emergency deployment without tests
./scripts/deploy.sh no-tests

# Monitor closely after deployment
./scripts/deploy.sh status
./scripts/deploy.sh logs
```

### 3. Fix Tests Immediately After
```bash
# Fix tests after emergency deployment
./scripts/fix-tests.sh

# Verify fixes work
npm run test:backend

# Deploy properly once tests pass
./scripts/deploy.sh
```

## Getting Help

If tests continue to fail after trying these solutions:

1. Check the specific error messages in test output
2. Look for patterns in failing tests
3. Ensure all dependencies are properly installed
4. Verify environment configuration
5. Consider running tests in a clean environment

## Useful Commands Summary

```bash
# Test Management
npm run test:skip             # Skip failing tests and run remaining
npm run test:smoke            # Run minimal smoke tests only
npm run fix-tests             # Fix common test issues
npm run test:clean            # Clean test environment
npm run test:restore          # Restore skipped tests

# Specific Test Categories
./scripts/fix-tests.sh fix-alerts      # Fix and run alert tests
./scripts/fix-tests.sh fix-compliance  # Fix and run compliance tests
./scripts/fix-tests.sh alerts          # Run alert tests only
./scripts/fix-tests.sh compliance      # Run compliance tests only

# Deployment Options
./scripts/deploy.sh           # Full deployment with tests
./scripts/deploy.sh no-tests  # Deploy without tests
./scripts/deploy.sh quick     # Quick deployment
SKIP_TESTS=true ./scripts/deploy.sh  # Skip tests with env var

# Monitoring
./scripts/deploy.sh status    # Check application status
./scripts/deploy.sh logs      # View recent logs
./scripts/deploy.sh check     # Health check

# Complete Workflow for Failing Tests
./scripts/skip-failing-tests.sh skip   # Skip failing tests
./scripts/deploy.sh                     # Deploy with passing tests
./scripts/skip-failing-tests.sh restore # Restore tests for future fixes
```

Remember: Tests are there to protect your production environment. While it's possible to deploy without tests, it should only be done in emergency situations with proper monitoring and immediate follow-up to fix the underlying issues.