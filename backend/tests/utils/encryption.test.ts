import { encrypt, decrypt, generateEncryptionKey, hashSensitiveData, verifyHashedData, sanitizeForLogging, clearKeyCache, resetEncryptionManager } from '../../src/utils/encryption';

// Mock environment variable for testing
const originalEnv = process.env.ENCRYPTION_KEY;

describe('Encryption Utilities', () => {
  beforeEach(() => {
    // Reset singleton state before each test
    resetEncryptionManager();
    process.env.ENCRYPTION_KEY = generateEncryptionKey();
  });

  afterEach(() => {
    // Clean up after each test
    resetEncryptionManager();
  });

  afterAll(() => {
    // Restore original environment
    process.env.ENCRYPTION_KEY = originalEnv;
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt data correctly', () => {
      const plaintext = 'test-password-123';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toMatch(/^v1:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    });

    it('should produce different encrypted values for the same input', () => {
      const plaintext = 'same-password';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters and unicode', () => {
      const plaintext = 'pássw0rd!@#$%^&*()_+{}|:"<>?[]\\;\',./ 🔐';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for invalid encrypted data format', () => {
      expect(() => decrypt('invalid-format')).toThrow('Invalid encrypted data format');
      expect(() => decrypt('part1:part2')).toThrow('Invalid encrypted data format');
      expect(() => decrypt('part1:part2:part3:part4')).toThrow('Unsupported encryption version');
    });

    it('should throw error when encryption key is missing', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      
      try {
        // Delete the environment variable
        delete process.env.ENCRYPTION_KEY;
        
        // Reset the manager to force re-instantiation
        resetEncryptionManager();

        // This should throw an error
        expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is required');
      } finally {
        // Always restore the original key
        process.env.ENCRYPTION_KEY = originalKey;
        resetEncryptionManager();
      }
    });
  });

  describe('hashSensitiveData and verifyHashedData', () => {
    it('should hash and verify data correctly', () => {
      const data = 'sensitive-data-123';
      const hashed = hashSensitiveData(data);
      const isValid = verifyHashedData(data, hashed);

      expect(isValid).toBe(true);
      expect(hashed).not.toBe(data);
      expect(hashed).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
    });

    it('should produce different hashes for the same input', () => {
      const data = 'same-data';
      const hash1 = hashSensitiveData(data);
      const hash2 = hashSensitiveData(data);

      expect(hash1).not.toBe(hash2);
      expect(verifyHashedData(data, hash1)).toBe(true);
      expect(verifyHashedData(data, hash2)).toBe(true);
    });

    it('should use provided salt', () => {
      const data = 'test-data';
      const salt = 'fixed-salt-for-testing';
      const hash1 = hashSensitiveData(data, salt);
      const hash2 = hashSensitiveData(data, salt);

      expect(hash1).toBe(hash2);
      expect(verifyHashedData(data, hash1)).toBe(true);
    });

    it('should reject invalid data', () => {
      const data = 'correct-data';
      const wrongData = 'wrong-data';
      const hashed = hashSensitiveData(data);

      expect(verifyHashedData(wrongData, hashed)).toBe(false);
    });

    it('should handle invalid hash format', () => {
      const data = 'test-data';
      expect(verifyHashedData(data, 'invalid-format')).toBe(false);
      expect(verifyHashedData(data, 'only-one-part')).toBe(false);
    });
  });

  describe('sanitizeForLogging', () => {
    it('should sanitize sensitive fields', () => {
      const data = {
        username: 'testuser',
        password: 'secret123',
        email: 'test@example.com',
        api_key: 'sk-1234567890',
        normal_field: 'normal_value'
      };

      const sanitized = sanitizeForLogging(data);

      expect(sanitized.username).toBe('testuser');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.email).toBe('test@example.com');
      expect(sanitized.api_key).toBe('[REDACTED]');
      expect(sanitized.normal_field).toBe('normal_value');
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          name: 'John',
          password_hash: 'hashed-password',
          profile: {
            secret: 'top-secret',
            public_info: 'public'
          }
        },
        token: 'jwt-token'
      };

      const sanitized = sanitizeForLogging(data);

      expect(sanitized.user.name).toBe('John');
      expect(sanitized.user.password_hash).toBe('[REDACTED]');
      expect(sanitized.user.profile.secret).toBe('[REDACTED]');
      expect(sanitized.user.profile.public_info).toBe('public');
      expect(sanitized.token).toBe('[REDACTED]');
    });

    it('should handle arrays and primitive values', () => {
      expect(sanitizeForLogging('string')).toBe('string');
      expect(sanitizeForLogging(123)).toBe(123);
      expect(sanitizeForLogging(null)).toBe(null);
      expect(sanitizeForLogging(undefined)).toBe(undefined);
    });

    it('should handle empty objects', () => {
      const sanitized = sanitizeForLogging({});
      expect(sanitized).toEqual({});
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate a valid hex key', () => {
      const key = generateEncryptionKey();
      expect(key).toMatch(/^[a-f0-9]{64}$/);
      expect(key.length).toBe(64);
    });

    it('should generate different keys each time', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent encryption operations safely', async () => {
      const plaintext = 'concurrent-test';
      const promises = Array.from({ length: 10 }, () => 
        Promise.resolve(encrypt(plaintext))
      );
      
      const results = await Promise.all(promises);
      
      // All should decrypt to the same plaintext
      results.forEach(encrypted => {
        expect(decrypt(encrypted)).toBe(plaintext);
      });
      
      // All encrypted values should be different (due to random IV)
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(results.length);
    });
  });
});