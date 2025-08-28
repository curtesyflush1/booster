#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface CoverageReport {
  total: {
    lines: { pct: number };
    functions: { pct: number };
    statements: { pct: number };
    branches: { pct: number };
  };
}

class TestQualityImprover {
  private readonly rootDir = process.cwd();
  private readonly coverageFile = join(this.rootDir, 'coverage', 'coverage-summary.json');

  async run() {
    console.log('🔧 Starting test quality improvement...\n');

    try {
      // Step 1: Run tests and collect current coverage
      await this.runTestsWithCoverage();
      
      // Step 2: Analyze coverage gaps
      const coverage = await this.analyzeCoverage();
      
      // Step 3: Fix common test issues
      await this.fixCommonIssues();
      
      // Step 4: Generate improvement recommendations
      await this.generateRecommendations(coverage);
      
      console.log('✅ Test quality improvement completed!');
      
    } catch (error) {
      console.error('❌ Error during test improvement:', error);
      process.exit(1);
    }
  }

  private async runTestsWithCoverage() {
    console.log('📊 Running tests with coverage...');
    try {
      execSync('npm run test:coverage', { 
        stdio: 'inherit',
        cwd: this.rootDir 
      });
    } catch (error) {
      console.log('⚠️  Some tests failed, continuing with analysis...');
    }
  }

  private async analyzeCoverage(): Promise<CoverageReport | null> {
    try {
      const coverageData = readFileSync(this.coverageFile, 'utf8');
      const coverage: CoverageReport = JSON.parse(coverageData);
      
      console.log('\n📈 Current Coverage:');
      console.log(`Lines: ${coverage.total.lines.pct}%`);
      console.log(`Functions: ${coverage.total.functions.pct}%`);
      console.log(`Statements: ${coverage.total.statements.pct}%`);
      console.log(`Branches: ${coverage.total.branches.pct}%`);
      
      return coverage;
    } catch (error) {
      console.log('⚠️  Could not read coverage report');
      return null;
    }
  }

  private async fixCommonIssues() {
    console.log('\n🔨 Fixing common test issues...');
    
    // Fix 1: Update Jest setup to handle mocking better
    const jestSetupContent = `
// Mock external dependencies
jest.mock('axios');
jest.mock('nodemailer');
jest.mock('redis');
jest.mock('web-push');

// Mock database
jest.mock('../src/config/database', () => ({
  getDatabaseConfig: jest.fn(),
  checkDatabaseHealth: jest.fn().mockResolvedValue({ healthy: true }),
  initializeDatabase: jest.fn()
}));

// Mock BaseModel
jest.mock('../src/models/BaseModel', () => ({
  BaseModel: {
    getKnex: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue([1]),
      update: jest.fn().mockResolvedValue(1),
      delete: jest.fn().mockResolvedValue(1)
    })
  }
}));

// Global test timeout
jest.setTimeout(15000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
`;

    writeFileSync(
      join(this.rootDir, 'tests', 'jest.setup.js'),
      jestSetupContent
    );

    console.log('✅ Updated Jest setup file');
  }

  private async generateRecommendations(coverage: CoverageReport | null) {
    console.log('\n💡 Generating improvement recommendations...');
    
    const recommendations = [
      '1. Fix failing RetailerIntegrationService tests by improving mocking strategy',
      '2. Add database mocking for ML and email services',
      '3. Implement proper test isolation to prevent cross-test interference',
      '4. Add missing unit tests for uncovered functions',
      '5. Improve error handling test coverage',
      '6. Add integration tests for critical user workflows'
    ];

    if (coverage) {
      if (coverage.total.lines.pct < 70) {
        recommendations.push('7. Focus on increasing line coverage by testing main execution paths');
      }
      if (coverage.total.branches.pct < 60) {
        recommendations.push('8. Add tests for conditional logic and error handling branches');
      }
      if (coverage.total.functions.pct < 75) {
        recommendations.push('9. Ensure all public functions have corresponding tests');
      }
    }

    const recommendationsFile = join(this.rootDir, 'TEST_IMPROVEMENT_PLAN.md');
    const content = `# Test Improvement Plan

Generated on: ${new Date().toISOString()}

## Current Issues
- Multiple test failures due to mocking issues
- Low coverage in core services
- Database connection problems in tests

## Recommendations
${recommendations.map(rec => `- ${rec}`).join('\n')}

## Next Steps
1. Run \`npm run test:failed\` to see only failing tests
2. Fix mocking issues in RetailerIntegrationService
3. Implement database mocking strategy
4. Gradually increase coverage thresholds
5. Add integration tests for critical paths

## Useful Commands
- \`npm run test:debug\` - Debug failing tests
- \`npm run test:coverage:watch\` - Watch coverage changes
- \`npm run test:failed\` - Run only previously failed tests
`;

    writeFileSync(recommendationsFile, content);
    console.log(`✅ Generated improvement plan: ${recommendationsFile}`);
  }
}

// Run the improvement script
if (require.main === module) {
  new TestQualityImprover().run();
}

export { TestQualityImprover };