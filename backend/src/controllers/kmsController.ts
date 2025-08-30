/**
 * KMS Controller
 * 
 * This controller provides administrative endpoints for Key Management Service
 * operations including health monitoring, key rotation, and configuration management.
 */

import { Request, Response } from 'express';
import { KMSManagementService, createKMSManagementService } from '../services/kmsManagementService';
import { KMSConfig } from '../utils/encryption/kms/types';
import { ResponseHelper, successResponse, errorResponse } from '../utils/responseHelpers';
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

      successResponse(res, healthStatus, 'KMS health status retrieved successfully');
    } catch (error) {
      this.logger.error('Failed to get KMS health status', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      errorResponse(res, 500, 'Failed to get KMS health status');
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
        
        errorResponse(res, 500, result.message);
        return;
      }

      this.logger.info('Key metadata retrieved', {
        userId: req.user?.id,
        keyId: result.data?.keyId
      });

      successResponse(res, result.data, result.message);
    } catch (error) {
      this.logger.error('Failed to get key metadata', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      errorResponse(res, 500, 'Failed to get key metadata');
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
        
        errorResponse(res, 500, result.message);
        return;
      }

      this.logger.info('Encryption key rotated successfully', {
        userId: req.user?.id,
        newKeyVersion: result.data?.newKeyVersion
      });

      successResponse(res, result.data, result.message);
    } catch (error) {
      this.logger.error('Failed to rotate encryption key', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      errorResponse(res, 500, 'Failed to rotate encryption key');
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

      successResponse(res, config, 'KMS configuration retrieved successfully');
    } catch (error) {
      this.logger.error('Failed to get KMS configuration', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      errorResponse(res, 500, 'Failed to get KMS configuration');
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
        errorResponse(res, 400, 'Invalid KMS configuration provided');
        return;
      }

      const result = await this.kmsManagementService.testConfiguration(config);
      
      this.logger.info('KMS configuration test completed', {
        userId: req.user?.id,
        provider: config.provider,
        success: result.success
      });

      if (!result.success) {
        errorResponse(res, 400, result.message);
        return;
      }

      successResponse(res, result.data, result.message);
    } catch (error) {
      this.logger.error('Failed to test KMS configuration', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      errorResponse(res, 500, 'Failed to test KMS configuration');
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
        errorResponse(res, 400, 'Invalid KMS configuration provided');
        return;
      }

      const result = await this.kmsManagementService.updateConfiguration(config);
      
      this.logger.info('KMS configuration update attempted', {
        userId: req.user?.id,
        provider: config.provider,
        success: result.success
      });

      if (!result.success) {
        errorResponse(res, 400, result.message);
        return;
      }

      successResponse(res, result.data, result.message);
    } catch (error) {
      this.logger.error('Failed to update KMS configuration', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      errorResponse(res, 500, 'Failed to update KMS configuration');
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
        errorResponse(res, 400, 'Valid keyId is required');
        return;
      }

      const result = await this.kmsManagementService.createEncryptionKey(keyId, description);
      
      this.logger.info('Encryption key creation attempted', {
        userId: req.user?.id,
        keyId,
        success: result.success
      });

      if (!result.success) {
        errorResponse(res, 500, result.message);
        return;
      }

      successResponse(res, result.data, result.message);
    } catch (error) {
      this.logger.error('Failed to create encryption key', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      errorResponse(res, 500, 'Failed to create encryption key');
    }
  }
}