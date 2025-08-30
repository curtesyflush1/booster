import { UserEncryptionService } from '../../../src/utils/encryption/userEncryption';
import { EncryptionError, EncryptionErrorCodes } from '../../../src/utils/encryption/types';

describe('UserEncryptionService', () => {
  let userEncryption: UserEncryptionService;
  const testUserId = 'test-user-123';
  const testPassword = 'securePassword123!';
  const testPlaintext = 'sensitive retailer password';

  beforeEach(() => {
    userEncryption = new UserEncryptionService();
  });

  afterEach(() => {
    userEncryption.resetPerformanceMetrics();
  });

  describe('encryptWithUserKey', () => {
    it('should encrypt data with user-specific key', async () => {
      const encrypted = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, testUserId);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).toContain('user-v1:');
      expect(encrypted.split(':')).toHaveLength(5); // version:salt:iv:authTag:encrypted
    });

    it('should produce different encrypted output for same input with different users', async () => {
      const encrypted1 = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, 'user1');
      const encrypted2 = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, 'user2');
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should produce different encrypted output for same user with different passwords', async () => {
      const encrypted1 = await userEncryption.encryptWithUserKey(testPlaintext, 'password1', testUserId);
      const encrypted2 = await userEncryption.encryptWithUserKey(testPlaintext, 'password2', testUserId);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should produce different encrypted output for multiple encryptions (different salts)', async () => {
      const encrypted1 = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, testUserId);
      const encrypted2 = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, testUserId);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error for invalid plaintext', async () => {
      await expect(userEncryption.encryptWithUserKey('', testPassword, testUserId))
        .rejects.toThrow(EncryptionError);
    });

    it('should throw error for invalid user password', async () => {
      await expect(userEncryption.encryptWithUserKey(testPlaintext, 'short', testUserId))
        .rejects.toThrow(EncryptionError);
    });

    it('should throw error for invalid user ID', async () => {
      await expect(userEncryption.encryptWithUserKey(testPlaintext, testPassword, ''))
        .rejects.toThrow(EncryptionError);
    });
  });

  describe('decryptWithUserKey', () => {
    it('should decrypt data encrypted with same user key', async () => {
      const encrypted = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, testUserId);
      const decrypted = await userEncryption.decryptWithUserKey(encrypted, testPassword, testUserId);
      
      expect(decrypted).toBe(testPlaintext);
    });

    it('should fail to decrypt with wrong password', async () => {
      const encrypted = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, testUserId);
      
      await expect(userEncryption.decryptWithUserKey(encrypted, 'wrongPassword', testUserId))
        .rejects.toThrow(EncryptionError);
    });

    it('should fail to decrypt with wrong user ID', async () => {
      const encrypted = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, testUserId);
      
      await expect(userEncryption.decryptWithUserKey(encrypted, testPassword, 'wrong-user'))
        .rejects.toThrow(EncryptionError);
    });

    it('should throw error for invalid encrypted data format', async () => {
      await expect(userEncryption.decryptWithUserKey('invalid:format', testPassword, testUserId))
        .rejects.toThrow(EncryptionError);
    });

    it('should throw error for wrong version', async () => {
      const invalidVersionData = 'wrong-v1:salt:iv:tag:data';
      
      await expect(userEncryption.decryptWithUserKey(invalidVersionData, testPassword, testUserId))
        .rejects.toThrow(EncryptionError);
    });

    it('should handle large data correctly', async () => {
      const largeData = 'x'.repeat(10000);
      const encrypted = await userEncryption.encryptWithUserKey(largeData, testPassword, testUserId);
      const decrypted = await userEncryption.decryptWithUserKey(encrypted, testPassword, testUserId);
      
      expect(decrypted).toBe(largeData);
    });
  });

  describe('isUserEncrypted', () => {
    it('should identify user-encrypted data correctly', async () => {
      const encrypted = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, testUserId);
      
      expect(UserEncryptionService.isUserEncrypted(encrypted)).toBe(true);
    });

    it('should return false for non-user-encrypted data', () => {
      const globalEncrypted = 'v1:iv:tag:data'; // Global format
      
      expect(UserEncryptionService.isUserEncrypted(globalEncrypted)).toBe(false);
    });

    it('should return false for invalid data', () => {
      expect(UserEncryptionService.isUserEncrypted('invalid')).toBe(false);
      expect(UserEncryptionService.isUserEncrypted('')).toBe(false);
    });
  });

  describe('migrateToUserEncryption', () => {
    it('should migrate global-encrypted data to user-specific encryption', async () => {
      const globalEncrypted = 'v1:iv:tag:encryptedData';
      const mockGlobalDecrypt = jest.fn().mockReturnValue(testPlaintext);
      
      const migrated = await userEncryption.migrateToUserEncryption(
        globalEncrypted,
        testPassword,
        testUserId,
        mockGlobalDecrypt
      );
      
      expect(mockGlobalDecrypt).toHaveBeenCalledWith(globalEncrypted);
      expect(UserEncryptionService.isUserEncrypted(migrated)).toBe(true);
      
      // Verify we can decrypt the migrated data
      const decrypted = await userEncryption.decryptWithUserKey(migrated, testPassword, testUserId);
      expect(decrypted).toBe(testPlaintext);
    });

    it('should handle migration errors gracefully', async () => {
      const globalEncrypted = 'v1:iv:tag:encryptedData';
      const mockGlobalDecrypt = jest.fn().mockImplementation(() => {
        throw new Error('Decryption failed');
      });
      
      await expect(userEncryption.migrateToUserEncryption(
        globalEncrypted,
        testPassword,
        testUserId,
        mockGlobalDecrypt
      )).rejects.toThrow(EncryptionError);
    });
  });

  describe('performance tracking', () => {
    it('should track encryption performance', async () => {
      await userEncryption.encryptWithUserKey(testPlaintext, testPassword, testUserId);
      
      const metrics = userEncryption.getPerformanceMetrics();
      expect(metrics.operationCount).toBeGreaterThan(0);
      expect(metrics.encryptionTime).toBeGreaterThan(0);
    });

    it('should track decryption performance', async () => {
      const encrypted = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, testUserId);
      userEncryption.resetPerformanceMetrics(); // Reset to isolate decryption metrics
      
      await userEncryption.decryptWithUserKey(encrypted, testPassword, testUserId);
      
      const metrics = userEncryption.getPerformanceMetrics();
      expect(metrics.operationCount).toBeGreaterThan(0);
      expect(metrics.decryptionTime).toBeGreaterThan(0);
    });

    it('should reset performance metrics correctly', async () => {
      await userEncryption.encryptWithUserKey(testPlaintext, testPassword, testUserId);
      userEncryption.resetPerformanceMetrics();
      
      const metrics = userEncryption.getPerformanceMetrics();
      expect(metrics.operationCount).toBe(0);
      expect(metrics.encryptionTime).toBe(0);
      expect(metrics.decryptionTime).toBe(0);
    });
  });

  describe('standard IEncryptionService methods', () => {
    it('should throw error for encrypt method', () => {
      expect(() => userEncryption.encrypt(testPlaintext)).toThrow(EncryptionError);
    });

    it('should throw error for encryptAsync method', async () => {
      await expect(userEncryption.encryptAsync(testPlaintext)).rejects.toThrow(EncryptionError);
    });

    it('should throw error for decrypt method', () => {
      expect(() => userEncryption.decrypt('encrypted')).toThrow(EncryptionError);
    });

    it('should throw error for decryptAsync method', async () => {
      await expect(userEncryption.decryptAsync('encrypted')).rejects.toThrow(EncryptionError);
    });
  });

  describe('security considerations', () => {
    it('should use different salts for each encryption', async () => {
      const encrypted1 = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, testUserId);
      const encrypted2 = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, testUserId);
      
      const parts1 = encrypted1.split(':');
      const parts2 = encrypted2.split(':');
      
      // Salt should be different (index 1)
      expect(parts1[1]).not.toBe(parts2[1]);
    });

    it('should use high iteration count for key derivation', async () => {
      // This test ensures the key derivation is computationally expensive
      const startTime = Date.now();
      await userEncryption.encryptWithUserKey(testPlaintext, testPassword, testUserId);
      const endTime = Date.now();
      
      // Should take some time due to key derivation (at least 1ms in test mode)
      expect(endTime - startTime).toBeGreaterThan(1);
    });

    it('should produce cryptographically secure random salts', async () => {
      const salts = new Set();
      
      // Generate multiple encryptions and collect salts
      for (let i = 0; i < 10; i++) {
        const encrypted = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, testUserId);
        const salt = encrypted.split(':')[1];
        salts.add(salt);
      }
      
      // All salts should be unique
      expect(salts.size).toBe(10);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in plaintext', async () => {
      const specialText = '!@#$%^&*()_+{}|:"<>?[]\\;\',./ 中文 🔒';
      const encrypted = await userEncryption.encryptWithUserKey(specialText, testPassword, testUserId);
      const decrypted = await userEncryption.decryptWithUserKey(encrypted, testPassword, testUserId);
      
      expect(decrypted).toBe(specialText);
    });

    it('should handle special characters in password', async () => {
      const specialPassword = 'P@ssw0rd!#$%^&*()_+{}|:"<>?[]\\;\',./ 中文';
      const encrypted = await userEncryption.encryptWithUserKey(testPlaintext, specialPassword, testUserId);
      const decrypted = await userEncryption.decryptWithUserKey(encrypted, specialPassword, testUserId);
      
      expect(decrypted).toBe(testPlaintext);
    });

    it('should handle special characters in user ID', async () => {
      const specialUserId = 'user-123!@#$%^&*()_+{}|:"<>?[]\\;\',./ 中文';
      const encrypted = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, specialUserId);
      const decrypted = await userEncryption.decryptWithUserKey(encrypted, testPassword, specialUserId);
      
      expect(decrypted).toBe(testPlaintext);
    });

    it('should handle empty plaintext after validation', async () => {
      // This should be caught by validation
      await expect(userEncryption.encryptWithUserKey('', testPassword, testUserId))
        .rejects.toThrow(EncryptionError);
    });
  });
});