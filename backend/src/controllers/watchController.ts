import { Request, Response } from 'express';
import { Watch } from '../models/Watch';
import { Product } from '../models/Product';
import { WatchMonitoringService } from '../services/watchMonitoringService';
import { IWatch } from '../types/database';
import { logger } from '../utils/logger';
import { ResponseHelper } from '../utils/responseHelpers';
import { validateUUID } from '../utils/validation';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { PAGINATION } from '../constants';



export class WatchController {
  // Get user's watches with filtering and pagination
  static async getUserWatches(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
        return;
      }

      const {
        page = 1,
        limit = 20,
        is_active,
        product_id,
        retailer_id
      } = req.query as any;

      const options: any = {
        page: parseInt(page as string),
        limit: Math.min(parseInt(limit as string), 100), // Cap at 100
      };

      if (is_active !== undefined) {
        options.is_active = typeof is_active === 'boolean' ? is_active : String(is_active) === 'true';
      }

      let watches = await Watch.findByUserId(userId, options);

      // Additional filtering if needed
      if (product_id || retailer_id) {
        watches.data = watches.data.filter(watch => {
          if (product_id && watch.product_id !== product_id) return false;
          if (retailer_id && !watch.retailer_ids.includes(retailer_id as string)) return false;
          return true;
        });
      }

      ResponseHelper.successWithPagination(res, watches.data, {
        page: watches.page,
        limit: watches.limit,
        total: watches.total
      });
    } catch (error) {
      logger.error('Error getting user watches:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve watches');
    }
  }

  // Get specific watch by ID
  static async getWatch(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { watchId } = req.params;

      if (!userId) {
        ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
        return;
      }

      if (!watchId || !validateUUID(watchId)) {
        ResponseHelper.badRequest(res, 'Invalid watch ID format');
        return;
      }

      const watch = await Watch.findById<IWatch>(watchId);
      if (!watch) {
        ResponseHelper.notFound(res, 'Watch');
        return;
      }

      // Ensure user owns this watch
      if (watch.user_id !== userId) {
        ResponseHelper.error(res, 'ACCESS_DENIED', 'Access denied', 403);
        return;
      }

      ResponseHelper.success(res, watch);
    } catch (error) {
      logger.error('Error getting watch:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve watch');
    }
  }

  // Create a new watch
  static async createWatch(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
        return;
      }

      const {
        product_id,
        retailer_ids = [],
        max_price,
        availability_type = 'both',
        zip_code,
        radius_miles,
        alert_preferences = {}
      } = req.body;

      // Validate required fields
      if (!product_id) {
        ResponseHelper.badRequest(res, 'Product ID is required');
        return;
      }

      if (!validateUUID(product_id)) {
        ResponseHelper.badRequest(res, 'Invalid product ID format');
        return;
      }

      // Check if product exists
      const product = await Product.findById<any>(product_id);
      if (!product) {
        ResponseHelper.notFound(res, 'Product');
        return;
      }

      // Check if user already has a watch for this product
      const existingWatch = await Watch.findUserProductWatch(userId, product_id);
      if (existingWatch) {
        ResponseHelper.error(res, 'WATCH_EXISTS', 'Watch already exists for this product', 409);
        return;
      }

      // Create the watch
      const watchData: Partial<IWatch> = {
        user_id: userId,
        product_id,
        retailer_ids: Array.isArray(retailer_ids) ? retailer_ids : [],
        availability_type,
        zip_code,
        alert_preferences,
        is_active: true
      };

      // Only add numeric fields if they have valid values
      if (max_price && !isNaN(parseFloat(max_price))) {
        watchData.max_price = parseFloat(max_price);
      }
      if (radius_miles && !isNaN(parseInt(radius_miles))) {
        watchData.radius_miles = parseInt(radius_miles);
      }

      const watch = await Watch.createWatch(watchData);
      ResponseHelper.success(res, watch);
    } catch (error) {
      logger.error('Error creating watch:', error);
      if (error instanceof Error && error.message.includes('Validation failed')) {
        ResponseHelper.validationError(res, error.message);
      } else if (error instanceof Error) {
        // Log the full error details
        logger.error('Full error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        ResponseHelper.internalError(res, `Failed to create watch: ${error.message}`);
      } else {
        ResponseHelper.internalError(res, 'Failed to create watch');
      }
    }
  }

  // Update an existing watch
  static async updateWatch(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { watchId } = req.params;

      if (!userId) {
        ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
        return;
      }

      if (!watchId || !validateUUID(watchId)) {
        ResponseHelper.badRequest(res, 'Invalid watch ID format');
        return;
      }

      const existingWatch = await Watch.findById<IWatch>(watchId);
      if (!existingWatch) {
        ResponseHelper.notFound(res, 'Watch');
        return;
      }

      // Ensure user owns this watch
      if (existingWatch.user_id !== userId) {
        ResponseHelper.error(res, 'ACCESS_DENIED', 'Access denied', 403);
        return;
      }

      const {
        retailer_ids,
        max_price,
        availability_type,
        zip_code,
        radius_miles,
        alert_preferences,
        is_active
      } = req.body;

      const updateData: Partial<IWatch> = {};

      if (retailer_ids !== undefined) {
        updateData.retailer_ids = Array.isArray(retailer_ids) ? retailer_ids : [];
      }
      if (max_price !== undefined) {
        if (max_price) {
          updateData.max_price = parseFloat(max_price);
        } else {
          delete (updateData as any).max_price;
        }
      }
      if (availability_type !== undefined) {
        updateData.availability_type = availability_type;
      }
      if (zip_code !== undefined) {
        updateData.zip_code = zip_code;
      }
      if (radius_miles !== undefined) {
        if (radius_miles) {
          updateData.radius_miles = parseInt(radius_miles);
        } else {
          delete (updateData as any).radius_miles;
        }
      }
      if (alert_preferences !== undefined) {
        updateData.alert_preferences = { ...existingWatch.alert_preferences, ...alert_preferences };
      }
      if (is_active !== undefined) {
        updateData.is_active = Boolean(is_active);
      }

      const updatedWatch = await Watch.updateById<IWatch>(watchId, updateData);
      if (!updatedWatch) {
        ResponseHelper.internalError(res, 'Failed to update watch');
        return;
      }

      ResponseHelper.success(res, updatedWatch);
    } catch (error) {
      logger.error('Error updating watch:', error);
      if (error instanceof Error && error.message.includes('Validation failed')) {
        ResponseHelper.badRequest(res, error.message);
      } else {
        ResponseHelper.internalError(res, 'Failed to update watch');
      }
    }
  }

  // Delete a watch
  static async deleteWatch(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { watchId } = req.params;

      if (!userId) {
        ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
        return;
      }

      if (!watchId || !validateUUID(watchId)) {
        ResponseHelper.badRequest(res, 'Invalid watch ID format');
        return;
      }

      const watch = await Watch.findById<IWatch>(watchId);
      if (!watch) {
        ResponseHelper.notFound(res, 'Watch');
        return;
      }

      // Ensure user owns this watch
      if (watch.user_id !== userId) {
        ResponseHelper.error(res, 'ACCESS_DENIED', 'Access denied', 403);
        return;
      }

      const deleted = await Watch.deleteById(watchId);
      if (!deleted) {
        ResponseHelper.internalError(res, 'Failed to delete watch');
        return;
      }

      ResponseHelper.success(res, null);
    } catch (error) {
      logger.error('Error deleting watch:', error);
      ResponseHelper.internalError(res, 'Failed to delete watch');
    }
  }

  // Toggle watch active status
  static async toggleWatch(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { watchId } = req.params;

      if (!userId) {
        ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
        return;
      }

      if (!watchId || !validateUUID(watchId)) {
        ResponseHelper.badRequest(res, 'Invalid watch ID format');
        return;
      }

      const watch = await Watch.findById<IWatch>(watchId);
      if (!watch) {
        ResponseHelper.notFound(res, 'Watch');
        return;
      }

      // Ensure user owns this watch
      if (watch.user_id !== userId) {
        ResponseHelper.error(res, 'ACCESS_DENIED', 'Access denied', 403);
        return;
      }

      const success = await Watch.toggleActive(watchId);
      if (!success) {
        ResponseHelper.internalError(res, 'Failed to toggle watch status');
        return;
      }

      const updatedWatch = await Watch.findById<IWatch>(watchId);
      ResponseHelper.success(res, updatedWatch);
    } catch (error) {
      logger.error('Error toggling watch:', error);
      ResponseHelper.internalError(res, 'Failed to toggle watch status');
    }
  }

  // Get watch statistics for user
  static async getWatchStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
        return;
      }

      const stats = await Watch.getUserWatchStats(userId);
      ResponseHelper.success(res, stats);
    } catch (error) {
      logger.error('Error getting watch stats:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve watch statistics');
    }
  }

  // Bulk create watches from CSV
  static async bulkImportWatches(req: Request & { file?: Express.Multer.File }, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
        return;
      }

      if (!req.file) {
        ResponseHelper.badRequest(res, 'CSV file is required');
        return;
      }

      const csvData = req.file.buffer.toString();
      
      // Parse CSV using promise-based approach
      const records = await new Promise<any[]>((resolve, reject) => {
        parse(csvData, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        }, (err: any, data: any[]) => {
          if (err) {
            reject(new Error(`CSV parsing error: ${err.message}`));
          } else {
            resolve(data || []);
          }
        });
      });

      if (records.length === 0) {
        ResponseHelper.badRequest(res, 'No valid records found in CSV');
        return;
      }

      const watchesToCreate: Partial<IWatch>[] = [];
      const errors: string[] = [];

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNum = i + 2; // Account for header row

        try {
          // Validate required fields
          if (!record.product_id) {
            errors.push(`Row ${rowNum}: Product ID is required`);
            continue;
          }

          if (!validateUUID(record.product_id)) {
            errors.push(`Row ${rowNum}: Invalid product ID format`);
            continue;
          }

          // Check if product exists
          const product = await Product.findById<any>(record.product_id);
          if (!product) {
            errors.push(`Row ${rowNum}: Product not found`);
            continue;
          }

          // Check for duplicate watch
          const existingWatch = await Watch.findUserProductWatch(userId, record.product_id);
          if (existingWatch) {
            errors.push(`Row ${rowNum}: Watch already exists for this product`);
            continue;
          }

          const watchData: Partial<IWatch> = {
            user_id: userId,
            product_id: record.product_id,
            retailer_ids: record.retailer_ids ? record.retailer_ids.split(',').map((id: string) => id.trim()) : [],
            availability_type: record.availability_type || 'both',
            zip_code: record.zip_code || undefined,
            is_active: record.is_active !== 'false'
          };

          // Only add numeric fields if they're valid
          if (record.max_price && !isNaN(parseFloat(record.max_price))) {
            watchData.max_price = parseFloat(record.max_price);
          }
          if (record.radius_miles && !isNaN(parseInt(record.radius_miles))) {
            watchData.radius_miles = parseInt(record.radius_miles);
          }

          watchesToCreate.push(watchData);
        } catch (error) {
          errors.push(`Row ${rowNum}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (watchesToCreate.length === 0) {
        ResponseHelper.badRequest(res, `No valid watches to create. Errors: ${errors.join(', ')}`);
        return;
      }

      // Bulk create watches
      const createdWatches = await Watch.bulkCreate<IWatch>(watchesToCreate);

      const result = {
        created: createdWatches.length,
        errors: errors.length,
        errorDetails: errors
      };

      ResponseHelper.success(res, result);
    } catch (error) {
      logger.error('Error bulk importing watches:', error);
      ResponseHelper.internalError(res, 'Failed to import watches');
    }
  }

  // Export watches to CSV
  static async exportWatches(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
        return;
      }

      const { is_active } = req.query;
      const options: any = { page: PAGINATION.DEFAULT_PAGE, limit: PAGINATION.EXPORT_LIMIT }; // Large limit for export

      if (is_active !== undefined) {
        options.is_active = is_active === 'true';
      }

      const watches = await Watch.findByUserId(userId, options);

      // Convert to CSV format
      const csvData = watches.data.map(watch => ({
        id: watch.id,
        product_id: watch.product_id,
        retailer_ids: watch.retailer_ids.join(','),
        max_price: watch.max_price || '',
        availability_type: watch.availability_type,
        zip_code: watch.zip_code || '',
        radius_miles: watch.radius_miles || '',
        is_active: watch.is_active,
        alert_count: watch.alert_count,
        last_alerted: watch.last_alerted || '',
        created_at: watch.created_at
      }));

      const csvOutput = await new Promise<string>((resolve, reject) => {
        stringify(csvData, {
          header: true,
          columns: [
            'id', 'product_id', 'retailer_ids', 'max_price', 'availability_type',
            'zip_code', 'radius_miles', 'is_active', 'alert_count', 'last_alerted', 'created_at'
          ]
        }, (err: any, output: string) => {
          if (err) {
            reject(new Error(`CSV generation error: ${err.message}`));
          } else {
            resolve(output);
          }
        });
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="watches.csv"');
      res.send(csvOutput);
    } catch (error) {
      logger.error('Error exporting watches:', error);
      ResponseHelper.internalError(res, 'Failed to export watches');
    }
  }

  // Get watch health status
  static async getWatchHealth(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { watchId } = req.params;

      if (!userId) {
        ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
        return;
      }

      if (!watchId || !validateUUID(watchId)) {
        ResponseHelper.badRequest(res, 'Invalid watch ID format');
        return;
      }

      const watch = await Watch.findById<IWatch>(watchId);
      if (!watch) {
        ResponseHelper.notFound(res, 'Watch');
        return;
      }

      // Ensure user owns this watch
      if (watch.user_id !== userId) {
        ResponseHelper.error(res, 'ACCESS_DENIED', 'Access denied', 403);
        return;
      }

      const health = await WatchMonitoringService.checkWatchHealth(watchId);
      if (!health) {
        ResponseHelper.internalError(res, 'Failed to check watch health');
        return;
      }

      ResponseHelper.success(res, health);
    } catch (error) {
      logger.error('Error getting watch health:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve watch health status');
    }
  }

  // Get health status for all user watches
  static async getUserWatchesHealth(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
        return;
      }

      const healthStatuses = await WatchMonitoringService.checkUserWatchesHealth(userId);
      ResponseHelper.success(res, healthStatuses);
    } catch (error) {
      logger.error('Error getting user watches health:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve user watches health status');
    }
  }

  // Get watch performance metrics
  static async getWatchPerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
        return;
      }

      const metrics = await WatchMonitoringService.getWatchPerformanceMetrics(userId);
      ResponseHelper.success(res, metrics);
    } catch (error) {
      logger.error('Error getting watch performance metrics:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve watch performance metrics');
    }
  }

  // Get system watch health (admin only)
  static async getSystemWatchHealth(req: Request, res: Response): Promise<void> {
    try {
      const systemHealth = await WatchMonitoringService.getSystemWatchHealth();
      ResponseHelper.success(res, systemHealth);
    } catch (error) {
      logger.error('Error getting system watch health:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve system watch health');
    }
  }

  // Cleanup watches (admin only)
  static async cleanupWatches(req: Request, res: Response): Promise<void> {
    try {
      const cleanupResults = await WatchMonitoringService.cleanupWatches();
      ResponseHelper.success(res, cleanupResults);
    } catch (error) {
      logger.error('Error cleaning up watches:', error);
      ResponseHelper.internalError(res, 'Failed to cleanup watches');
    }
  }
}
