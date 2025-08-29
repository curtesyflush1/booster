/**
 * KMS Controller
 * 
 * This controller provides administrative endpoints for Key Management Service
 * operations including health monitoring, key rotation, and configuration management.
 */

import { Request, Response } from 'express';
import { KMSManagementService, createKMSManagementService } from '../services/kmsManagementService';
import { KMSConfig } from '../utils/encryption/kms/types';
import { responseHelpers } from '../utils/responseHelpers';
import { ILogger } from '../types/dependencies';
import { DependencyContainer } from '../container/DependencyContainer';

export class KMSController {
  private kmsManagementService: KMSManagementService;
  private logger: ILogger;

  constructor() {
    const container = DependencyContainer.getInstance();
    this.kmsManagementService = createKMSManagementService();
    this.logger = container.getLogger();
  }

  /**
   * Get KMS health status
   * GET /api/admin/kms/health
   */
  async getHealthStatus(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await this.kmsManagementService.getHealthStatus();
      
      this.logger.info('KMS health status requested', {
        userId: req.user?.id,
        provider: healthStatus.provider,
        healthy: healthStatus.healthy
      });

      responseHelpers.success(res, healthStatus, 'KMS health status retrieved successfully');
    } catch (error) {
      this.logger.error('Failed to get KMS health status', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      responseHelpers.error(res, 'Failed to get KMS health status', 500);
    }
  }

  /**
   * Get encryption key metadata
   * GET /api/admin/kms/key/metadata
   */
  async getKeyMetadata(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.kmsManagementService.getKeyMetadata();
      
      if (!result.success) {
        this.logger.warn('Failed to get key metadata', {
          userId: req.user?.id,
          error: result.error
        });
        
        responseHelpers.error(res, result.message, 500, result.error);
        return;
      }

      this.logger.info('Key metadata retrieved', {
        userId: req.user?.id,
        keyId: result.data?.keyId
      });

      responseHelpers.success(res, result.data, result.message);
    } catch (error) {
      this.logger.error('Failed to get key metadata', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      responseHelpers.error(res, 'Failed to get key metadata', 500);
    }
  }

  /**
   * Rotate encryption key
   * POST /api/admin/kms/key/rotate
   */
  async rotateKey(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.kmsManagementService.rotateEncryptionKey();
      
      if (!result.success) {
        this.logger.warn('Failed to rotate encryption key', {
          userId: req.user?.id,
          error: result.error
        });
        
        responseHelpers.error(res, result.message, 500, result.error);
        return;
      }

      this.logger.info('Encryption key rotated successfully', {
        userId: req.user?.id,
        newKeyVersion: result.data?.newKeyVersion
      });

      responseHelpers.success(res, result.data, result.message);
    } catch (error) {
      this.logger.error('Failed to rotate encryption key', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      responseHelpers.error(res, 'Failed to rotate encryption key', 500);
    }
  }

  /**
   * Get current KMS configuration
   * GET /api/admin/kms/config
   */
  async getConfiguration(req: Request, res: Response): Promise<void> {
    try {
      const config = this.kmsManagementService.getConfiguration();
      
      this.logger.info('KMS configuration requested', {
        userId: req.user?.id,
        provider: config?.provider
      });

      responseHelpers.success(res, config, 'KMS configuration retrieved successfully');
    } catch (error) {
      this.logger.error('Failed to get KMS configuration', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      responseHelpers.error(res, 'Failed to get KMS configuration', 500);
    }
  }

  /**
   * Test KMS configuration
   * POST /api/admin/kms/config/test
   */
  async testConfiguration(req: Request, res: Response): Promise<void> {
    try {
      const config: KMSConfig = req.body;
      
      if (!config || !config.provider || !config.keyId) {
        responseHelpers.error(res, 'Invalid KMS configuration provided', 400);
        return;
      }

      const result = await this.kmsManagementService.testConfiguration(config);
      
      this.logger.info('KMS configuration test completed', {
        userId: req.user?.id,
        provider: config.provider,
        success: result.success
      });

      if (!result.success) {
        responseHelpers.error(res, result.message, 400, result.error);
        return;
      }

      responseHelpers.success(res, result.data, result.message);
    } catch (error) {
      this.logger.error('Failed to test KMS configuration', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      responseHelpers.error(res, 'Failed to test KMS configuration', 500);
    }
  }

  /**
   * Update KMS configuration
   * PUT /api/admin/kms/config
   */
  async updateConfiguration(req: Request, res: Response): Promise<void> {
    try {
      const config: KMSConfig = req.body;
      
      if (!config || !config.provider || !config.keyId) {
        responseHelpers.error(res, 'Invalid KMS configuration provided', 400);
        return;
      }

      const result = await this.kmsManagementService.updateConfiguration(config);
      
      this.logger.info('KMS configuration update attempted', {
        userId: req.user?.id,
        provider: config.provider,
        success: result.success
      });

      if (!result.success) {
        responseHelpers.error(res, result.message, 400, result.error);
        return;
      }

      responseHelpers.success(res, result.data, result.message);
    } catch (error) {
      this.logger.error('Failed to update KMS configuration', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      responseHelpers.error(res, 'Failed to update KMS configuration', 500);
    }
  }

  /**
   * Create new encryption key
   * POST /api/admin/kms/key/create
   */
  async createKey(req: Request, res: Response): Promise<void> {
    try {
      const { keyId, description } = req.body;
      
      if (!keyId || typeof keyId !== 'string') {
        responseHelpers.error(res, 'Valid keyId is required', 400);
        return;
      }

      const result = await this.kmsManagementService.createEncryptionKey(keyId, description);
      
      this.logger.info('Encryption key creation attempted', {
        userId: req.user?.id,
        keyId,
        success: result.success
      });

      if (!result.success) {
        responseHelpers.error(res, result.message, 500, result.error);
        return;
      }

      responseHelpers.success(res, result.data, result.message);
    } catch (error) {
      this.logger.error('Failed to create encryption key', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      responseHelpers.error(res, 'Failed to create encryption key', 500);
    }
  }
}