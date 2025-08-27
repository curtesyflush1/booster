#!/bin/bash

# Fix Winston Logger Test Issues
# Specifically addresses the winston.format.printf error

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

print_status "🔧 Fixing Winston Logger Test Issues"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "backend" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Create comprehensive Winston mock
print_status "Creating comprehensive Winston mock..."
cat > backend/tests/jest.setup.js << 'EOF'
/**
 * Jest setup file for test environment configuration
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'sqlite::memory:';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.LOG_LEVEL = 'error';

// Mock external services to prevent network calls
jest.mock('axios');
jest.mock('nodemailer');
jest.mock('web-push');

// Comprehensive Winston mock
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn()
  };
  
  const mockFormat = jest.fn(() => mockFormat);
  mockFormat.combine = jest.fn(() => mockFormat);
  mockFormat.timestamp = jest.fn(() => mockFormat);
  mockFormat.errors = jest.fn(() => mockFormat);
  mockFormat.json = jest.fn(() => mockFormat);
  mockFormat.colorize = jest.fn(() => mockFormat);
  mockFormat.simple = jest.fn(() => mockFormat);
  mockFormat.printf = jest.fn(() => mockFormat);
  
  const mockTransport = jest.fn();
  
  return {
    createLogger: jest.fn(() => mockLogger),
    format: mockFormat,
    transports: {
      Console: mockTransport,
      File: mockTransport
    }
  };
});

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    off: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK')
  }))
}));

// Mock the database configuration to use SQLite in memory
jest.mock('../src/config/database', () => ({
  default: {
    client: 'sqlite3',
    connection: ':memory:',
    useNullAsDefault: true,
    pool: {
      min: 0,
      max: 1
    },
    migrations: {
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    }
  },
  testConnection: jest.fn().mockResolvedValue(true)
}));

// Mock Knex database
jest.mock('knex', () => {
  const mockKnex = jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    then: jest.fn().mockResolvedValue([]),
    catch: jest.fn().mockReturnThis(),
    migrate: {
      latest: jest.fn().mockResolvedValue([]),
      rollback: jest.fn().mockResolvedValue([])
    },
    seed: {
      run: jest.fn().mockResolvedValue([])
    },
    destroy: jest.fn().mockResolvedValue(undefined)
  }));
  
  mockKnex.mockReturnValue(mockKnex());
  return mockKnex;
});

// Global test timeout
jest.setTimeout(15000);

// Suppress console output in tests
const originalConsole = { ...console };
console.error = jest.fn();
console.warn = jest.fn();
console.log = jest.fn();
console.info = jest.fn();
console.debug = jest.fn();

// Restore console after tests if needed
global.restoreConsole = () => {
  Object.assign(console, originalConsole);
};
EOF

# Create mock for logger utility
print_status "Creating logger utility mock..."
mkdir -p backend/src/utils/__mocks__
cat > backend/src/utils/__mocks__/logger.ts << 'EOF'
// Mock logger for tests
export const logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  log: jest.fn()
};
EOF

# Create mock for BaseModel
print_status "Creating BaseModel mock..."
mkdir -p backend/src/models/__mocks__
cat > backend/src/models/__mocks__/BaseModel.ts << 'EOF'
export class BaseModel {
  static tableName = 'base_model';
  
  static async findById(id: string) {
    return null;
  }
  
  static async findBy(criteria: any) {
    return [];
  }
  
  static async create(data: any) {
    return { id: 'mock-id', ...data };
  }
  
  static async updateById(id: string, data: any) {
    return { id, ...data };
  }
  
  static async deleteById(id: string) {
    return true;
  }
}
EOF

print_success "Winston mocks created successfully"

# Test the fix
print_status "Testing alert tests with Winston fix..."
cd backend

if npm run test:unit -- --testPathPattern="alert" --detectOpenHandles --forceExit --maxWorkers=1; then
    print_success "✅ Alert tests now passing!"
    cd ..
else
    print_error "❌ Alert tests still failing"
    print_status "Trying to run just the Alert model test..."
    if npm run test:unit -- tests/models/Alert.test.ts --detectOpenHandles --forceExit; then
        print_success "✅ Alert model test passes - issue is with service tests"
    else
        print_error "❌ Even Alert model test fails"
    fi
    cd ..
fi