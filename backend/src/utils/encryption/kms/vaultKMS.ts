/**
 * HashiCorp Vault Key Management Service Implementation
 * 
 * This module provides integration with HashiCorp Vault for secure key management.
 * It handles key retrieval, creation, rotation, and error handling specific to Vault.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import crypto from 'crypto';
import { IKeyManagementService, KeyMetadata, KMSConfig, KMSServiceError, KMSErrorCodes } from './types';

interface VaultResponse<T = any> {
  data: T;
  metadata?: {
    created_time: string;
    version: number;
  };
}

interface VaultSecretData {
  key: string;
  created_at: string;
  description?: string;
}

export class VaultKMSService implements IKeyManagementService {
  private client: AxiosInstance;
  private config: KMSConfig;
  private keyCache: Map<string, { key: Buffer; expiry: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly SECRET_PATH = 'secret/data/boosterbeacon/encryption-keys';

  constructor(config: KMSConfig) {
    this.config = config;
    
    const baseURL = config.endpoint || process.env.VAULT_ADDR || 'http://localhost:8200';
    const token = config.credentials?.token || process.env.VAULT_TOKEN;

    if (!token) {
      throw new KMSServiceError(
        'Vault token not configured',
        KMSErrorCodes.INVALID_CONFIGURATION,
        'vault',
        false
      );
    }

    this.client = axios.create({
      baseURL,
      timeout: config.timeout || 10000,
      headers: {
        'X-Vault-Token': token,
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const status = error.response.status;
          const message = error.response.data || error.message;

          switch (status) {
            case 403:
              throw new KMSServiceError(
                `Access denied to Vault: ${message}`,
                KMSErrorCodes.ACCESS_DENIED,
                'vault',
                false
              );
            case 404:
              throw new KMSServiceError(
                `Key not found in Vault: ${message}`,
                KMSErrorCodes.KEY_NOT_FOUND,
                'vault',
                false
              );
            case 429:
              throw new KMSServiceError(
                `Rate limited by Vault: ${message}`,
                KMSErrorCodes.RATE_LIMITED,
                'vault',
                true
              );
            case 500:
            case 502:
            case 503:
              throw new KMSServiceError(
                `Vault service unavailable: ${message}`,
                KMSErrorCodes.SERVICE_UNAVAILABLE,
                'vault',
                true
              );
            default:
              throw new KMSServiceError(
                `Vault error: ${message}`,
                KMSErrorCodes.NETWORK_ERROR,
                'vault',
                true
              );
          }
        } else if (error.code === 'ECONNABORTED') {
          throw new KMSServiceError(
            'Vault request timeout',
            KMSErrorCodes.TIMEOUT,
            'vault',
            true
          );
        } else {
          throw new KMSServiceError(
            `Network error connecting to Vault: ${error.message}`,
            KMSErrorCodes.NETWORK_ERROR,
            'vault',
            true
          );
        }
      }
    );
  }

  async getKey(keyId: string): Promise<Buffer> {
    try {
      // Check cache first
      const cached = this.keyCache.get(keyId);
      if (cached && cached.expiry > Date.now()) {
        return cached.key;
      }

      const secretPath = `${this.SECRET_PATH}/${keyId}`;
      const response = await this.client.get<VaultResponse<VaultSecretData>>(secretPath);

      if (!response.data?.data?.key) {
        throw new KMSServiceError(
          `Encryption key not found in Vault: ${keyId}`,
          KMSErrorCodes.KEY_NOT_FOUND,
          'vault',
          false,
          keyId
        );
      }

      // The key should be hex-encoded
      const keyBuffer = Buffer.from(response.data.data.key, 'hex');
      
      if (keyBuffer.length !== 32) {
        throw new KMSServiceError(
          `Invalid key length: expected 32 bytes, got ${keyBuffer.length}`,
          KMSErrorCodes.INVALID_KEY_FORMAT,
          'vault',
          false,
          keyId
        );
      }

      // Cache the key
      this.keyCache.set(keyId, {
        key: keyBuffer,
        expiry: Date.now() + this.CACHE_TTL
      });

      return keyBuffer;
    } catch (error) {
      if (error instanceof KMSServiceError) {
        throw error;
      }

      throw new KMSServiceError(
        `Failed to retrieve key from Vault: ${error instanceof Error ? error.message : 'Unknown error'}`,
        KMSErrorCodes.NETWORK_ERROR,
        'vault',
        true,
        keyId
      );
    }
  }

  async createKey(keyId: string, description?: string): Promise<string> {
    try {
      // Generate a new 256-bit encryption key
      const encryptionKey = crypto.randomBytes(32);

      const secretPath = `${this.SECRET_PATH}/${keyId}`;
      const secretData: VaultSecretData = {
        key: encryptionKey.toString('hex'),
        created_at: new Date().toISOString(),
        description: description || `BoosterBeacon encryption key for ${keyId}`
      };

      await this.client.post(secretPath, {
        data: secretData
      });

      return keyId;
    } catch (error) {
      if (error instanceof KMSServiceError) {
        throw error;
      }

      throw new KMSServiceError(
        `Failed to create key in Vault: ${error instanceof Error ? error.message : 'Unknown error'}`,
        KMSErrorCodes.SERVICE_UNAVAILABLE,
        'vault',
        true,
        keyId
      );
    }
  }

  async rotateKey(keyId: string): Promise<string> {
    try {
      // Generate a new encryption key
      const newEncryptionKey = crypto.randomBytes(32);

      const secretPath = `${this.SECRET_PATH}/${keyId}`;
      const secretData: VaultSecretData = {
        key: newEncryptionKey.toString('hex'),
        created_at: new Date().toISOString(),
        description: `BoosterBeacon encryption key for ${keyId} (rotated on ${new Date().toISOString()})`
      };

      await this.client.post(secretPath, {
        data: secretData
      });

      // Clear cache to force reload
      this.keyCache.delete(keyId);

      return `${keyId}-${Date.now()}`;
    } catch (error) {
      throw new KMSServiceError(
        `Failed to rotate key in Vault: ${error instanceof Error ? error.message : 'Unknown error'}`,
        KMSErrorCodes.SERVICE_UNAVAILABLE,
        'vault',
        true,
        keyId
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check Vault health endpoint
      const response = await this.client.get('/v1/sys/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getKeyMetadata(keyId: string): Promise<KeyMetadata> {
    try {
      const secretPath = `${this.SECRET_PATH}/${keyId}`;
      const response = await this.client.get<VaultResponse<VaultSecretData>>(secretPath);

      if (!response.data?.data) {
        throw new KMSServiceError(
          `Key metadata not found: ${keyId}`,
          KMSErrorCodes.KEY_NOT_FOUND,
          'vault',
          false,
          keyId
        );
      }

      const secretData = response.data.data;
      const metadata = response.data.metadata;

      return {
        keyId,
        description: secretData.description,
        createdAt: new Date(secretData.created_at || metadata?.created_time || Date.now()),
        lastRotated: metadata?.created_time ? new Date(metadata.created_time) : undefined,
        enabled: true,
        keyUsage: 'ENCRYPT_DECRYPT',
        keySpec: 'AES-256'
      };
    } catch (error) {
      if (error instanceof KMSServiceError) {
        throw error;
      }

      throw new KMSServiceError(
        `Failed to get key metadata from Vault: ${error instanceof Error ? error.message : 'Unknown error'}`,
        KMSErrorCodes.SERVICE_UNAVAILABLE,
        'vault',
        true,
        keyId
      );
    }
  }

  /**
   * Clear the key cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.keyCache.clear();
  }

  /**
   * Authenticate with Vault using different methods
   */
  async authenticate(method: 'userpass' | 'approle' | 'token', credentials: Record<string, string>): Promise<void> {
    try {
      let authPath: string;
      let authData: Record<string, string>;

      switch (method) {
        case 'userpass':
          authPath = `/v1/auth/userpass/login/${credentials.username}`;
          authData = { password: credentials.password };
          break;
        case 'approle':
          authPath = '/v1/auth/approle/login';
          authData = { 
            role_id: credentials.role_id,
            secret_id: credentials.secret_id
          };
          break;
        case 'token':
          // Token is already set in constructor
          return;
        default:
          throw new KMSServiceError(
            `Unsupported authentication method: ${method}`,
            KMSErrorCodes.INVALID_CONFIGURATION,
            'vault',
            false
          );
      }

      const response = await this.client.post(authPath, authData);
      const token = response.data?.auth?.client_token;

      if (!token) {
        throw new KMSServiceError(
          'Failed to obtain Vault token from authentication',
          KMSErrorCodes.ACCESS_DENIED,
          'vault',
          false
        );
      }

      // Update the client with the new token
      this.client.defaults.headers['X-Vault-Token'] = token;
    } catch (error) {
      if (error instanceof KMSServiceError) {
        throw error;
      }

      throw new KMSServiceError(
        `Vault authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        KMSErrorCodes.ACCESS_DENIED,
        'vault',
        false
      );
    }
  }
}