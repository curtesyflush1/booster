// Tests for credential manager service

import { CredentialManager, RetailerCredentials } from '../../src/services/credentialManager';
import { RetailerId } from '../../src/shared/types';

// Mock the shared utilities
jest.mock('../../src/shared/utils', () => ({
  getStorageData: jest.fn(),
  setStorageData: jest.fn(),
  removeStorageData: jest.fn(),
  log: jest.fn()
}));

// Mock Web Crypto API
const mockCrypto = {
  getRandomValues: jest.fn((arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
  subtle: {
    importKey: jest.fn().mockResolvedValue('mock-crypto-key'),
    encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    decrypt: jest.fn().mockResolvedValue(new TextEncoder().encode('decrypted-password'))
  }
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
});

// Mock TextEncoder/TextDecoder
global.TextEncoder = class {
  encode(str: string) {
    return new Uint8Array(str.split('').map(c => c.charCodeAt(0)));
  }
};

global.TextDecoder = class {
  decode(arr: Uint8Array) {
    return String.fromCharCode(...arr);
  }
};

// Mock btoa/atob
global.btoa = jest.fn((str) => Buffer.from(str, 'binary').toString('base64'));
global.atob = jest.fn((str) => Buffer.from(str, 'base64').toString('binary'));

describe('CredentialManager', () => {
  let credentialManager: CredentialManager;
  const mockRetailerId: RetailerId = 'bestbuy';
  const mockUsername = 'testuser@example.com';
  const mockPassword = 'testpassword123';

  beforeEach(() => {
    credentialManager = CredentialManager.getInstance();
    jest.clearAllMocks();
    
    // Mock storage operations
    const { getStorageData, setStorageData } = require('../../src/shared/utils');
    getStorageData.mockResolvedValue(null);
    setStorageData.mockResolvedValue(true);
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = CredentialManager.getInstance();
      const instance2 = CredentialManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const { getStorageData } = require('../../src/shared/utils');
      getStorageData.mockResolvedValue('mock-encryption-key');

      await expect(credentialManager.initialize()).resolves.not.toThrow();
    });

    it('should generate new encryption key if none exists', async () => {
      const { getStorageData, setStorageData } = require('../../src/shared/utils');
      getStorageData.mockResolvedValue(null);

      await credentialManager.initialize();

      expect(setStorageData).toHaveBeenCalledWith(
        expect.stringContaining('encryption_key'),
        expect.any(String)
      );
    });
  });

  describe('credential storage', () => {
    beforeEach(async () => {
      await credentialManager.initialize();
    });

    it('should store credentials successfully', async () => {
      const { setStorageData } = require('../../src/shared/utils');

      await credentialManager.storeCredentials(mockRetailerId, mockUsername, mockPassword);

      expect(setStorageData).toHaveBeenCalledWith(
        expect.stringContaining(`credentials_${mockRetailerId}`),
        expect.objectContaining({
          retailerId: mockRetailerId,
          username: mockUsername,
          encryptedPassword: expect.any(String),
          isValid: true,
          lastUpdated: expect.any(Number)
        })
      );
    });

    it('should handle encryption errors', async () => {
      // Mock crypto to throw error
      mockCrypto.subtle.encrypt.mockRejectedValueOnce(new Error('Encryption failed'));

      await expect(
        credentialManager.storeCredentials(mockRetailerId, mockUsername, mockPassword)
      ).rejects.toThrow('Failed to store credentials securely');
    });
  });

  describe('credential retrieval', () => {
    beforeEach(async () => {
      await credentialManager.initialize();
    });

    it('should retrieve and decrypt credentials successfully', async () => {
      const mockStoredCredentials: RetailerCredentials = {
        retailerId: mockRetailerId,
        username: mockUsername,
        encryptedPassword: 'encrypted-password-data',
        lastUpdated: Date.now(),
        isValid: true
      };

      const { getStorageData } = require('../../src/shared/utils');
      getStorageData.mockResolvedValue(mockStoredCredentials);

      const result = await credentialManager.getCredentials(mockRetailerId);

      expect(result).toEqual({
        username: mockUsername,
        password: 'decrypted-password'
      });
    });

    it('should return null if no credentials stored', async () => {
      const { getStorageData } = require('../../src/shared/utils');
      getStorageData.mockResolvedValue(null);

      const result = await credentialManager.getCredentials(mockRetailerId);

      expect(result).toBeNull();
    });

    it('should handle decryption errors', async () => {
      const mockStoredCredentials: RetailerCredentials = {
        retailerId: mockRetailerId,
        username: mockUsername,
        encryptedPassword: 'invalid-encrypted-data',
        lastUpdated: Date.now(),
        isValid: true
      };

      const { getStorageData } = require('../../src/shared/utils');
      getStorageData.mockResolvedValue(mockStoredCredentials);

      // Mock crypto to throw error
      mockCrypto.subtle.decrypt.mockRejectedValueOnce(new Error('Decryption failed'));

      const result = await credentialManager.getCredentials(mockRetailerId);

      expect(result).toBeNull();
    });
  });

  describe('credential validation', () => {
    beforeEach(async () => {
      await credentialManager.initialize();
    });

    it('should check if credentials exist', async () => {
      const mockStoredCredentials: RetailerCredentials = {
        retailerId: mockRetailerId,
        username: mockUsername,
        encryptedPassword: 'encrypted-password-data',
        lastUpdated: Date.now(),
        isValid: true
      };

      const { getStorageData } = require('../../src/shared/utils');
      getStorageData.mockResolvedValue(mockStoredCredentials);

      const hasCredentials = await credentialManager.hasCredentials(mockRetailerId);

      expect(hasCredentials).toBe(true);
    });

    it('should return false if no credentials exist', async () => {
      const { getStorageData } = require('../../src/shared/utils');
      getStorageData.mockResolvedValue(null);

      const hasCredentials = await credentialManager.hasCredentials(mockRetailerId);

      expect(hasCredentials).toBe(false);
    });

    it('should return false if credentials are invalid', async () => {
      const mockStoredCredentials: RetailerCredentials = {
        retailerId: mockRetailerId,
        username: mockUsername,
        encryptedPassword: 'encrypted-password-data',
        lastUpdated: Date.now(),
        isValid: false
      };

      const { getStorageData } = require('../../src/shared/utils');
      getStorageData.mockResolvedValue(mockStoredCredentials);

      const hasCredentials = await credentialManager.hasCredentials(mockRetailerId);

      expect(hasCredentials).toBe(false);
    });

    it('should validate credentials successfully', async () => {
      const mockStoredCredentials: RetailerCredentials = {
        retailerId: mockRetailerId,
        username: mockUsername,
        encryptedPassword: 'encrypted-password-data',
        lastUpdated: Date.now(),
        isValid: true
      };

      const { getStorageData } = require('../../src/shared/utils');
      getStorageData.mockResolvedValue(mockStoredCredentials);

      const result = await credentialManager.validateCredentials(mockRetailerId);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.lastChecked).toBeGreaterThan(0);
    });

    it('should handle validation when no credentials exist', async () => {
      const { getStorageData } = require('../../src/shared/utils');
      getStorageData.mockResolvedValue(null);

      const result = await credentialManager.validateCredentials(mockRetailerId);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('No credentials stored');
    });
  });

  describe('credential management', () => {
    beforeEach(async () => {
      await credentialManager.initialize();
    });

    it('should remove credentials successfully', async () => {
      const { removeStorageData } = require('../../src/shared/utils');

      await credentialManager.removeCredentials(mockRetailerId);

      expect(removeStorageData).toHaveBeenCalledWith(
        expect.stringContaining(`credentials_${mockRetailerId}`)
      );
    });

    it('should get all credentials without passwords', async () => {
      const mockCredentials = {
        bestbuy: {
          retailerId: 'bestbuy' as RetailerId,
          username: 'user1@example.com',
          encryptedPassword: 'encrypted1',
          lastUpdated: Date.now(),
          isValid: true
        },
        walmart: {
          retailerId: 'walmart' as RetailerId,
          username: 'user2@example.com',
          encryptedPassword: 'encrypted2',
          lastUpdated: Date.now(),
          isValid: false
        }
      };

      const { getStorageData } = require('../../src/shared/utils');
      getStorageData.mockImplementation((key: string) => {
        if (key.includes('credentials_bestbuy')) {
          return Promise.resolve(mockCredentials.bestbuy);
        }
        if (key.includes('credentials_walmart')) {
          return Promise.resolve(mockCredentials.walmart);
        }
        return Promise.resolve(null);
      });

      const result = await credentialManager.getAllCredentials();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        retailerId: 'bestbuy',
        username: 'user1@example.com',
        isValid: true,
        lastUpdated: expect.any(Number)
      });
      expect(result[1]).toEqual({
        retailerId: 'walmart',
        username: 'user2@example.com',
        isValid: false,
        lastUpdated: expect.any(Number)
      });
    });

    it('should clear all credentials', async () => {
      const { removeStorageData } = require('../../src/shared/utils');

      await credentialManager.clearAllCredentials();

      // Should remove credentials for all retailers plus encryption key
      expect(removeStorageData).toHaveBeenCalledTimes(5); // 4 retailers + encryption key
    });
  });

  describe('encryption/decryption', () => {
    beforeEach(async () => {
      await credentialManager.initialize();
    });

    it('should use Web Crypto API for encryption', async () => {
      await credentialManager.storeCredentials(mockRetailerId, mockUsername, mockPassword);

      expect(mockCrypto.subtle.importKey).toHaveBeenCalled();
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();
    });

    it('should use Web Crypto API for decryption', async () => {
      const mockStoredCredentials: RetailerCredentials = {
        retailerId: mockRetailerId,
        username: mockUsername,
        encryptedPassword: 'encrypted-password-data',
        lastUpdated: Date.now(),
        isValid: true
      };

      const { getStorageData } = require('../../src/shared/utils');
      getStorageData.mockResolvedValue(mockStoredCredentials);

      await credentialManager.getCredentials(mockRetailerId);

      expect(mockCrypto.subtle.importKey).toHaveBeenCalled();
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();
    });

    it('should generate random encryption key', async () => {
      const { getStorageData, setStorageData } = require('../../src/shared/utils');
      getStorageData.mockResolvedValue(null); // No existing key

      await credentialManager.initialize();

      expect(mockCrypto.getRandomValues).toHaveBeenCalled();
      expect(setStorageData).toHaveBeenCalledWith(
        expect.stringContaining('encryption_key'),
        expect.any(String)
      );
    });
  });

  describe('import/export functionality', () => {
    beforeEach(async () => {
      await credentialManager.initialize();
    });

    it('should export credentials successfully', async () => {
      const mockCredentials = [
        {
          retailerId: 'bestbuy' as RetailerId,
          username: 'user@example.com',
          isValid: true,
          lastUpdated: Date.now()
        }
      ];

      // Mock getAllCredentials
      jest.spyOn(credentialManager, 'getAllCredentials').mockResolvedValue(mockCredentials);

      const exported = await credentialManager.exportCredentials();

      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
      
      // Should be base64 encoded
      const decoded = JSON.parse(atob(exported));
      expect(decoded.version).toBe('1.0');
      expect(decoded.credentials).toEqual(mockCredentials);
    });

    it('should handle import with invalid data', async () => {
      const invalidData = btoa('invalid json');

      await expect(credentialManager.importCredentials(invalidData)).rejects.toThrow('Invalid backup data');
    });

    it('should handle import with unsupported version', async () => {
      const unsupportedData = btoa(JSON.stringify({
        version: '2.0',
        credentials: []
      }));

      await expect(credentialManager.importCredentials(unsupportedData)).rejects.toThrow('Unsupported backup version');
    });
  });
});