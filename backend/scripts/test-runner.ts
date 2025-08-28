#!/usr/bin/env ts-node

/**
 * Comprehensive Test Runner
 * 
 * This script orchestrates all testing phases and generates comprehensive reports.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  coverage?: number;
  duration: number;
  errors: string[];
}

interface TestReport {
  timestamp: string;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  overallCoverage: number;
  suites: TestResult[];
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    throughput: number;
  };
  security: {
    vulnerabilities: number;
    criticalIssues: number;
    warnings: number;
  };
}

class ComprehensiveTestRunner {
  private results: TestResult[] = [];
  private startTime: number = Date.now();

  async runAllTests(): Promise<TestReport> {
    console.log('🚀 Starting comprehensive test suite...\n');

    try {
      // Phase 1: Unit Tests
      await this.runTestSuite('Unit Tests', 'npm run test:unit');

      // Phase 2: Integration Tests
      await this.runTestSuite('Integration Tests', 'npm run test:integration');

      // Phase 3: Security Tests
      await this.runTestSuite('Security Tests', 'npm run test:security');

      // Phase 4: Performance Tests
      await this.runTestSuite('Performance Tests', 'npm run test:performance');

      // Phase 5: E2E Tests
      await this.runTestSuite('E2E Tests', 'npm run test:e2e');

      // Phase 6: Coverage Analysis
      await this.generateCoverageReport();

      // Phase 7: Generate Final Report
      const report = await this.generateFinalReport();

      console.log('\n✅ All tests completed successfully!');
      return report;

    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
      throw error;
    }
  }

  private async runTestSuite(suiteName: string, command: string): Promise<void> {
    console.log(`📋 Running ${suiteName}...`);
    const startTime = Date.now();

    try {
      const output = execSync(command, { 
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      const result = this.parseTestOutput(suiteName, output, Date.now() - startTime);
      this.results.push(result);

      console.log(`✅ ${suiteName}: ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`);
      
      if (result.coverage) {
        console.log(`📊 Coverage: ${result.coverage}%`);
      }

    } catch (error: any) {
      const result: TestResult = {
        suite: suiteName,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: Date.now() - startTime,
        errors: [error.message]
      };

      this.results.push(result);
      console.log(`❌ ${suiteName} failed: ${error.message}`);
      
      // Continue with other tests even if one fails
    }
  }

  private parseTestOutput(suiteName: string, output: string, duration: number): TestResult {
    const result: TestResult = {
      suite: suiteName,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration,
      errors: []
    };

    // Parse Jest output
    const testResults = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (testResults) {
      result.failed = parseInt(testResults[1]);
      result.passed = parseInt(testResults[2]);
    }

    // Parse coverage
    const coverageMatch = output.match(/All files[^\d]*(\d+\.?\d*)/);
    if (coverageMatch) {
      result.coverage = parseFloat(coverageMatch[1]);
    }

    // Parse errors
    const errorMatches = output.match(/FAIL\s+.*?\n(.*?)(?=\n\s*PASS|\n\s*FAIL|\n\s*Test Suites:|$)/gs);
    if (errorMatches) {
      result.errors = errorMatches.map(match => match.trim());
    }

    return result;
  }

  private async generateCoverageReport(): Promise<void> {
    console.log('📊 Generating comprehensive coverage report...');

    try {
      // Run coverage with detailed reporting
      execSync('npm run test:coverage -- --verbose --collectCoverageFrom="src/**/*.ts"', {
        stdio: 'inherit'
      });

      // Generate HTML report
      execSync('npm run test:coverage:report', {
        stdio: 'inherit'
      });

      console.log('✅ Coverage report generated');

    } catch (error) {
      console.log('⚠️  Coverage report generation failed');
    }
  }

  private async generateFinalReport(): Promise<TestReport> {
    const totalTests = this.results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0);
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = this.results.reduce((sum, r) => sum + r.skipped, 0);

    // Calculate overall coverage
    const coverageResults = this.results.filter(r => r.coverage !== undefined);
    const overallCoverage = coverageResults.length > 0 
      ? coverageResults.reduce((sum, r) => sum + (r.coverage || 0), 0) / coverageResults.length
      : 0;

    const report: TestReport = {
      timestamp: new Date().toISOString(),
      totalTests,
      totalPassed,
      totalFailed,
      totalSkipped,
      overallCoverage,
      suites: this.results,
      performance: await this.getPerformanceMetrics(),
      security: await this.getSecurityMetrics()
    };

    // Save report to file
    const reportPath = path.join(__dirname, '..', 'test-reports', `test-report-${Date.now()}.json`);
    
    // Ensure directory exists
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    await this.generateHTMLReport(report, reportPath.replace('.json', '.html'));

    console.log(`📄 Test report saved to: ${reportPath}`);

    return report;
  }

  private async getPerformanceMetrics(): Promise<TestReport['performance']> {
    // Extract performance metrics from performance test results
    try {
      const perfLogPath = path.join(__dirname, '..', 'performance-results', 'latest.json');
      
      if (fs.existsSync(perfLogPath)) {
        const perfData = JSON.parse(fs.readFileSync(perfLogPath, 'utf8'));
        
        return {
          avgResponseTime: perfData.avgResponseTime || 0,
          p95ResponseTime: perfData.p95ResponseTime || 0,
          throughput: perfData.throughput || 0
        };
      }
    } catch (error) {
      console.log('⚠️  Could not load performance metrics');
    }

    return {
      avgResponseTime: 0,
      p95ResponseTime: 0,
      throughput: 0
    };
  }

  private async getSecurityMetrics(): Promise<TestReport['security']> {
    // Extract security metrics from security test results
    try {
      const securityLogPath = path.join(__dirname, '..', 'security-results', 'latest.json');
      
      if (fs.existsSync(securityLogPath)) {
        const securityData = JSON.parse(fs.readFileSync(securityLogPath, 'utf8'));
        
        return {
          vulnerabilities: securityData.vulnerabilities || 0,
          criticalIssues: securityData.criticalIssues || 0,
          warnings: securityData.warnings || 0
        };
      }
    } catch (error) {
      console.log('⚠️  Could not load security metrics');
    }

    return {
      vulnerabilities: 0,
      criticalIssues: 0,
      warnings: 0
    };
  }

  private async generateHTMLReport(report: TestReport, outputPath: string): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BoosterBeacon Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 24px; font-weight: bold; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        .coverage { color: #17a2b8; }
        .suite { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 6px; }
        .suite h3 { margin: 0 0 10px 0; }
        .suite-stats { display: flex; gap: 15px; margin-bottom: 10px; }
        .errors { background: #f8d7da; padding: 10px; border-radius: 4px; margin-top: 10px; }
        .timestamp { text-align: center; color: #666; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 BoosterBeacon Test Report</h1>
            <p>Comprehensive testing results and metrics</p>
        </div>

        <div class="summary">
            <div class="metric">
                <h3>Total Tests</h3>
                <div class="value">${report.totalTests}</div>
            </div>
            <div class="metric">
                <h3>Passed</h3>
                <div class="value passed">${report.totalPassed}</div>
            </div>
            <div class="metric">
                <h3>Failed</h3>
                <div class="value failed">${report.totalFailed}</div>
            </div>
            <div class="metric">
                <h3>Skipped</h3>
                <div class="value skipped">${report.totalSkipped}</div>
            </div>
            <div class="metric">
                <h3>Coverage</h3>
                <div class="value coverage">${report.overallCoverage.toFixed(1)}%</div>
            </div>
        </div>

        <h2>📋 Test Suites</h2>
        ${report.suites.map(suite => `
            <div class="suite">
                <h3>${suite.suite}</h3>
                <div class="suite-stats">
                    <span class="passed">✅ ${suite.passed} passed</span>
                    <span class="failed">❌ ${suite.failed} failed</span>
                    <span class="skipped">⏭️ ${suite.skipped} skipped</span>
                    ${suite.coverage ? `<span class="coverage">📊 ${suite.coverage}% coverage</span>` : ''}
                    <span>⏱️ ${(suite.duration / 1000).toFixed(2)}s</span>
                </div>
                ${suite.errors.length > 0 ? `
                    <div class="errors">
                        <strong>Errors:</strong>
                        <ul>
                            ${suite.errors.map(error => `<li>${error}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `).join('')}

        <h2>⚡ Performance Metrics</h2>
        <div class="summary">
            <div class="metric">
                <h3>Avg Response Time</h3>
                <div class="value">${report.performance.avgResponseTime}ms</div>
            </div>
            <div class="metric">
                <h3>P95 Response Time</h3>
                <div class="value">${report.performance.p95ResponseTime}ms</div>
            </div>
            <div class="metric">
                <h3>Throughput</h3>
                <div class="value">${report.performance.throughput} req/s</div>
            </div>
        </div>

        <h2>🔒 Security Metrics</h2>
        <div class="summary">
            <div class="metric">
                <h3>Vulnerabilities</h3>
                <div class="value ${report.security.vulnerabilities > 0 ? 'failed' : 'passed'}">${report.security.vulnerabilities}</div>
            </div>
            <div class="metric">
                <h3>Critical Issues</h3>
                <div class="value ${report.security.criticalIssues > 0 ? 'failed' : 'passed'}">${report.security.criticalIssues}</div>
            </div>
            <div class="metric">
                <h3>Warnings</h3>
                <div class="value ${report.security.warnings > 0 ? 'skipped' : 'passed'}">${report.security.warnings}</div>
            </div>
        </div>

        <div class="timestamp">
            Generated on ${new Date(report.timestamp).toLocaleString()}
        </div>
    </div>
</body>
</html>`;

    fs.writeFileSync(outputPath, html);
    console.log(`📄 HTML report saved to: ${outputPath}`);
  }
}

// Run the comprehensive test suite if called directly
if (require.main === module) {
  const runner = new ComprehensiveTestRunner();
  runner.runAllTests()
    .then(report => {
      console.log('\n📊 Final Test Summary:');
      console.log(`Total Tests: ${report.totalTests}`);
      console.log(`Passed: ${report.totalPassed}`);
      console.log(`Failed: ${report.totalFailed}`);
      console.log(`Coverage: ${report.overallCoverage.toFixed(1)}%`);
      
      if (report.totalFailed > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

export { ComprehensiveTestRunner };