/**
 * Custom Jest reporter for performance test metrics
 */

class PerformanceReporter {
  constructor(globalConfig, options) {
    this.globalConfig = globalConfig;
    this.options = options;
    this.performanceResults = [];
  }

  onTestResult(test, testResult) {
    // Extract performance metrics from test results
    testResult.testResults.forEach(result => {
      if (result.title.includes('performance') || result.title.includes('load')) {
        const metrics = this.extractMetrics(result);
        if (metrics) {
          this.performanceResults.push({
            testName: result.title,
            file: test.path,
            ...metrics
          });
        }
      }
    });
  }

  onRunComplete() {
    if (this.performanceResults.length > 0) {
      console.log('\n📊 Performance Test Results:');
      console.log('================================');
      
      this.performanceResults.forEach(result => {
        console.log(`\n🔍 ${result.testName}`);
        console.log(`   Response Time: ${result.responseTime || 'N/A'}ms`);
        console.log(`   Throughput: ${result.throughput || 'N/A'} req/s`);
        console.log(`   Memory Usage: ${result.memoryUsage || 'N/A'}MB`);
        console.log(`   Success Rate: ${result.successRate || 'N/A'}%`);
      });

      // Save results to file
      const fs = require('fs');
      const path = require('path');
      const resultsFile = path.join(process.cwd(), 'performance-results.json');
      fs.writeFileSync(resultsFile, JSON.stringify(this.performanceResults, null, 2));
      console.log(`\n💾 Performance results saved to: ${resultsFile}`);
    }
  }

  extractMetrics(result) {
    // Try to extract metrics from test result or console output
    // This is a simplified implementation - in practice, you'd parse actual metrics
    if (result.duration) {
      return {
        responseTime: result.duration,
        throughput: Math.round(1000 / result.duration),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        successRate: result.status === 'passed' ? 100 : 0
      };
    }
    return null;
  }
}

module.exports = PerformanceReporter;