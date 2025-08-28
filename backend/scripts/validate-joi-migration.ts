#!/usr/bin/env ts-node

/**
 * Script to validate Joi migration progress and identify remaining work
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface MigrationStatus {
  file: string;
  hasExpressValidator: boolean;
  hasInlineJoi: boolean;
  hasJoiImport: boolean;
  migrationNeeded: boolean;
  issues: string[];
}

class JoiMigrationValidator {
  private controllersDir = path.join(__dirname, '../src/controllers');
  private routesDir = path.join(__dirname, '../src/routes');
  private results: MigrationStatus[] = [];

  async validateMigration(): Promise<void> {
    console.log('🔍 Validating Joi migration progress...\n');

    // Check controllers
    await this.checkControllers();
    
    // Check routes
    await this.checkRoutes();

    // Generate report
    this.generateReport();
  }

  private async checkControllers(): Promise<void> {
    const controllerFiles = fs.readdirSync(this.controllersDir)
      .filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'));

    console.log(`📁 Checking ${controllerFiles.length} controller files...\n`);

    for (const file of controllerFiles) {
      const filePath = path.join(this.controllersDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      const status = this.analyzeFile(file, content, 'controller');
      this.results.push(status);
    }
  }

  private async checkRoutes(): Promise<void> {
    const routeFiles = fs.readdirSync(this.routesDir)
      .filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'));

    console.log(`📁 Checking ${routeFiles.length} route files...\n`);

    for (const file of routeFiles) {
      const filePath = path.join(this.routesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      const status = this.analyzeFile(file, content, 'route');
      this.results.push(status);
    }
  }

  private analyzeFile(fileName: string, content: string, type: 'controller' | 'route'): MigrationStatus {
    const status: MigrationStatus = {
      file: fileName,
      hasExpressValidator: false,
      hasInlineJoi: false,
      hasJoiImport: false,
      migrationNeeded: false,
      issues: []
    };

    // Check for express-validator usage
    if (content.includes('express-validator') || 
        content.includes('body(') || 
        content.includes('param(') || 
        content.includes('query(') ||
        content.includes('validateRequest')) {
      status.hasExpressValidator = true;
      status.issues.push('Uses express-validator (should migrate to Joi)');
    }

    // Check for inline Joi schemas
    if (content.includes('Joi.object(') && !content.includes('import') && content.includes('const')) {
      status.hasInlineJoi = true;
      status.issues.push('Has inline Joi schemas (should move to schemas.ts)');
    }

    // Check for Joi imports
    if (content.includes("from 'joi'") || content.includes('import Joi')) {
      status.hasJoiImport = true;
      if (type === 'controller') {
        status.issues.push('Controller imports Joi directly (should use centralized schemas)');
      }
    }

    // Check for new validation middleware usage
    const hasNewValidation = content.includes('validateJoi') || 
                            content.includes('validateJoiBody') ||
                            content.includes('validateJoiQuery') ||
                            content.includes('validateJoiParams');

    // Check for validation middleware in routes
    if (type === 'route') {
      const hasValidationMiddleware = content.includes('validate') && 
                                    (content.includes('Body') || 
                                     content.includes('Query') || 
                                     content.includes('Params') ||
                                     content.includes('Joi'));
      
      if (!hasValidationMiddleware && !content.includes('health') && !content.includes('stats')) {
        status.issues.push('Route may be missing validation middleware');
      }
    }

    // Determine if migration is needed
    status.migrationNeeded = status.hasExpressValidator || 
                           status.hasInlineJoi || 
                           (status.hasJoiImport && type === 'controller');

    return status;
  }

  private generateReport(): void {
    console.log('📊 MIGRATION REPORT\n');
    console.log('='.repeat(50));

    const needsMigration = this.results.filter(r => r.migrationNeeded);
    const hasIssues = this.results.filter(r => r.issues.length > 0);

    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total files checked: ${this.results.length}`);
    console.log(`   Files needing migration: ${needsMigration.length}`);
    console.log(`   Files with issues: ${hasIssues.length}`);

    if (needsMigration.length === 0) {
      console.log('\n✅ All files have been migrated to Joi validation!');
    } else {
      console.log('\n🚨 FILES NEEDING MIGRATION:');
      needsMigration.forEach(file => {
        console.log(`\n   📄 ${file.file}`);
        file.issues.forEach(issue => {
          console.log(`      ❌ ${issue}`);
        });
      });
    }

    if (hasIssues.length > 0) {
      console.log('\n⚠️  ALL ISSUES FOUND:');
      hasIssues.forEach(file => {
        if (file.issues.length > 0) {
          console.log(`\n   📄 ${file.file}`);
          file.issues.forEach(issue => {
            console.log(`      ⚠️  ${issue}`);
          });
        }
      });
    }

    // Migration progress
    const totalFiles = this.results.length;
    const migratedFiles = totalFiles - needsMigration.length;
    const progressPercent = Math.round((migratedFiles / totalFiles) * 100);

    console.log(`\n📊 MIGRATION PROGRESS: ${progressPercent}% (${migratedFiles}/${totalFiles})`);
    console.log('█'.repeat(Math.floor(progressPercent / 5)) + '░'.repeat(20 - Math.floor(progressPercent / 5)));

    // Recommendations
    console.log('\n💡 NEXT STEPS:');
    
    if (needsMigration.length > 0) {
      console.log('   1. Migrate remaining files to use centralized Joi schemas');
      console.log('   2. Update routes to use validateJoi middleware');
      console.log('   3. Remove inline validation from controllers');
      console.log('   4. Add missing schemas to schemas.ts');
    } else {
      console.log('   1. Run comprehensive tests to verify all validation works');
      console.log('   2. Update API documentation');
      console.log('   3. Consider adding linting rules to prevent regression');
    }

    console.log('\n📚 DOCUMENTATION:');
    console.log('   See backend/docs/JOI_VALIDATION_STANDARD.md for detailed guidelines');

    console.log('\n' + '='.repeat(50));
  }
}

// Run the validation
if (require.main === module) {
  const validator = new JoiMigrationValidator();
  validator.validateMigration().catch(console.error);
}

export { JoiMigrationValidator };