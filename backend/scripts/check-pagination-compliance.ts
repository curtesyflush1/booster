#!/usr/bin/env ts-node

/**
 * Pagination Compliance Checker Script
 * 
 * Scans the codebase for potential pagination issues and generates a report
 * of files that may need to be updated to use the new pagination system.
 */

import * as fs from 'fs';
import * as path from 'path';

interface ComplianceIssue {
  file: string;
  line: number;
  issue: string;
  code: string;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
}

class PaginationComplianceScanner {
  private issues: ComplianceIssue[] = [];
  private scannedFiles = 0;

  /**
   * Scan a directory for pagination compliance issues
   */
  async scanDirectory(dirPath: string): Promise<void> {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules, dist, coverage, etc.
        if (!['node_modules', 'dist', 'coverage', 'tests', '.git'].includes(entry.name)) {
          await this.scanDirectory(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        await this.scanFile(fullPath);
      }
    }
  }

  /**
   * Scan a single file for pagination issues
   */
  private async scanFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      this.scannedFiles++;

      lines.forEach((line, index) => {
        this.checkLine(filePath, line, index + 1);
      });
    } catch (error) {
      console.warn(`Could not scan file ${filePath}:`, error);
    }
  }

  /**
   * Check a single line for pagination issues
   */
  private checkLine(filePath: string, line: string, lineNumber: number): void {
    const trimmedLine = line.trim();

    // Check for unpaginated findBy calls
    if (trimmedLine.includes('.findBy(') && !trimmedLine.includes('findByLegacy')) {
      // Check if it's already using pagination options
      const hasOptionsParam = trimmedLine.includes('.findBy(') && 
                             (trimmedLine.includes('{ page:') || 
                              trimmedLine.includes('options') ||
                              trimmedLine.includes('pagination'));

      if (!hasOptionsParam) {
        this.addIssue({
          file: filePath,
          line: lineNumber,
          issue: 'Unpaginated findBy() call detected',
          code: trimmedLine,
          severity: 'high',
          suggestion: 'Add pagination options: .findBy(criteria, { page: 1, limit: 20 })'
        });
      }
    }

    // Check for direct Knex queries without LIMIT
    if ((trimmedLine.includes('.select(') || trimmedLine.includes('knex(')) && 
        !trimmedLine.includes('.limit(') && 
        !trimmedLine.includes('.first()') &&
        !trimmedLine.includes('.count(')) {
      
      this.addIssue({
        file: filePath,
        line: lineNumber,
        issue: 'Direct database query without LIMIT clause',
        code: trimmedLine,
        severity: 'medium',
        suggestion: 'Add .limit() clause or use createPaginatedQuery() helper'
      });
    }

    // Check for array operations on potentially paginated results
    if (trimmedLine.includes('.length') || 
        trimmedLine.includes('.forEach') || 
        trimmedLine.includes('.map(') ||
        trimmedLine.includes('.filter(')) {
      
      // Look for patterns that suggest this might be operating on a paginated result
      if (trimmedLine.includes('result.') || trimmedLine.includes('Response')) {
        this.addIssue({
          file: filePath,
          line: lineNumber,
          issue: 'Potential array operation on paginated result',
          code: trimmedLine,
          severity: 'low',
          suggestion: 'Ensure you are operating on result.data, not the paginated result object'
        });
      }
    }

    // Check for missing pagination middleware in routes
    if (trimmedLine.includes('router.get(') && 
        (trimmedLine.includes('/products') || 
         trimmedLine.includes('/users') || 
         trimmedLine.includes('/alerts') ||
         trimmedLine.includes('/watches'))) {
      
      // Check if the next few lines include pagination middleware
      this.addIssue({
        file: filePath,
        line: lineNumber,
        issue: 'Route may need pagination middleware',
        code: trimmedLine,
        severity: 'medium',
        suggestion: 'Add enforcePagination middleware for routes returning multiple records'
      });
    }

    // Check for deprecated patterns
    if (trimmedLine.includes('findByLegacy')) {
      this.addIssue({
        file: filePath,
        line: lineNumber,
        issue: 'Using deprecated findByLegacy method',
        code: trimmedLine,
        severity: 'medium',
        suggestion: 'Migrate to paginated findBy() method'
      });
    }
  }

  /**
   * Add an issue to the list
   */
  private addIssue(issue: ComplianceIssue): void {
    this.issues.push(issue);
  }

  /**
   * Generate a compliance report
   */
  generateReport(): {
    summary: {
      totalFiles: number;
      totalIssues: number;
      highSeverity: number;
      mediumSeverity: number;
      lowSeverity: number;
    };
    issues: ComplianceIssue[];
    recommendations: string[];
  } {
    const highSeverity = this.issues.filter(i => i.severity === 'high').length;
    const mediumSeverity = this.issues.filter(i => i.severity === 'medium').length;
    const lowSeverity = this.issues.filter(i => i.severity === 'low').length;

    const recommendations = [
      'Update BaseModel.findBy() calls to include pagination options',
      'Add pagination middleware to routes returning multiple records',
      'Replace direct Knex queries with paginated helpers',
      'Update array operations to work with result.data instead of full result',
      'Remove deprecated findByLegacy calls'
    ];

    return {
      summary: {
        totalFiles: this.scannedFiles,
        totalIssues: this.issues.length,
        highSeverity,
        mediumSeverity,
        lowSeverity
      },
      issues: this.issues,
      recommendations
    };
  }

  /**
   * Print a formatted report to console
   */
  printReport(): void {
    const report = this.generateReport();

    console.log('\n🔍 Pagination Compliance Report');
    console.log('================================\n');

    console.log('📊 Summary:');
    console.log(`   Files scanned: ${report.summary.totalFiles}`);
    console.log(`   Total issues: ${report.summary.totalIssues}`);
    console.log(`   High severity: ${report.summary.highSeverity}`);
    console.log(`   Medium severity: ${report.summary.mediumSeverity}`);
    console.log(`   Low severity: ${report.summary.lowSeverity}\n`);

    if (report.issues.length === 0) {
      console.log('✅ No pagination compliance issues found!\n');
      return;
    }

    // Group issues by file
    const issuesByFile = report.issues.reduce((acc, issue) => {
      if (!acc[issue.file]) {
        acc[issue.file] = [];
      }
      acc[issue.file].push(issue);
      return acc;
    }, {} as Record<string, ComplianceIssue[]>);

    console.log('🚨 Issues Found:\n');

    Object.entries(issuesByFile).forEach(([file, issues]) => {
      const relativePath = path.relative(process.cwd(), file);
      console.log(`📄 ${relativePath}`);
      
      issues.forEach(issue => {
        const severityIcon = issue.severity === 'high' ? '🔴' : 
                           issue.severity === 'medium' ? '🟡' : '🟢';
        
        console.log(`   ${severityIcon} Line ${issue.line}: ${issue.issue}`);
        console.log(`      Code: ${issue.code.substring(0, 80)}${issue.code.length > 80 ? '...' : ''}`);
        console.log(`      Fix: ${issue.suggestion}\n`);
      });
    });

    console.log('💡 Recommendations:');
    report.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });

    console.log('\n📚 For detailed migration instructions, see:');
    console.log('   backend/docs/PAGINATION_ENFORCEMENT.md\n');
  }

  /**
   * Save report to JSON file
   */
  saveReport(outputPath: string): void {
    const report = this.generateReport();
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to: ${outputPath}`);
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const scanner = new PaginationComplianceScanner();
  
  console.log('🔍 Scanning codebase for pagination compliance issues...\n');
  
  // Scan the src directory
  await scanner.scanDirectory(path.join(__dirname, '../src'));
  
  // Print the report
  scanner.printReport();
  
  // Save detailed report
  const reportPath = path.join(__dirname, '../pagination-compliance-report.json');
  scanner.saveReport(reportPath);
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { PaginationComplianceScanner };