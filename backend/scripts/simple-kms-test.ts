#!/usr/bin/env ts-node

/**
 * Simple KMS Test Script
 * 
 * This script tests the core KMS functionality without dependencies
 * on the full application stack.
 */

import dotenv from 'dotenv';
import { encrypt, decrypt } from '../src/utils/encryption';
import { EncryptionKeyManager } from '../src/utils/encryption/keyManager';

// Load environment variables
dotenv.config();

async function simpleKMSTest() {
  console.log('🔐 Simple KMS Test...\n');

  try {
    // Test 1: Basic encryption/decryption
    console.log('1. Testing basic encryption/decryption...');
    const testData = 'sensitive-test-data-12345';
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    
    if (decrypted === testData) {
      console.log('✅ Basic encryption/decryption works');
      console.log(`   Original: ${testData}`);
      console.log(`   Encrypted: ${encrypted.substring(0, 50)}...`);
      console.log(`   Decrypted: ${decrypted}`);
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

    // Test 3: Multiple encryption operations
    console.log('\n3. Testing multiple encryption operations...');
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

    // Test 4: Environment configuration
    console.log('\n4. Testing environment configuration...');
    console.log(`   KMS Provider: ${process.env.KMS_PROVIDER || 'env (default)'}`);
    console.log(`   KMS Key ID: ${process.env.KMS_KEY_ID || 'default'}`);
    console.log(`   Encryption Key Set: ${process.env.ENCRYPTION_KEY ? 'Yes' : 'No'}`);

    console.log('\n🎉 All simple KMS tests passed!');
    return true;

  } catch (error) {
    console.error('\n❌ Simple KMS test failed:', error);
    return false;
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  simpleKMSTest()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test script error:', error);
      process.exit(1);
    });
}

export { simpleKMSTest };