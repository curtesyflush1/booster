import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import { Readable } from 'stream';
import { logger } from '../utils/logger';
import { Watch } from '../models/Watch';
import { Product } from '../models/Product';
import { User } from '../models/User';

interface CSVWatchRecord {
  productName: string;
  productSku?: string;
  productUpc?: string;
  retailers: string; // Comma-separated list
  maxPrice?: number;
  isActive: boolean;
  notes?: string;
}

interface CSVImportResult {
  success: boolean;
  totalRows: number;
  successfulImports: number;
  failedImports: number;
  errors: Array<{
    row: number;
    error: string;
    data: any;
  }>;
  importedWatches: string[]; // Watch IDs
}

interface CSVExportOptions {
  includeInactive?: boolean;
  retailers?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export class CSVService {
  /**
   * Import watches from CSV data
   */
  async importWatches(csvData: string, userId: string): Promise<CSVImportResult> {
    const result: CSVImportResult = {
      success: false,
      totalRows: 0,
      successfulImports: 0,
      failedImports: 0,
      errors: [],
      importedWatches: []
    };

    try {
      const records: CSVWatchRecord[] = [];
      
      // Parse CSV data
      await new Promise<void>((resolve, reject) => {
        const stream = Readable.from(csvData);
        
        stream
          .pipe(csv({
            mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s+/g, '_')
          }))
          .on('data', (data) => {
            records.push(this.normalizeCSVRecord(data));
          })
          .on('end', () => {
            resolve();
          })
          .on('error', (error) => {
            reject(error);
          });
      });

      result.totalRows = records.length;

      // Validate user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Process each record
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        
        try {
          await this.processCSVRecord(record, userId, i + 1);
          result.successfulImports++;
        } catch (error) {
          result.failedImports++;
          result.errors.push({
            row: i + 1,
            error: error instanceof Error ? error.message : 'Unknown error',
            data: record
          });
          
          logger.warn(`Failed to import CSV row ${i + 1}:`, error);
        }
      }

      result.success = result.successfulImports > 0;
      
      logger.info(`CSV import completed for user ${userId}: ${result.successfulImports}/${result.totalRows} successful`);
      
      return result;
    } catch (error) {
      logger.error('CSV import failed:', error);
      throw new Error(`CSV import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export watches to CSV format
   */
  async exportWatches(userId: string, options: CSVExportOptions = {}): Promise<string> {
    try {
      // Validate user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Build query filters
      const filters: any = { user_id: userId };
      
      if (!options.includeInactive) {
        filters.is_active = true;
      }

      if (options.dateRange) {
        filters.created_at = {
          $gte: options.dateRange.start,
          $lte: options.dateRange.end
        };
      }

      // Get watches with product information
      const watches = await Watch.findWithFilters(filters);
      
      // Filter by retailers if specified
      let filteredWatches = watches;
      if (options.retailers && options.retailers.length > 0) {
        filteredWatches = watches.filter(watch => 
          watch.retailers.some(retailer => 
            options.retailers!.includes(retailer.toLowerCase())
          )
        );
      }

      // Convert to CSV format
      const csvRecords = await Promise.all(
        filteredWatches.map(async (watch) => {
          const product = await Product.findById(watch.product_id);
          
          return {
            productName: product?.name || 'Unknown Product',
            productSku: product?.sku || '',
            productUpc: product?.upc || '',
            retailers: watch.retailers.join(', '),
            maxPrice: watch.max_price || '',
            isActive: watch.is_active,
            notes: watch.notes || '',
            createdAt: watch.created_at?.toISOString().split('T')[0] || '',
            lastTriggered: watch.last_triggered?.toISOString().split('T')[0] || ''
          };
        })
      );

      // Generate CSV string
      const csvString = await this.generateCSVString(csvRecords);
      
      logger.info(`Exported ${csvRecords.length} watches to CSV for user ${userId}`);
      
      return csvString;
    } catch (error) {
      logger.error('CSV export failed:', error);
      throw new Error(`CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get CSV template for watch imports
   */
  getImportTemplate(): string {
    const templateData = [
      {
        productName: 'Pokémon TCG: Scarlet & Violet Booster Pack',
        productSku: 'POK-SV-BP-001',
        productUpc: '820650123456',
        retailers: 'best buy, walmart, target',
        maxPrice: 4.99,
        isActive: true,
        notes: 'High priority item for collection'
      },
      {
        productName: 'Pokémon TCG: Paradox Rift Elite Trainer Box',
        productSku: 'POK-PR-ETB-001',
        productUpc: '820650789012',
        retailers: 'costco, sams club',
        maxPrice: 49.99,
        isActive: true,
        notes: 'Watch for bulk pricing'
      }
    ];

    return this.generateCSVStringSync(templateData);
  }

  /**
   * Validate CSV format and structure
   */
  async validateCSVFormat(csvData: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    previewData: any[];
  }> {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
      previewData: [] as any[]
    };

    try {
      const records: any[] = [];
      
      await new Promise<void>((resolve, reject) => {
        const stream = Readable.from(csvData);
        
        stream
          .pipe(csv({
            mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s+/g, '_')
          }))
          .on('data', (data) => {
            records.push(data);
          })
          .on('end', () => {
            resolve();
          })
          .on('error', (error) => {
            reject(error);
          });
      });

      // Check if CSV has data
      if (records.length === 0) {
        result.errors.push('CSV file is empty or contains no valid data');
        result.isValid = false;
        return result;
      }

      // Check required columns
      const requiredColumns = ['product_name'];
      const firstRecord = records[0];
      const availableColumns = Object.keys(firstRecord);

      for (const column of requiredColumns) {
        if (!availableColumns.includes(column)) {
          result.errors.push(`Required column '${column}' is missing`);
          result.isValid = false;
        }
      }

      // Validate each record
      for (let i = 0; i < Math.min(records.length, 10); i++) { // Preview first 10 records
        const record = records[i];
        const rowNumber = i + 1;

        // Validate product name
        if (!record.product_name || record.product_name.trim() === '') {
          result.errors.push(`Row ${rowNumber}: Product name is required`);
          result.isValid = false;
        }

        // Validate retailers format
        if (record.retailers && typeof record.retailers !== 'string') {
          result.warnings.push(`Row ${rowNumber}: Retailers should be a comma-separated string`);
        }

        // Validate max price
        if (record.max_price && isNaN(parseFloat(record.max_price))) {
          result.warnings.push(`Row ${rowNumber}: Max price should be a valid number`);
        }

        // Validate is_active
        if (record.is_active && !['true', 'false', '1', '0', 'yes', 'no'].includes(record.is_active.toString().toLowerCase())) {
          result.warnings.push(`Row ${rowNumber}: is_active should be true/false or yes/no`);
        }

        result.previewData.push(this.normalizeCSVRecord(record));
      }

      // Add general warnings
      if (records.length > 1000) {
        result.warnings.push(`Large file detected (${records.length} rows). Import may take some time.`);
      }

      return result;
    } catch (error) {
      result.errors.push(`CSV parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
      return result;
    }
  }

  private normalizeCSVRecord(record: any): CSVWatchRecord {
    return {
      productName: record.product_name?.trim() || '',
      productSku: record.product_sku?.trim() || undefined,
      productUpc: record.product_upc?.trim() || undefined,
      retailers: record.retailers?.trim() || 'best buy, walmart',
      maxPrice: record.max_price ? parseFloat(record.max_price) : undefined,
      isActive: this.parseBoolean(record.is_active, true),
      notes: record.notes?.trim() || undefined
    };
  }

  private parseBoolean(value: any, defaultValue: boolean = false): boolean {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }
    
    const stringValue = value.toString().toLowerCase().trim();
    return ['true', '1', 'yes', 'y', 'on'].includes(stringValue);
  }

  private async processCSVRecord(record: CSVWatchRecord, userId: string, rowNumber: number): Promise<void> {
    // Validate required fields
    if (!record.productName) {
      throw new Error(`Row ${rowNumber}: Product name is required`);
    }

    // Find or create product
    let product = await Product.findByName(record.productName);
    
    if (!product) {
      // Try to find by SKU or UPC if provided
      if (record.productSku) {
        product = await Product.findBySku(record.productSku);
      }
      
      if (!product && record.productUpc) {
        product = await Product.findByUpc(record.productUpc);
      }
      
      if (!product) {
        throw new Error(`Row ${rowNumber}: Product '${record.productName}' not found in catalog`);
      }
    }

    // Parse retailers
    const retailers = record.retailers
      .split(',')
      .map(r => r.trim().toLowerCase())
      .filter(r => r.length > 0);

    if (retailers.length === 0) {
      throw new Error(`Row ${rowNumber}: At least one retailer must be specified`);
    }

    // Check if watch already exists
    const existingWatch = await Watch.findByUserAndProduct(userId, product.id);
    
    if (existingWatch) {
      // Update existing watch
      await Watch.update(existingWatch.id, {
        retailers,
        max_price: record.maxPrice,
        is_active: record.isActive,
        notes: record.notes,
        updated_at: new Date()
      });
    } else {
      // Create new watch
      await Watch.create({
        user_id: userId,
        product_id: product.id,
        retailers,
        max_price: record.maxPrice,
        is_active: record.isActive,
        notes: record.notes
      });
    }
  }

  private async generateCSVString(data: any[]): Promise<string> {
    return new Promise((resolve, reject) => {
      if (data.length === 0) {
        resolve('');
        return;
      }

      const headers = Object.keys(data[0]).map(key => ({
        id: key,
        title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      }));

      let csvContent = '';
      
      // Add headers
      csvContent += headers.map(h => h.title).join(',') + '\n';
      
      // Add data rows
      for (const row of data) {
        const values = headers.map(header => {
          const value = row[header.id];
          if (value === null || value === undefined) {
            return '';
          }
          // Escape commas and quotes
          const stringValue = value.toString();
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        });
        csvContent += values.join(',') + '\n';
      }

      resolve(csvContent);
    });
  }

  private generateCSVStringSync(data: any[]): string {
    if (data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]).map(key => 
      key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    );

    let csvContent = headers.join(',') + '\n';
    
    for (const row of data) {
      const values = Object.values(row).map(value => {
        if (value === null || value === undefined) {
          return '';
        }
        const stringValue = value.toString();
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvContent += values.join(',') + '\n';
    }

    return csvContent;
  }
}

export const csvService = new CSVService();