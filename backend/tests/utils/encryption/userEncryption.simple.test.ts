import { UserEncryptionService } from '../../../src/utils/encryption/userEncryption';

describe('UserEncryptionService - Simple Tests', () => {
  let userEncryption: UserEncryptionService;
  const testUserId = 'test-user-123';
  const testPassword = 'securePassword123!';
  const testPlaintext = 'sensitive retailer password';

  beforeEach(() => {
    userEncryption = new UserEncryptionService();
  });

  describe('Basic Encryption/Decryption', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const encrypted = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, testUserId);
      const decrypted = await userEncryption.decryptWithUserKey(encrypted, testPassword, testUserId);
      
      expect(decrypted).toBe(testPlaintext);
    });

    it('should produce different encrypted output for different users', async () => {
      const encrypted1 = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, 'user1');
      const encrypted2 = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, 'user2');
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should fail with wrong password', async () => {
      const encrypted = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, testUserId);
      
      await expect(userEncryption.decryptWithUserKey(encrypted, 'wrongPassword123!', testUserId))
        .rejects.toThrow();
    });

    it('should identify user-encrypted data', async () => {
      const encrypted = await userEncryption.encryptWithUserKey(testPlaintext, testPassword, testUserId);
      
      expect(UserEncryptionService.isUserEncrypted(encrypted)).toBe(true);
      expect(UserEncryptionService.isUserEncrypted('v1:iv:tag:data')).toBe(false);
    });

    it('should validate empty plaintext', async () => {
      await expect(userEncryption.encryptWithUserKey('', testPassword, testUserId))
        .rejects.toThrow();
    });

    it('should validate short password', async () => {
      await expect(userEncryption.encryptWithUserKey(testPlaintext, 'short', testUserId))
        .rejects.toThrow();
    });
  });
});