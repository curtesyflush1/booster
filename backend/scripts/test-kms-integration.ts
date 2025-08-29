#!/usr/bin/env ts-node

/**
 * KMS Integration Test Script
 * 
 * This script tests the KMS integration end-to-end to ensure
 * encryption and decryption work correctly with the new KMS system.
 */

import dotenv from 'dotenv';
import { encrypt, decrypt } from '../src/utils/encryption';
import { EncryptionKeyManager } from '../src/utils/encryption/keyManager';
import { createKMSManagementService } from '../src/services/kmsManagementService';
import { logger } from '../src/utils/logger';

// Load environment variables
dotenv.config();

async function testKMSIntegration() {
  console.log('🔐 Testing KMS Integration...\n');

  try {
    // Test 1: Basic encryption/decryption
    console.log('1. Testing basic encryption/decryption...');
    const testData = 'sensitive-test-data-12345';
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    
    if (decrypted === testData) {
      console.log('✅ Basic encryption/decryption works');
    } else {
      console.log('❌ Basic encryption/decryption failed');
      return false;
    }

    // Test 2: Key manager functionality
    console.log('\n2. Testing key manager...');
    const keyManager = EncryptionKeyManager.getInstance();
    
    // Test synchronous key retrieval
    const syncKey = keyManager.getKeySync();
    console.log(`✅ Synchronous key retrieval: ${syncKey.length} bytes`);
    
    // Test asynchronous key retrieval
    const asyncKey = await keyManager.getKey();
    console.log(`✅ Asynchronous key retrieval: ${asyncKey.length} bytes`);
    
    // Keys should be the same
    if (Buffer.compare(syncKey, asyncKey) === 0) {
      console.log('✅ Sync and async keys match');
    } else {
      console.log('❌ Sync and async keys do not match');
      return false;
    }

    // Test 3: Key metadata
    console.log('\n3. Testing key metadata...');
    try {
      const metadata = await keyManager.getKeyMetadata();
      console.log(`✅ Key metadata retrieved:`, {
        keyId: metadata.keyId,
        enabled: metadata.enabled,
        keyUsage: 'keyUsage' in metadata ? metadata.keyUsage : 'N/A',
        keySpec: 'keySpec' in metadata ? metadata.keySpec : 'N/A'
      });
    } catch (error) {
      console.log('⚠️  Key metadata not available (expected for env provider)');
    }

    // Test 4: Health check
    console.log('\n4. Testing KMS health check...');
    const healthy = await keyManager.healthCheck();
    console.log(`✅ KMS health check: ${healthy ? 'healthy' : 'unhealthy'}`);

    // Test 5: KMS Management Service
    console.log('\n5. Testing KMS Management Service...');
    const kmsService = createKMSManagementService();
    
    const healthStatus = await kmsService.getHealthStatus();
    console.log(`✅ KMS Management Service health:`, {
      provider: healthStatus.provider,
      healthy: healthStatus.healthy,
      responseTime: healthStatus.responseTime
    });

    // Test 6: Configuration
    console.log('\n6. Testing configuration...');
    const config = kmsService.getConfiguration();
    console.log(`✅ Current configuration:`, config || 'Environment provider (no config)');

    // Test 7: Multiple encryption operations
    console.log('\n7. Testing multiple encryption operations...');
    const testCases = [
      'short',
      'medium length test string',
      'very long test string with special characters: !@#$%^&*()_+-=[]{}|;:,.<>?',
      '🔐 Unicode test with emojis 🚀 and special chars ñáéíóú',
      JSON.stringify({ nested: { object: 'test', array: [1, 2, 3] } })
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const enc = encrypt(testCase);
      const dec = decrypt(enc);
      
      if (dec === testCase) {
        console.log(`✅ Test case ${i + 1}: ${testCase.substring(0, 30)}${testCase.length > 30 ? '...' : ''}`);
      } else {
        console.log(`❌ Test case ${i + 1} failed`);
        return false;
      }
    }

    console.log('\n🎉 All KMS integration tests passed!');
    return true;

  } catch (error) {
    console.error('\n❌ KMS integration test failed:', error);
    return false;
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testKMSIntegration()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test script error:', error);
      process.exit(1);
    });
}

export { testKMSIntegration };