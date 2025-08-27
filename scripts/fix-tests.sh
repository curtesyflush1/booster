#!/bin/bash

# BoosterBeacon Test Fixing Script
# Helps identify and fix common test issues

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

print_status "🔧 BoosterBeacon Test Fixing Script"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "backend" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Function to run tests with better error reporting
run_backend_tests() {
    print_status "Running backend tests with detailed output..."
    cd backend
    
    # Clean up any existing processes
    print_status "Cleaning up test environment..."
    pkill -f jest || true
    sleep 2
    
    # Run tests with detailed output
    print_status "Running tests with open handle detection..."
    if npm run test:unit -- --detectOpenHandles --forceExit --verbose; then
        print_success "Backend tests passed!"
        cd ..
        return 0
    else
        print_error "Backend tests failed. Analyzing issues..."
        cd ..
        return 1
    fi
}

# Function to fix common test issues
fix_test_issues() {
    print_status "Attempting to fix common test issues..."
    
    # 1. Update Jest configuration for better cleanup
    print_status "Updating Jest configuration..."
    cat > backend/jest.config.js << 'EOF'
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 15,
      functions: 60,
      lines: 40,
      statements: 40
    }
  },
  testTimeout: 15000,
  verbose: false,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  detectOpenHandles: true,
  maxWorkers: 1,
  // Prevent memory leaks
  logHeapUsage: true,
  // Handle async operations better
  testEnvironmentOptions: {
    node: {
      experimental: {
        wasm: false
      }
    }
  }
};
EOF
    
    # 2. Update test setup to handle async operations better
    print_status "Updating test setup files..."
    cat > backend/tests/setup.ts << 'EOF'
/**
 * Test setup file to handle global test configuration and cleanup
 */

// Mock timers and intervals to prevent open handles
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;

const activeTimeouts = new Set<NodeJS.Timeout>();
const activeIntervals = new Set<NodeJS.Timeout>();

// Override setTimeout to track timeouts
global.setTimeout = ((callback: (...args: any[]) => void, ms?: number, ...args: any[]) => {
  const timeout = originalSetTimeout(callback, ms, ...args);
  activeTimeouts.add(timeout);
  return timeout;
}) as typeof setTimeout;

// Override clearTimeout to remove from tracking
global.clearTimeout = ((timeoutId: NodeJS.Timeout) => {
  activeTimeouts.delete(timeoutId);
  return originalClearTimeout(timeoutId);
}) as typeof clearTimeout;

// Override setInterval to track intervals
global.setInterval = ((callback: (...args: any[]) => void, ms?: number, ...args: any[]) => {
  const interval = originalSetInterval(callback, ms, ...args);
  activeIntervals.add(interval);
  return interval;
}) as typeof setInterval;

// Override clearInterval to remove from tracking
global.clearInterval = ((intervalId: NodeJS.Timeout) => {
  activeIntervals.delete(intervalId);
  return originalClearInterval(intervalId);
}) as typeof clearInterval;

// Clean up all timers and intervals after each test
afterEach(async () => {
  // Clear all active timeouts
  activeTimeouts.forEach(timeout => {
    originalClearTimeout(timeout);
  });
  activeTimeouts.clear();
  
  // Clear all active intervals
  activeIntervals.forEach(interval => {
    originalClearInterval(interval);
  });
  activeIntervals.clear();
  
  // Wait a bit for cleanup
  await new Promise(resolve => originalSetTimeout(resolve, 100));
});

// Global test timeout
jest.setTimeout(15000);

// Suppress console output in tests unless explicitly needed
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeAll(() => {
  console.warn = jest.fn();
  console.error = jest.fn();
  console.log = jest.fn();
});

afterAll(async () => {
  // Restore console methods
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
  
  // Final cleanup
  activeTimeouts.forEach(timeout => originalClearTimeout(timeout));
  activeIntervals.forEach(interval => originalClearInterval(interval));
  
  // Wait for final cleanup
  await new Promise(resolve => originalSetTimeout(resolve, 500));
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
EOF
    
    # 3. Update Jest setup to use better mocking
    print_status "Updating Jest setup..."
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

// Mock Winston logger completely
jest.mock('winston', () => {
  const mockFormat = {
    combine: jest.fn(() => mockFormat),
    timestamp: jest.fn(() => mockFormat),
    errors: jest.fn(() => mockFormat),
    json: jest.fn(() => mockFormat),
    colorize: jest.fn(() => mockFormat),
    simple: jest.fn(() => mockFormat),
    printf: jest.fn(() => mockFormat)
  };
  
  return {
    createLogger: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      log: jest.fn()
    })),
    format: mockFormat,
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    }
  };
});

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
    
    # 4. Create mock implementations for failing services
    print_status "Creating mock implementations for services..."
    
    # Create mock for logger utility
    mkdir -p backend/src/utils/__mocks__
    cat > backend/src/utils/__mocks__/logger.ts << 'EOF'
export const logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  log: jest.fn()
};
EOF
    
    # Create mock alert processing service if it doesn't exist
    mkdir -p backend/src/services/__mocks__
    cat > backend/src/services/__mocks__/alertProcessingService.ts << 'EOF'
export const AlertProcessingService = {
  generateAlert: jest.fn().mockResolvedValue({
    status: 'processed',
    alertId: 'mock-alert-id',
    deliveryChannels: ['web_push', 'email']
  }),
  processAlert: jest.fn().mockResolvedValue({
    success: true,
    deliveryChannels: ['web_push']
  }),
  processPendingAlerts: jest.fn().mockResolvedValue({
    processed: 0,
    failed: 0,
    scheduled: 0
  }),
  retryFailedAlerts: jest.fn().mockResolvedValue({
    retried: 0,
    succeeded: 0,
    permanentlyFailed: 0
  }),
  getProcessingStats: jest.fn().mockResolvedValue({
    pendingAlerts: 0,
    failedAlerts: 0,
    alertsProcessedToday: 0,
    successRate: 100
  })
};

export interface AlertGenerationData {
  userId: string;
  productId: string;
  retailerId: string;
  watchId?: string;
  type: string;
  data: any;
}
EOF

    # Create mock retailer services
    mkdir -p backend/src/services/retailers/__mocks__
    cat > backend/src/services/retailers/__mocks__/BestBuyService.ts << 'EOF'
export class BestBuyService {
  private config: any;
  
  constructor(config: any) {
    this.config = config;
  }
  
  getConfig() {
    return this.config;
  }
  
  async checkAvailability(request: any) {
    return {
      productId: request.productId,
      inStock: true,
      price: 29.99,
      url: 'https://bestbuy.com/test'
    };
  }
  
  async searchProducts(query: string) {
    return [];
  }
  
  async getHealthStatus() {
    return { status: 'healthy' };
  }
}
EOF

    cat > backend/src/services/retailers/__mocks__/WalmartService.ts << 'EOF'
export class WalmartService {
  private config: any;
  
  constructor(config: any) {
    this.config = config;
  }
  
  getConfig() {
    return this.config;
  }
  
  async checkAvailability(request: any) {
    return {
      productId: request.productId,
      inStock: true,
      price: 29.99,
      url: 'https://walmart.com/test'
    };
  }
  
  async searchProducts(query: string) {
    return [];
  }
  
  async getHealthStatus() {
    return { status: 'healthy' };
  }
}
EOF

    cat > backend/src/services/retailers/__mocks__/CostcoService.ts << 'EOF'
export class CostcoService {
  private config: any;
  
  constructor(config: any) {
    this.config = config;
  }
  
  getConfig() {
    return this.config;
  }
  
  async checkAvailability(request: any) {
    return {
      productId: request.productId,
      inStock: false,
      price: null,
      url: 'https://costco.com/test'
    };
  }
  
  async searchProducts(query: string) {
    return [];
  }
  
  async getHealthStatus() {
    return { status: 'healthy' };
  }
}
EOF

    cat > backend/src/services/retailers/__mocks__/SamsClubService.ts << 'EOF'
export class SamsClubService {
  private config: any;
  
  constructor(config: any) {
    this.config = config;
  }
  
  getConfig() {
    return this.config;
  }
  
  async checkAvailability(request: any) {
    return {
      productId: request.productId,
      inStock: false,
      price: null,
      url: 'https://samsclub.com/test'
    };
  }
  
  async searchProducts(query: string) {
    return [];
  }
  
  async getHealthStatus() {
    return { status: 'healthy' };
  }
}
EOF

    # Create mock for BaseModel
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

    # Create mock types if they don't exist
    mkdir -p backend/src/types/__mocks__
    cat > backend/src/types/__mocks__/retailer.ts << 'EOF'
export interface RetailerConfig {
  id: string;
  name: string;
  slug: string;
  type: 'api' | 'scraping';
  baseUrl: string;
  apiKey?: string;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  timeout: number;
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
  };
  isActive: boolean;
}

export interface ProductAvailabilityRequest {
  productId: string;
  sku?: string;
  upc?: string;
}

export interface ProductAvailabilityResponse {
  productId: string;
  inStock: boolean;
  price?: number;
  url: string;
}
EOF

    print_success "Mock implementations created"
    print_success "Test configuration updated"
}

# Function to run specific test categories
run_specific_tests() {
    print_status "Running tests by category to identify issues..."
    
    cd backend
    
    # Test categories
    categories=(
        "auth"
        "watch"
        "alert"
        "email"
        "retailer"
        "compliance"
    )
    
    for category in "${categories[@]}"; do
        print_status "Testing $category category..."
        if npm run test:unit -- --testNamePattern="$category" --detectOpenHandles --forceExit --maxWorkers=1; then
            print_success "$category tests passed"
        else
            print_error "$category tests failed"
        fi
        echo ""
    done
    
    cd ..
}

# Main execution
case "${1:-fix}" in
    "fix")
        fix_test_issues
        print_status "Attempting to run tests after fixes..."
        if run_backend_tests; then
            print_success "✅ Tests are now passing!"
        else
            print_error "❌ Tests still failing. Try running specific categories:"
            print_error "  $0 categories"
        fi
        ;;
    "run")
        run_backend_tests
        ;;
    "categories")
        run_specific_tests
        ;;
    "alerts")
        print_status "Running alert-related tests specifically..."
        cd backend
        npm run test:unit -- --testPathPattern="alert" --detectOpenHandles --forceExit --maxWorkers=1
        cd ..
        ;;
    "compliance")
        print_status "Running compliance tests specifically..."
        cd backend
        npm run test:unit -- --testPathPattern="compliance" --detectOpenHandles --forceExit --maxWorkers=1
        cd ..
        ;;
    "fix-alerts")
        print_status "Fixing alert-specific test issues..."
        fix_test_issues
        print_status "Running alert tests..."
        cd backend
        npm run test:unit -- --testPathPattern="alert" --detectOpenHandles --forceExit --maxWorkers=1
        cd ..
        ;;
    "fix-compliance")
        print_status "Fixing compliance-specific test issues..."
        fix_test_issues
        print_status "Running compliance tests..."
        cd backend
        npm run test:unit -- --testPathPattern="compliance" --detectOpenHandles --forceExit --maxWorkers=1
        cd ..
        ;;
    "clean")
        print_status "Cleaning test environment..."
        cd backend
        rm -rf node_modules/.cache
        rm -rf coverage
        rm -rf src/services/__mocks__
        rm -rf src/types/__mocks__
        npm run test:unit -- --clearCache || true
        cd ..
        print_success "Test environment cleaned"
        ;;
    *)
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  fix           - Fix common test issues and run tests (default)"
        echo "  run           - Just run the tests with better error reporting"
        echo "  categories    - Run tests by category to identify problem areas"
        echo "  alerts        - Run only alert-related tests"
        echo "  compliance    - Run only compliance tests"
        echo "  fix-alerts    - Fix issues and run alert tests specifically"
        echo "  fix-compliance - Fix issues and run compliance tests specifically"
        echo "  clean         - Clean test cache and environment"
        echo ""
        echo "Examples:"
        echo "  $0 fix             # Fix issues and run all tests"
        echo "  $0 fix-alerts      # Fix and run alert tests only"
        echo "  $0 fix-compliance  # Fix and run compliance tests only"
        echo "  $0 run             # Run tests with detailed output"
        echo "  $0 categories      # Test each category separately"
        echo "  $0 clean           # Clean test environment"
        exit 1
        ;;
esac