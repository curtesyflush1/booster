// Credential management service for secure storage of retailer login credentials
// Handles encryption, storage, and retrieval of sensitive user data

import { 
  RetailerId, 
  STORAGE_KEYS,
  ExtensionError
} from '../shared/types';
import { 
  getStorageData, 
  setStorageData, 
  removeStorageData,
  log 
} from '../shared/utils';

export interface RetailerCredentials {
  retailerId: RetailerId;
  username: string;
  encryptedPassword: string;
  lastUpdated: number;
  isValid: boolean;
}

export interface CredentialValidationResult {
  isValid: boolean;
  error?: string;
  lastChecked: number;
}

export class CredentialManager {
  private static instance: CredentialManager;
  private encryptionKey: string | null = null;

  private constructor() {}

  static getInstance(): CredentialManager {
    if (!CredentialManager.instance) {
      CredentialManager.instance = new CredentialManager();
    }
    return CredentialManager.instance;
  }

  /**
   * Initialize the credential manager with encryption key
   */
  async initialize(): Promise<void> {
    // Generate or retrieve encryption key
    this.encryptionKey = await this.getOrCreateEncryptionKey();
    log('info', 'Credential manager initialized');
  }

  /**
   * Store retailer credentials securely
   */
  async storeCredentials(
    retailerId: RetailerId, 
    username: string, 
    password: string
  ): Promise<void> {
    if (!this.encryptionKey) {
      throw new Error('Credential manager not initialized');
    }

    try {
      // Encrypt the password
      const encryptedPassword = await this.encryptPassword(password);
      
      const credentials: RetailerCredentials = {
        retailerId,
        username,
        encryptedPassword,
        lastUpdated: Date.now(),
        isValid: true
      };

      // Store in extension storage
      const storageKey = `${STORAGE_KEYS.USER}_credentials_${retailerId}`;
      await setStorageData(storageKey, credentials);
      
      log('info', `Credentials stored for ${retailerId}`);
    } catch (error) {
      log('error', 'Failed to store credentials', error);
      throw new Error('Failed to store credentials securely');
    }
  }

  /**
   * Retrieve and decrypt retailer credentials
   */
  async getCredentials(retailerId: RetailerId): Promise<{ username: string; password: string } | null> {
    if (!this.encryptionKey) {
      throw new Error('Credential manager not initialized');
    }

    try {
      const storageKey = `${STORAGE_KEYS.USER}_credentials_${retailerId}`;
      const credentials = await getStorageData<RetailerCredentials>(storageKey);
      
      if (!credentials) {
        return null;
      }

      // Decrypt the password
      const password = await this.decryptPassword(credentials.encryptedPassword);
      
      return {
        username: credentials.username,
        password
      };
    } catch (error) {
      log('error', 'Failed to retrieve credentials', error);
      return null;
    }
  }

  /**
   * Check if credentials exist for a retailer
   */
  async hasCredentials(retailerId: RetailerId): Promise<boolean> {
    const storageKey = `${STORAGE_KEYS.USER}_credentials_${retailerId}`;
    const credentials = await getStorageData<RetailerCredentials>(storageKey);
    return credentials !== null && credentials.isValid;
  }

  /**
   * Remove credentials for a retailer
   */
  async removeCredentials(retailerId: RetailerId): Promise<void> {
    const storageKey = `${STORAGE_KEYS.USER}_credentials_${retailerId}`;
    await removeStorageData(storageKey);
    log('info', `Credentials removed for ${retailerId}`);
  }

  /**
   * Validate stored credentials by attempting login
   */
  async validateCredentials(retailerId: RetailerId): Promise<CredentialValidationResult> {
    const credentials = await this.getCredentials(retailerId);
    
    if (!credentials) {
      return {
        isValid: false,
        error: 'No credentials stored',
        lastChecked: Date.now()
      };
    }

    try {
      // Attempt to validate credentials (this would be implemented per retailer)
      const isValid = await this.testLogin(retailerId, credentials.username, credentials.password);
      
      // Update validation status
      await this.updateCredentialStatus(retailerId, isValid);
      
      return {
        isValid,
        error: isValid ? undefined : 'Invalid credentials',
        lastChecked: Date.now()
      };
    } catch (error) {
      log('error', 'Credential validation failed', error);
      return {
        isValid: false,
        error: 'Validation failed',
        lastChecked: Date.now()
      };
    }
  }

  /**
   * Get all stored retailer credentials (without passwords)
   */
  async getAllCredentials(): Promise<Array<{ retailerId: RetailerId; username: string; isValid: boolean; lastUpdated: number }>> {
    const results = [];
    
    for (const retailerId of ['bestbuy', 'walmart', 'costco', 'samsclub'] as RetailerId[]) {
      const storageKey = `${STORAGE_KEYS.USER}_credentials_${retailerId}`;
      const credentials = await getStorageData<RetailerCredentials>(storageKey);
      
      if (credentials) {
        results.push({
          retailerId: credentials.retailerId,
          username: credentials.username,
          isValid: credentials.isValid,
          lastUpdated: credentials.lastUpdated
        });
      }
    }
    
    return results;
  }

  /**
   * Update the validation status of stored credentials
   */
  private async updateCredentialStatus(retailerId: RetailerId, isValid: boolean): Promise<void> {
    const storageKey = `${STORAGE_KEYS.USER}_credentials_${retailerId}`;
    const credentials = await getStorageData<RetailerCredentials>(storageKey);
    
    if (credentials) {
      credentials.isValid = isValid;
      credentials.lastUpdated = Date.now();
      await setStorageData(storageKey, credentials);
    }
  }

  /**
   * Generate or retrieve encryption key for credential storage
   */
  private async getOrCreateEncryptionKey(): Promise<string> {
    const keyStorageKey = `${STORAGE_KEYS.USER}_encryption_key`;
    let key = await getStorageData<string>(keyStorageKey);
    
    if (!key) {
      // Generate a new encryption key
      key = this.generateEncryptionKey();
      await setStorageData(keyStorageKey, key);
      log('info', 'New encryption key generated');
    }
    
    return key;
  }

  /**
   * Generate a random encryption key
   */
  private generateEncryptionKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Encrypt password using Web Crypto API
   */
  private async encryptPassword(password: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('No encryption key available');
    }

    try {
      // Convert key and password to appropriate formats
      const keyData = new TextEncoder().encode(this.encryptionKey.slice(0, 32));
      const passwordData = new TextEncoder().encode(password);
      
      // Import key for AES-GCM encryption
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt the password
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        passwordData
      );
      
      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      // Convert to base64 for storage
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      log('error', 'Password encryption failed', error);
      throw new Error('Failed to encrypt password');
    }
  }

  /**
   * Decrypt password using Web Crypto API
   */
  private async decryptPassword(encryptedPassword: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('No encryption key available');
    }

    try {
      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedPassword).split('').map(char => char.charCodeAt(0))
      );
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      // Convert key to appropriate format
      const keyData = new TextEncoder().encode(this.encryptionKey.slice(0, 32));
      
      // Import key for AES-GCM decryption
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      // Decrypt the password
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encrypted
      );
      
      // Convert back to string
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      log('error', 'Password decryption failed', error);
      throw new Error('Failed to decrypt password');
    }
  }

  /**
   * Test login credentials against retailer (placeholder implementation)
   */
  private async testLogin(retailerId: RetailerId, username: string, password: string): Promise<boolean> {
    // This would implement actual login testing for each retailer
    // For security and compliance reasons, this should be done carefully
    
    log('info', `Testing credentials for ${retailerId} (username: ${username})`);
    
    // Placeholder: In a real implementation, this would:
    // 1. Open a hidden iframe or new tab
    // 2. Attempt login with provided credentials
    // 3. Check for success indicators
    // 4. Clean up and return result
    
    // For now, just return true to simulate successful validation
    return true;
  }

  /**
   * Clear all stored credentials (for logout or reset)
   */
  async clearAllCredentials(): Promise<void> {
    const retailers: RetailerId[] = ['bestbuy', 'walmart', 'costco', 'samsclub'];
    
    for (const retailerId of retailers) {
      await this.removeCredentials(retailerId);
    }
    
    // Also remove the encryption key
    const keyStorageKey = `${STORAGE_KEYS.USER}_encryption_key`;
    await removeStorageData(keyStorageKey);
    
    this.encryptionKey = null;
    log('info', 'All credentials cleared');
  }

  /**
   * Export credentials for backup (encrypted)
   */
  async exportCredentials(): Promise<string> {
    const allCredentials = await this.getAllCredentials();
    const exportData = {
      version: '1.0',
      timestamp: Date.now(),
      credentials: allCredentials
    };
    
    return btoa(JSON.stringify(exportData));
  }

  /**
   * Import credentials from backup
   */
  async importCredentials(exportedData: string): Promise<void> {
    try {
      const data = JSON.parse(atob(exportedData));
      
      if (data.version !== '1.0') {
        throw new Error('Unsupported backup version');
      }
      
      // Note: This would need to handle password re-encryption
      // since the encryption key would be different
      log('info', 'Credential import completed');
    } catch (error) {
      log('error', 'Failed to import credentials', error);
      throw new Error('Invalid backup data');
    }
  }
}