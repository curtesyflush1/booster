import { Request, Response } from 'express';
import { Watch } from '../models/Watch';
import { Product } from '../models/Product';
import { WatchMonitoringService } from '../services/watchMonitoringService';
import { IWatch } from '../types/database';
import { logger } from '../utils/logger';
import { successResponse, errorResponse } from '../utils/responseHelpers';
import { validateUUID } from '../utils/validation';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';



export class WatchController {
  // Get user's watches with filtering and pagination
  static async getUserWatches(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        errorResponse(res, 401, 'Unauthorized');
        return;
      }

      const {
        page = 1,
        limit = 20,
        is_active,
        product_id,
        retailer_id
      } = req.query;

      const options: any = {
        page: parseInt(page as string),
        limit: Math.min(parseInt(limit as string), 100), // Cap at 100
      };

      if (is_active !== undefined) {
        options.is_active = is_active === 'true';
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

      successResponse(res, watches, 'Watches retrieved successfully');
    } catch (error) {
      logger.error('Error getting user watches:', error);
      errorResponse(res, 500, 'Failed to retrieve watches');
    }
  }

  // Get specific watch by ID
  static async getWatch(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { watchId } = req.params;

      if (!userId) {
        errorResponse(res, 401, 'Unauthorized');
        return;
      }

      if (!watchId || !validateUUID(watchId)) {
        errorResponse(res, 400, 'Invalid watch ID format');
        return;
      }

      const watch = await Watch.findById<IWatch>(watchId);
      if (!watch) {
        errorResponse(res, 404, 'Watch not found');
        return;
      }

      // Ensure user owns this watch
      if (watch.user_id !== userId) {
        errorResponse(res, 403, 'Access denied');
        return;
      }

      successResponse(res, watch, 'Watch retrieved successfully');
    } catch (error) {
      logger.error('Error getting watch:', error);
      errorResponse(res, 500, 'Failed to retrieve watch');
    }
  }

  // Create a new watch
  static async createWatch(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        errorResponse(res, 401, 'Unauthorized');
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
        errorResponse(res, 400, 'Product ID is required');
        return;
      }

      if (!validateUUID(product_id)) {
        errorResponse(res, 400, 'Invalid product ID format');
        return;
      }

      // Check if product exists
      const product = await Product.findById<any>(product_id);
      if (!product) {
        errorResponse(res, 404, 'Product not found');
        return;
      }

      // Check if user already has a watch for this product
      const existingWatch = await Watch.findUserProductWatch(userId, product_id);
      if (existingWatch) {
        errorResponse(res, 409, 'Watch already exists for this product');
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
      successResponse(res, watch, 'Watch created successfully', 201);
    } catch (error) {
      logger.error('Error creating watch:', error);
      if (error instanceof Error && error.message.includes('Validation failed')) {
        errorResponse(res, 400, error.message);
      } else {
        errorResponse(res, 500, 'Failed to create watch');
      }
    }
  }

  // Update an existing watch
  static async updateWatch(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { watchId } = req.params;

      if (!userId) {
        errorResponse(res, 401, 'Unauthorized');
        return;
      }

      if (!watchId || !validateUUID(watchId)) {
        errorResponse(res, 400, 'Invalid watch ID format');
        return;
      }

      const existingWatch = await Watch.findById<IWatch>(watchId);
      if (!existingWatch) {
        errorResponse(res, 404, 'Watch not found');
        return;
      }

      // Ensure user owns this watch
      if (existingWatch.user_id !== userId) {
        errorResponse(res, 403, 'Access denied');
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
        errorResponse(res, 500, 'Failed to update watch');
        return;
      }

      successResponse(res, updatedWatch, 'Watch updated successfully');
    } catch (error) {
      logger.error('Error updating watch:', error);
      if (error instanceof Error && error.message.includes('Validation failed')) {
        errorResponse(res, 400, error.message);
      } else {
        errorResponse(res, 500, 'Failed to update watch');
      }
    }
  }

  // Delete a watch
  static async deleteWatch(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { watchId } = req.params;

      if (!userId) {
        errorResponse(res, 401, 'Unauthorized');
        return;
      }

      if (!watchId || !validateUUID(watchId)) {
        errorResponse(res, 400, 'Invalid watch ID format');
        return;
      }

      const watch = await Watch.findById<IWatch>(watchId);
      if (!watch) {
        errorResponse(res, 404, 'Watch not found');
        return;
      }

      // Ensure user owns this watch
      if (watch.user_id !== userId) {
        errorResponse(res, 403, 'Access denied');
        return;
      }

      const deleted = await Watch.deleteById(watchId);
      if (!deleted) {
        errorResponse(res, 500, 'Failed to delete watch');
        return;
      }

      successResponse(res, null, 'Watch deleted successfully');
    } catch (error) {
      logger.error('Error deleting watch:', error);
      errorResponse(res, 500, 'Failed to delete watch');
    }
  }

  // Toggle watch active status
  static async toggleWatch(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { watchId } = req.params;

      if (!userId) {
        errorResponse(res, 401, 'Unauthorized');
        return;
      }

      if (!watchId || !validateUUID(watchId)) {
        errorResponse(res, 400, 'Invalid watch ID format');
        return;
      }

      const watch = await Watch.findById<IWatch>(watchId);
      if (!watch) {
        errorResponse(res, 404, 'Watch not found');
        return;
      }

      // Ensure user owns this watch
      if (watch.user_id !== userId) {
        errorResponse(res, 403, 'Access denied');
        return;
      }

      const success = await Watch.toggleActive(watchId);
      if (!success) {
        errorResponse(res, 500, 'Failed to toggle watch status');
        return;
      }

      const updatedWatch = await Watch.findById<IWatch>(watchId);
      successResponse(res, updatedWatch, 'Watch status updated successfully');
    } catch (error) {
      logger.error('Error toggling watch:', error);
      errorResponse(res, 500, 'Failed to toggle watch status');
    }
  }

  // Get watch statistics for user
  static async getWatchStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        errorResponse(res, 401, 'Unauthorized');
        return;
      }

      const stats = await Watch.getUserWatchStats(userId);
      successResponse(res, stats, 'Watch statistics retrieved successfully');
    } catch (error) {
      logger.error('Error getting watch stats:', error);
      errorResponse(res, 500, 'Failed to retrieve watch statistics');
    }
  }

  // Bulk create watches from CSV
  static async bulkImportWatches(req: Request & { file?: Express.Multer.File }, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        errorResponse(res, 401, 'Unauthorized');
        return;
      }

      if (!req.file) {
        errorResponse(res, 400, 'CSV file is required');
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
        errorResponse(res, 400, 'No valid records found in CSV');
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
        errorResponse(res, 400, `No valid watches to create. Errors: ${errors.join(', ')}`);
        return;
      }

      // Bulk create watches
      const createdWatches = await Watch.bulkCreate<IWatch>(watchesToCreate);

      const result = {
        created: createdWatches.length,
        errors: errors.length,
        errorDetails: errors
      };

      successResponse(res, result, `Bulk import completed. Created ${createdWatches.length} watches.`);
    } catch (error) {
      logger.error('Error bulk importing watches:', error);
      errorResponse(res, 500, 'Failed to import watches');
    }
  }

  // Export watches to CSV
  static async exportWatches(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        errorResponse(res, 401, 'Unauthorized');
        return;
      }

      const { is_active } = req.query;
      const options: any = { page: 1, limit: 10000 }; // Large limit for export

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
      errorResponse(res, 500, 'Failed to export watches');
    }
  }

  // Get watch health status
  static async getWatchHealth(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { watchId } = req.params;

      if (!userId) {
        errorResponse(res, 401, 'Unauthorized');
        return;
      }

      if (!watchId || !validateUUID(watchId)) {
        errorResponse(res, 400, 'Invalid watch ID format');
        return;
      }

      const watch = await Watch.findById<IWatch>(watchId);
      if (!watch) {
        errorResponse(res, 404, 'Watch not found');
        return;
      }

      // Ensure user owns this watch
      if (watch.user_id !== userId) {
        errorResponse(res, 403, 'Access denied');
        return;
      }

      const health = await WatchMonitoringService.checkWatchHealth(watchId);
      if (!health) {
        errorResponse(res, 500, 'Failed to check watch health');
        return;
      }

      successResponse(res, health, 'Watch health status retrieved successfully');
    } catch (error) {
      logger.error('Error getting watch health:', error);
      errorResponse(res, 500, 'Failed to retrieve watch health status');
    }
  }

  // Get health status for all user watches
  static async getUserWatchesHealth(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        errorResponse(res, 401, 'Unauthorized');
        return;
      }

      const healthStatuses = await WatchMonitoringService.checkUserWatchesHealth(userId);
      successResponse(res, healthStatuses, 'User watches health status retrieved successfully');
    } catch (error) {
      logger.error('Error getting user watches health:', error);
      errorResponse(res, 500, 'Failed to retrieve user watches health status');
    }
  }

  // Get watch performance metrics
  static async getWatchPerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        errorResponse(res, 401, 'Unauthorized');
        return;
      }

      const metrics = await WatchMonitoringService.getWatchPerformanceMetrics(userId);
      successResponse(res, metrics, 'Watch performance metrics retrieved successfully');
    } catch (error) {
      logger.error('Error getting watch performance metrics:', error);
      errorResponse(res, 500, 'Failed to retrieve watch performance metrics');
    }
  }

  // Get system watch health (admin only)
  static async getSystemWatchHealth(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Add admin authentication check
      const systemHealth = await WatchMonitoringService.getSystemWatchHealth();
      successResponse(res, systemHealth, 'System watch health retrieved successfully');
    } catch (error) {
      logger.error('Error getting system watch health:', error);
      errorResponse(res, 500, 'Failed to retrieve system watch health');
    }
  }

  // Cleanup watches (admin only)
  static async cleanupWatches(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Add admin authentication check
      const cleanupResults = await WatchMonitoringService.cleanupWatches();
      successResponse(res, cleanupResults, 'Watch cleanup completed successfully');
    } catch (error) {
      logger.error('Error cleaning up watches:', error);
      errorResponse(res, 500, 'Failed to cleanup watches');
    }
  }
}