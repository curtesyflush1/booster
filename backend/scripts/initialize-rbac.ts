#!/usr/bin/env ts-node

/**
 * RBAC Initialization Script
 * Run this script to initialize the RBAC system with default roles and permissions
 */

// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import { RBACInitializationService } from '../src/services/rbacInitializationService';
import { logger } from '../src/utils/logger';

async function initializeRBAC() {
  try {
    console.log('🚀 Starting RBAC initialization...');
    
    // Initialize the RBAC system
    await RBACInitializationService.initializeRBAC();
    
    // Validate the system
    console.log('🔍 Validating RBAC system integrity...');
    const validation = await RBACInitializationService.validateRBACIntegrity();
    
    if (validation.valid) {
      console.log('✅ RBAC system validation passed');
      console.log(`📊 System stats:
        - Total users: ${validation.stats.totalUsers}
        - Total roles: ${validation.stats.totalRoles}
        - Users with invalid roles: ${validation.stats.usersWithInvalidRoles}
        - Users with invalid permissions: ${validation.stats.usersWithInvalidPermissions}`);
    } else {
      console.log('⚠️  RBAC system validation found issues:');
      validation.issues.forEach(issue => console.log(`   - ${issue}`));
      
      console.log('🔧 Attempting to repair issues...');
      const repair = await RBACInitializationService.repairRBACIssues();
      
      if (repair.success) {
        console.log('✅ All issues repaired successfully');
        repair.repaired.forEach(fix => console.log(`   ✓ ${fix}`));
      } else {
        console.log('❌ Some issues could not be repaired:');
        repair.errors.forEach(error => console.log(`   ✗ ${error}`));
      }
    }
    
    console.log('🎉 RBAC initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ RBAC initialization failed:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
RBAC Initialization Script

Usage: npm run rbac:init [options]

Options:
  --help, -h     Show this help message
  --validate     Only validate the system, don't initialize
  --repair       Only repair issues, don't initialize

Examples:
  npm run rbac:init                    # Initialize RBAC system
  npm run rbac:init -- --validate     # Only validate
  npm run rbac:init -- --repair       # Only repair issues
  `);
  process.exit(0);
}

if (args.includes('--validate')) {
  // Only validate
  RBACInitializationService.validateRBACIntegrity()
    .then(validation => {
      if (validation.valid) {
        console.log('✅ RBAC system is valid');
      } else {
        console.log('⚠️  RBAC system has issues:');
        validation.issues.forEach(issue => console.log(`   - ${issue}`));
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
} else if (args.includes('--repair')) {
  // Only repair
  RBACInitializationService.repairRBACIssues()
    .then(repair => {
      if (repair.success) {
        console.log('✅ All issues repaired');
        repair.repaired.forEach(fix => console.log(`   ✓ ${fix}`));
      } else {
        console.log('❌ Some issues could not be repaired:');
        repair.errors.forEach(error => console.log(`   ✗ ${error}`));
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Repair failed:', error);
      process.exit(1);
    });
} else {
  // Full initialization
  initializeRBAC();
}