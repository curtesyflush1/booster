import { BaseModel } from '../models/BaseModel';
import { IMLModel, IMLTrainingData } from '../types/database';
import { AdminAuditService } from './adminAuditService';
import { logger } from '../utils/logger';

export class AdminMLService {
  /**
   * Get all ML models with their status
   */
  static async getMLModels(): Promise<IMLModel[]> {
    try {
      const models = await BaseModel.findAll<IMLModel>('ml_models', {
        orderBy: [{ column: 'created_at', order: 'desc' }]
      });

      return models;
    } catch (error) {
      logger.error('Failed to get ML models', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Failed to retrieve ML models');
    }
  }

  /**
   * Get ML model by ID
   */
  static async getMLModel(modelId: string): Promise<IMLModel | null> {
    try {
      return await BaseModel.findById<IMLModel>(modelId, 'ml_models');
    } catch (error) {
      logger.error('Failed to get ML model', {
        error: error instanceof Error ? error.message : String(error),
        modelId
      });
      throw new Error('Failed to retrieve ML model');
    }
  }

  /**
   * Create a new ML model training job
   */
  static async createMLModel(
    adminUserId: string,
    modelData: {
      name: string;
      version: string;
      config: Record<string, any>;
      training_notes?: string;
    },
    ipAddress?: string,
    userAgent?: string
  ): Promise<IMLModel> {
    try {
      const newModel = await BaseModel.create<IMLModel>({
        ...modelData,
        status: 'training',
        trained_by: adminUserId,
        training_started_at: new Date()
      }, 'ml_models');

      await AdminAuditService.logAction(
        adminUserId,
        'ml_model_created',
        'ml_model',
        newModel.id,
        { modelName: modelData.name, version: modelData.version },
        ipAddress,
        userAgent
      );

      logger.info('ML model training started', {
        adminUserId,
        modelId: newModel.id,
        modelName: modelData.name,
        version: modelData.version
      });

      return newModel;
    } catch (error) {
      logger.error('Failed to create ML model', {
        error: error instanceof Error ? error.message : String(error),
        adminUserId,
        modelData
      });
      throw new Error('Failed to create ML model');
    }
  }

  /**
   * Update ML model status and metrics
   */
  static async updateMLModel(
    adminUserId: string,
    modelId: string,
    updates: {
      status?: 'training' | 'active' | 'deprecated' | 'failed';
      metrics?: Record<string, any>;
      model_path?: string;
      training_notes?: string;
    },
    ipAddress?: string,
    userAgent?: string
  ): Promise<IMLModel | null> {
    try {
      const updateData: Partial<IMLModel> = { ...updates };

      // Set completion timestamp if status is changing to active or failed
      if (updates.status === 'active' || updates.status === 'failed') {
        updateData.training_completed_at = new Date();
        if (updates.status === 'active') {
          updateData.deployed_at = new Date();
        }
      }

      const updated = await BaseModel.updateById<IMLModel>(modelId, updateData, 'ml_models');

      if (updated) {
        await AdminAuditService.logAction(
          adminUserId,
          'ml_model_updated',
          'ml_model',
          modelId,
          updates,
          ipAddress,
          userAgent
        );

        logger.info('ML model updated', {
          adminUserId,
          modelId,
          updates
        });
      }

      return updated;
    } catch (error) {
      logger.error('Failed to update ML model', {
        error: error instanceof Error ? error.message : String(error),
        adminUserId,
        modelId,
        updates
      });
      throw new Error('Failed to update ML model');
    }
  }

  /**
   * Deploy ML model (set as active and deprecate others of same type)
   */
  static async deployMLModel(
    adminUserId: string,
    modelId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<boolean> {
    try {
      const model = await this.getMLModel(modelId);
      if (!model) {
        throw new Error('Model not found');
      }

      const knex = BaseModel.getKnex();

      await knex.transaction(async (trx) => {
        // Deprecate other active models of the same type
        await trx('ml_models')
          .where('name', model.name)
          .where('status', 'active')
          .where('id', '!=', modelId)
          .update({ status: 'deprecated' });

        // Activate the new model
        await trx('ml_models')
          .where('id', modelId)
          .update({
            status: 'active',
            deployed_at: new Date()
          });
      });

      await AdminAuditService.logAction(
        adminUserId,
        'ml_model_deployed',
        'ml_model',
        modelId,
        { modelName: model.name, version: model.version },
        ipAddress,
        userAgent
      );

      logger.info('ML model deployed', {
        adminUserId,
        modelId,
        modelName: model.name,
        version: model.version
      });

      return true;
    } catch (error) {
      logger.error('Failed to deploy ML model', {
        error: error instanceof Error ? error.message : String(error),
        adminUserId,
        modelId
      });
      throw new Error('Failed to deploy ML model');
    }
  }

  /**
   * Get training data for review
   */
  static async getTrainingData(
    page: number = 1,
    limit: number = 50,
    filters: {
      status?: 'pending' | 'approved' | 'rejected';
      dataType?: string;
    } = {}
  ): Promise<{
    data: IMLTrainingData[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const offset = (page - 1) * limit;
      const knex = BaseModel.getKnex();

      let query = knex('ml_training_data')
        .select('*')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      let countQuery = knex('ml_training_data').count('* as count');

      if (filters.status) {
        query = query.where('status', filters.status);
        countQuery = countQuery.where('status', filters.status);
      }

      if (filters.dataType) {
        query = query.where('data_type', filters.dataType);
        countQuery = countQuery.where('data_type', filters.dataType);
      }

      const [data, countResult] = await Promise.all([
        query,
        countQuery.first()
      ]);

      const total = parseInt(countResult?.count as string) || 0;

      return {
        data: data as IMLTrainingData[],
        total,
        page,
        limit
      };
    } catch (error) {
      logger.error('Failed to get training data', {
        error: error instanceof Error ? error.message : String(error),
        filters
      });
      throw new Error('Failed to retrieve training data');
    }
  }

  /**
   * Review training data (approve/reject)
   */
  static async reviewTrainingData(
    adminUserId: string,
    dataId: string,
    status: 'approved' | 'rejected',
    reviewNotes?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<boolean> {
    try {
      const updated = await BaseModel.updateById<IMLTrainingData>(dataId, {
        status,
        reviewed_by: adminUserId,
        reviewed_at: new Date(),
        review_notes: reviewNotes
      }, 'ml_training_data');

      if (updated) {
        await AdminAuditService.logAction(
          adminUserId,
          'training_data_reviewed',
          'training_data',
          dataId,
          { status, reviewNotes },
          ipAddress,
          userAgent
        );

        logger.info('Training data reviewed', {
          adminUserId,
          dataId,
          status,
          reviewNotes
        });
      }

      return updated !== null;
    } catch (error) {
      logger.error('Failed to review training data', {
        error: error instanceof Error ? error.message : String(error),
        adminUserId,
        dataId,
        status
      });
      throw new Error('Failed to review training data');
    }
  }

  /**
   * Get ML system statistics
   */
  static async getMLStats(): Promise<{
    active_models: number;
    training_models: number;
    failed_models: number;
    last_training: Date | null;
    pending_reviews: number;
    approved_datasets: number;
    model_performance: Record<string, any>;
  }> {
    try {
      const knex = BaseModel.getKnex();

      const [
        activeResult,
        trainingResult,
        failedResult,
        lastTrainingResult,
        pendingReviewsResult,
        approvedDatasetsResult,
        performanceResult
      ] = await Promise.all([
        knex('ml_models').where('status', 'active').count('* as count').first(),
        knex('ml_models').where('status', 'training').count('* as count').first(),
        knex('ml_models').where('status', 'failed').count('* as count').first(),
        knex('ml_models').max('training_started_at as last_training').first(),
        knex('ml_training_data').where('status', 'pending').count('* as count').first(),
        knex('ml_training_data').where('status', 'approved').count('* as count').first(),
        knex('ml_models')
          .select('name', 'metrics')
          .where('status', 'active')
      ]);

      const modelPerformance: Record<string, any> = {};
      performanceResult.forEach(model => {
        if (model.metrics) {
          modelPerformance[model.name] = model.metrics;
        }
      });

      return {
        active_models: parseInt(activeResult?.count as string) || 0,
        training_models: parseInt(trainingResult?.count as string) || 0,
        failed_models: parseInt(failedResult?.count as string) || 0,
        last_training: lastTrainingResult?.last_training || null,
        pending_reviews: parseInt(pendingReviewsResult?.count as string) || 0,
        approved_datasets: parseInt(approvedDatasetsResult?.count as string) || 0,
        model_performance: modelPerformance
      };
    } catch (error) {
      logger.error('Failed to get ML stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Failed to retrieve ML statistics');
    }
  }

  /**
   * Trigger model retraining
   */
  static async triggerRetraining(
    adminUserId: string,
    modelName: string,
    config: Record<string, any> = {},
    ipAddress?: string,
    userAgent?: string
  ): Promise<IMLModel> {
    try {
      // Get the latest version for this model type
      const latestModel = await BaseModel.getKnex()('ml_models')
        .where('name', modelName)
        .orderBy('created_at', 'desc')
        .first();

      const version = latestModel 
        ? `v${parseInt(latestModel.version.replace('v', '')) + 1}`
        : 'v1';

      const newModel = await this.createMLModel(
        adminUserId,
        {
          name: modelName,
          version,
          config,
          training_notes: 'Triggered retraining from admin dashboard'
        },
        ipAddress,
        userAgent
      );

      // Here you would typically trigger the actual ML training process
      // For now, we'll just log it
      logger.info('ML model retraining triggered', {
        adminUserId,
        modelName,
        version,
        modelId: newModel.id
      });

      return newModel;
    } catch (error) {
      logger.error('Failed to trigger retraining', {
        error: error instanceof Error ? error.message : String(error),
        adminUserId,
        modelName
      });
      throw new Error('Failed to trigger model retraining');
    }
  }
}