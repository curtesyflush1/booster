import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AdminUserService } from '../services/adminUserService';
import { AdminMLService } from '../services/adminMLService';
import { AdminSystemService } from '../services/adminSystemService';
import { AdminAuditService } from '../services/adminAuditService';
import { logger } from '../utils/logger';
import { IUser } from '../types/database';

// Validation schemas
const userFiltersSchema = Joi.object({
  search: Joi.string().optional(),
  role: Joi.string().valid('user', 'admin', 'super_admin').optional(),
  subscription_tier: Joi.string().valid('free', 'pro').optional(),
  email_verified: Joi.boolean().optional(),
  created_after: Joi.date().optional(),
  created_before: Joi.date().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50)
});

const updateUserRoleSchema = Joi.object({
  role: Joi.string().valid('user', 'admin', 'super_admin').required(),
  permissions: Joi.array().items(Joi.string()).default([])
});

const suspendUserSchema = Joi.object({
  suspend: Joi.boolean().required(),
  reason: Joi.string().optional()
});

const mlModelSchema = Joi.object({
  name: Joi.string().required(),
  version: Joi.string().required(),
  config: Joi.object().default({}),
  training_notes: Joi.string().optional()
});

const reviewTrainingDataSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required(),
  review_notes: Joi.string().optional()
});

/**
 * Get admin dashboard statistics
 */
export const getDashboardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await AdminSystemService.getDashboardStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get users with filtering and pagination
 */
export const getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error, value } = userFiltersSchema.validate(req.query);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { page, limit, ...filters } = value;
    const result = await AdminUserService.getUsers(page, limit, filters);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user details by ID
 */
export const getUserDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const user = await AdminUserService.getUserDetails(userId);

    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user role and permissions
 */
export const updateUserRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { error, value } = updateUserRoleSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    if (!userId) {
      res.status(400).json({
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const adminUser = req.user as IUser;
    const { role, permissions } = value;

    const success = await AdminUserService.updateUserRole(
      adminUser.id,
      userId,
      role,
      permissions,
      req.ip,
      req.get('User-Agent')
    );

    if (!success) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'User role updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Suspend or unsuspend user
 */
export const suspendUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { error, value } = suspendUserSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    if (!userId) {
      res.status(400).json({
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const adminUser = req.user as IUser;
    const { suspend, reason } = value;

    const success = await AdminUserService.suspendUser(
      adminUser.id,
      userId,
      suspend,
      reason,
      req.ip,
      req.get('User-Agent')
    );

    if (!success) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `User ${suspend ? 'suspended' : 'unsuspended'} successfully`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user
 */
export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!userId) {
      res.status(400).json({
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const adminUser = req.user as IUser;

    const success = await AdminUserService.deleteUser(
      adminUser.id,
      userId,
      reason,
      req.ip,
      req.get('User-Agent')
    );

    if (!success) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get ML models
 */
export const getMLModels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const models = await AdminMLService.getMLModels();

    res.status(200).json({
      success: true,
      data: models
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create ML model training job
 */
export const createMLModel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error, value } = mlModelSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const adminUser = req.user as IUser;

    const model = await AdminMLService.createMLModel(
      adminUser.id,
      value,
      req.ip,
      req.get('User-Agent')
    );

    res.status(201).json({
      success: true,
      data: model,
      message: 'ML model training started'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deploy ML model
 */
export const deployMLModel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { modelId } = req.params;

    if (!modelId) {
      res.status(400).json({
        error: {
          code: 'MISSING_MODEL_ID',
          message: 'Model ID is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const adminUser = req.user as IUser;

    const success = await AdminMLService.deployMLModel(
      adminUser.id,
      modelId,
      req.ip,
      req.get('User-Agent')
    );

    if (!success) {
      res.status(404).json({
        error: {
          code: 'MODEL_NOT_FOUND',
          message: 'Model not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Model deployed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get training data for review
 */
export const getTrainingData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as 'pending' | 'approved' | 'rejected' | undefined;
    const dataType = req.query.dataType as string | undefined;

    const result = await AdminMLService.getTrainingData(page, limit, { status, dataType });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Review training data
 */
export const reviewTrainingData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { dataId } = req.params;
    const { error, value } = reviewTrainingDataSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    if (!dataId) {
      res.status(400).json({
        error: {
          code: 'MISSING_DATA_ID',
          message: 'Data ID is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const adminUser = req.user as IUser;
    const { status, review_notes } = value;

    const success = await AdminMLService.reviewTrainingData(
      adminUser.id,
      dataId,
      status,
      review_notes,
      req.ip,
      req.get('User-Agent')
    );

    if (!success) {
      res.status(404).json({
        error: {
          code: 'DATA_NOT_FOUND',
          message: 'Training data not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Training data reviewed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get system health
 */
export const getSystemHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const health = await AdminSystemService.getSystemHealth();

    res.status(200).json({
      success: true,
      data: health
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit logs
 */
export const getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const adminUserId = req.query.adminUserId as string | undefined;
    const action = req.query.action as string | undefined;
    const targetType = req.query.targetType as string | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const result = await AdminAuditService.getAuditLogs(page, limit, {
      adminUserId,
      action,
      targetType,
      startDate,
      endDate
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user statistics
 */
export const getUserStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await AdminUserService.getUserStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get ML statistics
 */
export const getMLStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await AdminMLService.getMLStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Trigger ML model retraining
 */
export const triggerRetraining = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { modelName } = req.params;
    const { config = {} } = req.body;

    if (!modelName) {
      res.status(400).json({
        error: {
          code: 'MISSING_MODEL_NAME',
          message: 'Model name is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const adminUser = req.user as IUser;

    const model = await AdminMLService.triggerRetraining(
      adminUser.id,
      modelName,
      config,
      req.ip,
      req.get('User-Agent')
    );

    res.status(201).json({
      success: true,
      data: model,
      message: 'Model retraining triggered successfully'
    });
  } catch (error) {
    next(error);
  }
};