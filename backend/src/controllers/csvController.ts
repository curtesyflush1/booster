import { Request, Response } from 'express';
import multer from 'multer';
import { csvService } from '../services/csvService';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation';
import { body, query } from 'express-validator';
import { FILE_LIMITS } from '../constants';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_LIMITS.CSV_MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

export class CSVController {
  // Validation middleware
  static validateExportOptions = [
    query('includeInactive').optional().isBoolean().withMessage('includeInactive must be a boolean'),
    query('retailers').optional().isString().withMessage('retailers must be a comma-separated string'),
    query('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO date'),
    validateRequest
  ];

  /**
   * Import watches from CSV file
   */
  static async importWatches(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'CSV file is required' });
        return;
      }

      const csvData = req.file.buffer.toString('utf-8');
      
      // Validate CSV format first
      const validation = await csvService.validateCSVFormat(csvData);
      if (!validation.isValid) {
        res.status(400).json({
          error: 'Invalid CSV format',
          details: validation.errors,
          warnings: validation.warnings
        });
        return;
      }

      // Perform import
      const result = await csvService.importWatches(csvData, userId);

      logger.info(`User ${userId} imported watches from CSV: ${result.successfulImports}/${result.totalRows} successful`);

      res.json({
        success: result.success,
        message: `Import completed: ${result.successfulImports}/${result.totalRows} watches imported successfully`,
        data: {
          totalRows: result.totalRows,
          successfulImports: result.successfulImports,
          failedImports: result.failedImports,
          errors: result.errors,
          importedWatches: result.importedWatches
        }
      });
    } catch (error) {
      logger.error('CSV import failed:', error);
      res.status(500).json({
        error: 'Failed to import CSV',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Export watches to CSV
   */
  static async exportWatches(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Parse export options
      const options: any = {};
      
      if (req.query.includeInactive === 'true') {
        options.includeInactive = true;
      }

      if (req.query.retailers) {
        options.retailers = (req.query.retailers as string)
          .split(',')
          .map(r => r.trim().toLowerCase())
          .filter(r => r.length > 0);
      }

      if (req.query.startDate && req.query.endDate) {
        options.dateRange = {
          start: new Date(req.query.startDate as string),
          end: new Date(req.query.endDate as string)
        };
      }

      const csvData = await csvService.exportWatches(userId, options);

      logger.info(`User ${userId} exported watches to CSV`);

      // Set response headers for file download
      const filename = `boosterbeacon-watches-${new Date().toISOString().split('T')[0]}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      
      res.send(csvData);
    } catch (error) {
      logger.error('CSV export failed:', error);
      res.status(500).json({
        error: 'Failed to export CSV',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get CSV import template
   */
  static async getImportTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const template = csvService.getImportTemplate();

      const filename = 'boosterbeacon-watch-import-template.csv';
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      
      res.send(template);
    } catch (error) {
      logger.error('Failed to generate CSV template:', error);
      res.status(500).json({ error: 'Failed to generate CSV template' });
    }
  }

  /**
   * Validate CSV format without importing
   */
  static async validateCSV(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'CSV file is required' });
        return;
      }

      const csvData = req.file.buffer.toString('utf-8');
      const validation = await csvService.validateCSVFormat(csvData);

      res.json({
        success: true,
        data: {
          isValid: validation.isValid,
          errors: validation.errors,
          warnings: validation.warnings,
          previewData: validation.previewData,
          totalRows: validation.previewData.length
        }
      });
    } catch (error) {
      logger.error('CSV validation failed:', error);
      res.status(500).json({
        error: 'Failed to validate CSV',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get CSV import/export statistics
   */
  static async getCSVStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // In a real implementation, these stats would be stored in the database
      // For now, we'll return mock statistics
      const stats = {
        totalImports: 0,
        totalExports: 0,
        lastImport: null,
        lastExport: null,
        totalWatchesImported: 0,
        totalWatchesExported: 0,
        averageImportSize: 0,
        importSuccessRate: 100
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get CSV stats:', error);
      res.status(500).json({ error: 'Failed to retrieve CSV statistics' });
    }
  }

  /**
   * Get supported CSV formats and documentation
   */
  static async getCSVDocumentation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const documentation = {
        supportedFormats: {
          encoding: 'UTF-8',
          delimiter: 'comma (,)',
          quoteChar: 'double quote (")',
          escapeChar: 'double quote ("")',
          maxFileSize: '5MB',
          maxRows: FILE_LIMITS.CSV_MAX_ROWS
        },
        requiredColumns: [
          {
            name: 'product_name',
            description: 'Name of the Pokémon TCG product',
            required: true,
            example: 'Pokémon TCG: Scarlet & Violet Booster Pack'
          }
        ],
        optionalColumns: [
          {
            name: 'product_sku',
            description: 'Product SKU code',
            required: false,
            example: 'POK-SV-BP-001'
          },
          {
            name: 'product_upc',
            description: 'Product UPC barcode',
            required: false,
            example: '820650123456'
          },
          {
            name: 'retailers',
            description: 'Comma-separated list of retailers to monitor',
            required: false,
            example: 'best buy, walmart, target',
            default: 'best buy, walmart'
          },
          {
            name: 'max_price',
            description: 'Maximum price to alert for',
            required: false,
            example: '4.99'
          },
          {
            name: 'is_active',
            description: 'Whether the watch is active',
            required: false,
            example: 'true, false, yes, no, 1, 0',
            default: 'true'
          },
          {
            name: 'notes',
            description: 'Optional notes for the watch',
            required: false,
            example: 'High priority item for collection'
          }
        ],
        supportedRetailers: [
          'best buy',
          'walmart',
          'target',
          'costco',
          'sams club',
          'amazon'
        ],
        examples: [
          {
            description: 'Basic watch import',
            csv: 'product_name,retailers,max_price,is_active\n"Pokémon TCG Booster Pack",best buy,4.99,true'
          },
          {
            description: 'Complete watch import with all fields',
            csv: 'product_name,product_sku,product_upc,retailers,max_price,is_active,notes\n"Pokémon TCG Elite Trainer Box",POK-ETB-001,820650789012,"walmart, target",49.99,true,"Priority collection item"'
          }
        ]
      };

      res.json({
        success: true,
        data: documentation
      });
    } catch (error) {
      logger.error('Failed to get CSV documentation:', error);
      res.status(500).json({ error: 'Failed to retrieve CSV documentation' });
    }
  }

  // Middleware for file upload
  static uploadMiddleware = upload.single('csvFile');
}