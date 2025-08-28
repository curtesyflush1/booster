import { Router } from 'express';
import { CSVController } from '../controllers/csvController';
import { authenticate } from '../middleware/auth';
import { generalRateLimit } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication to all CSV routes
router.use(authenticate);

// Apply rate limiting for CSV operations
router.use(generalRateLimit);

/**
 * @route POST /api/csv/import
 * @desc Import watches from CSV file
 * @access Private
 */
router.post('/import', CSVController.uploadMiddleware, CSVController.importWatches);

/**
 * @route GET /api/csv/export
 * @desc Export watches to CSV
 * @access Private
 */
router.get('/export', CSVController.validateExportOptions, CSVController.exportWatches);

/**
 * @route GET /api/csv/template
 * @desc Download CSV import template
 * @access Private
 */
router.get('/template', CSVController.getImportTemplate);

/**
 * @route POST /api/csv/validate
 * @desc Validate CSV format without importing
 * @access Private
 */
router.post('/validate', CSVController.uploadMiddleware, CSVController.validateCSV);

/**
 * @route GET /api/csv/stats
 * @desc Get CSV import/export statistics
 * @access Private
 */
router.get('/stats', CSVController.getCSVStats);

/**
 * @route GET /api/csv/documentation
 * @desc Get CSV format documentation
 * @access Private
 */
router.get('/documentation', CSVController.getCSVDocumentation);

export default router;