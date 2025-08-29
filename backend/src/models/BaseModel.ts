import { Knex } from 'knex';
import { db, handleDatabaseError } from '../config/database';
import { logger } from '../utils/logger';
import { IValidationError, IPaginatedResult } from '../types/database';
import { safeCount } from '../utils/database';
import { DEFAULT_VALUES } from '../constants';

export abstract class BaseModel<T = any> {
  protected static tableName: string;
  protected static db: Knex = db;

  // Abstract methods that must be implemented by subclasses
  abstract validate(data: Partial<T>): IValidationError[];
  abstract sanitize(data: Partial<T>): Partial<T>;

  // Get table name for the model
  static getTableName(): string {
    if (!this.tableName) {
      throw new Error(`Table name not defined for ${this.name}`);
    }
    return this.tableName;
  }

  // Get Knex instance
  static getKnex(): Knex {
    return this.db;
  }

  // Create a new record
  static async create<T>(data: Partial<T>): Promise<T> {
    try {
      const [record] = await this.db(this.getTableName())
        .insert(data)
        .returning('*');
      
      logger.debug(`Created ${this.name} record:`, { id: record.id });
      return record;
    } catch (error) {
      logger.error(`Error creating ${this.name}:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Find record by ID
  static async findById<T>(id: string): Promise<T | null> {
    try {
      const record = await this.db(this.getTableName())
        .where({ id })
        .first();
      
      return record || null;
    } catch (error) {
      logger.error(`Error finding ${this.name} by ID:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Find records by criteria with mandatory pagination
  static async findBy<T>(
    criteria: Partial<T>,
    options: {
      page?: number;
      limit?: number;
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<IPaginatedResult<T>> {
    try {
      const {
        page = DEFAULT_VALUES.DEFAULT_PAGE,
        limit = DEFAULT_VALUES.DEFAULT_LIMIT,
        orderBy = 'created_at',
        orderDirection = 'desc'
      } = options;

      // Enforce maximum limit to prevent performance issues
      const safeLimit = Math.min(limit, DEFAULT_VALUES.MAX_QUERY_LIMIT || 100);
      const offset = (page - 1) * safeLimit;

      // Get total count
      const countResult = await this.db(this.getTableName())
        .where(criteria)
        .count('* as count');
      const total = safeCount(countResult);

      // Get paginated data
      const data = await this.db(this.getTableName())
        .where(criteria)
        .orderBy(orderBy, orderDirection)
        .offset(offset)
        .limit(safeLimit);

      logger.debug(`Found ${data.length} ${this.name} records (page ${page}, limit ${safeLimit})`);
      
      return {
        data,
        total,
        page,
        limit: safeLimit
      };
    } catch (error) {
      logger.error(`Error finding ${this.name} records:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Legacy method for backward compatibility - DEPRECATED
  // Use findBy() with pagination options instead
  static async findByLegacy<T>(criteria: Partial<T>): Promise<T[]> {
    logger.warn(`DEPRECATED: Using findByLegacy for ${this.name}. Use findBy() with pagination instead.`);
    const result = await this.findBy<T>(criteria, { limit: DEFAULT_VALUES.MAX_QUERY_LIMIT || 100 });
    return result.data;
  }

  // Safe unpaginated query with explicit limit enforcement
  // Only use when you truly need all records and have verified the dataset size
  static async findByUnpaginated<T>(
    criteria: Partial<T>,
    options: {
      maxRecords: number;
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
      reason?: string; // Required for audit logging
    }
  ): Promise<T[]> {
    try {
      const {
        maxRecords,
        orderBy = 'created_at',
        orderDirection = 'desc',
        reason = 'Unpaginated query'
      } = options;

      // Enforce absolute maximum to prevent memory issues
      const absoluteMax = DEFAULT_VALUES.MAX_QUERY_LIMIT * 10; // 1000 records max
      if (maxRecords > absoluteMax) {
        throw new Error(`Requested ${maxRecords} records exceeds absolute maximum of ${absoluteMax}. Use pagination instead.`);
      }

      // Log the unpaginated query for monitoring
      logger.warn(`Unpaginated query for ${this.name}:`, {
        criteria,
        maxRecords,
        reason,
        stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
      });

      // First check the count to warn about large datasets
      const countResult = await this.db(this.getTableName())
        .where(criteria)
        .count('* as count');
      const total = safeCount(countResult);

      if (total > maxRecords) {
        logger.error(`Unpaginated query would return ${total} records but limit is ${maxRecords}. Consider pagination.`);
        throw new Error(`Query would return ${total} records, exceeding limit of ${maxRecords}. Use pagination for large datasets.`);
      }

      const records = await this.db(this.getTableName())
        .where(criteria)
        .orderBy(orderBy, orderDirection)
        .limit(maxRecords);

      logger.debug(`Unpaginated query returned ${records.length} ${this.name} records`);
      return records;
    } catch (error) {
      logger.error(`Error in unpaginated ${this.name} query:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Find single record by criteria
  static async findOneBy<T>(criteria: Partial<T>): Promise<T | null> {
    try {
      const record = await this.db(this.getTableName())
        .where(criteria)
        .first();
      
      return record || null;
    } catch (error) {
      logger.error(`Error finding ${this.name} record:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Update record by ID
  static async updateById<T>(id: string, data: Partial<T>): Promise<T | null> {
    try {
      const [record] = await this.db(this.getTableName())
        .where({ id })
        .update({
          ...data,
          updated_at: new Date()
        })
        .returning('*');
      
      if (record) {
        logger.debug(`Updated ${this.name} record:`, { id });
      }
      
      return record || null;
    } catch (error) {
      logger.error(`Error updating ${this.name}:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Update records by criteria
  static async updateBy<T>(criteria: Partial<T>, data: Partial<T>): Promise<number> {
    try {
      const count = await this.db(this.getTableName())
        .where(criteria)
        .update({
          ...data,
          updated_at: new Date()
        });
      
      logger.debug(`Updated ${count} ${this.name} records`);
      return count;
    } catch (error) {
      logger.error(`Error updating ${this.name} records:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Delete record by ID
  static async deleteById(id: string): Promise<boolean> {
    try {
      const count = await this.db(this.getTableName())
        .where({ id })
        .del();
      
      if (count > 0) {
        logger.debug(`Deleted ${this.name} record:`, { id });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error deleting ${this.name}:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Delete records by criteria
  static async deleteBy<T>(criteria: Partial<T>): Promise<number> {
    try {
      const count = await this.db(this.getTableName())
        .where(criteria)
        .del();
      
      logger.debug(`Deleted ${count} ${this.name} records`);
      return count;
    } catch (error) {
      logger.error(`Error deleting ${this.name} records:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Get all records with optional pagination
  static async findAll<T>(options: {
    page?: number;
    limit?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  } = {}): Promise<IPaginatedResult<T>> {
    try {
      const {
        page = DEFAULT_VALUES.DEFAULT_PAGE,
        limit = DEFAULT_VALUES.DEFAULT_LIMIT,
        orderBy = 'created_at',
        orderDirection = 'desc'
      } = options;

      const query = this.db(this.getTableName());
      return await this.getPaginatedResults<T>(query, page, limit, orderBy, orderDirection);
    } catch (error) {
      logger.error(`Error finding all ${this.name} records:`, error);
      throw handleDatabaseError(error);
    }
  }



  // Count records by criteria
  static async count<T>(criteria: Partial<T> = {}): Promise<number> {
    try {
      const countResult = await this.db(this.getTableName())
        .where(criteria)
        .count('* as count');
      
      return safeCount(countResult);
    } catch (error) {
      logger.error(`Error counting ${this.name} records:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Check if record exists
  static async exists<T>(criteria: Partial<T>): Promise<boolean> {
    try {
      const countResult = await this.db(this.getTableName())
        .where(criteria)
        .count('* as count');
      
      return safeCount(countResult) > 0;
    } catch (error) {
      logger.error(`Error checking ${this.name} existence:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Bulk insert records
  static async bulkCreate<T>(records: Partial<T>[]): Promise<T[]> {
    try {
      const insertedRecords = await this.db(this.getTableName())
        .insert(records)
        .returning('*');
      
      logger.debug(`Bulk created ${insertedRecords.length} ${this.name} records`);
      return insertedRecords;
    } catch (error) {
      logger.error(`Error bulk creating ${this.name} records:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Execute raw query with pagination awareness
  static async raw<T = any>(query: string, bindings: any[] = []): Promise<T> {
    try {
      // Log warning for raw queries that might return large datasets
      const queryLower = query.toLowerCase();
      const hasLimit = queryLower.includes('limit');
      const hasSelect = queryLower.includes('select');
      
      if (hasSelect && !hasLimit) {
        logger.warn(`Raw query without LIMIT detected in ${this.name}:`, {
          query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
          suggestion: 'Consider adding LIMIT clause to prevent large result sets'
        });
      }

      const result = await this.db.raw(query, bindings);
      return result.rows || result;
    } catch (error) {
      logger.error(`Error executing raw query for ${this.name}:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Safe method to get a small sample of records for testing/debugging
  static async sample<T>(
    criteria: Partial<T> = {},
    sampleSize: number = 10
  ): Promise<T[]> {
    try {
      if (sampleSize > 100) {
        throw new Error('Sample size cannot exceed 100 records');
      }

      const records = await this.db(this.getTableName())
        .where(criteria)
        .orderByRaw('RANDOM()') // PostgreSQL random sampling
        .limit(sampleSize);

      logger.debug(`Retrieved ${records.length} sample ${this.name} records`);
      return records;
    } catch (error) {
      logger.error(`Error sampling ${this.name} records:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Helper method for paginated queries - reduces duplication across models
  protected static async getPaginatedResults<T>(
    query: Knex.QueryBuilder,
    page: number = DEFAULT_VALUES.DEFAULT_PAGE,
    limit: number = DEFAULT_VALUES.DEFAULT_LIMIT,
    orderBy: string = 'created_at',
    orderDirection: 'asc' | 'desc' = 'desc'
  ): Promise<IPaginatedResult<T>> {
    try {
      const offset = (page - 1) * limit;

      // Get total count using cloned query
      const countResult = await query.clone().count('* as count');
      const total = safeCount(countResult);

      // Get paginated data with ordering
      const data = await query
        .orderBy(orderBy, orderDirection)
        .offset(offset)
        .limit(limit);

      return {
        data,
        total,
        page,
        limit
      };
    } catch (error) {
      logger.error(`Error in paginated query for ${this.name}:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Begin transaction
  static async transaction<T>(
    callback: (trx: Knex.Transaction) => Promise<T>
  ): Promise<T> {
    const trx = await this.db.transaction();
    
    try {
      const result = await callback(trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      logger.error(`Transaction failed for ${this.name}:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Validation helper methods
  protected static validateRequired(value: any, fieldName: string): IValidationError | null {
    if (value === undefined || value === null || value === '') {
      return {
        field: fieldName,
        message: `${fieldName} is required`,
        value
      };
    }
    return null;
  }

  protected static validateEmail(email: string): IValidationError | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        field: 'email',
        message: 'Invalid email format',
        value: email
      };
    }
    return null;
  }

  protected static validateLength(
    value: string,
    fieldName: string,
    min?: number,
    max?: number
  ): IValidationError | null {
    if (min && value.length < min) {
      return {
        field: fieldName,
        message: `${fieldName} must be at least ${min} characters`,
        value
      };
    }
    if (max && value.length > max) {
      return {
        field: fieldName,
        message: `${fieldName} must be no more than ${max} characters`,
        value
      };
    }
    return null;
  }

  protected static validateNumeric(
    value: any,
    fieldName: string,
    min?: number,
    max?: number
  ): IValidationError | null {
    const numValue = Number(value);
    if (isNaN(numValue)) {
      return {
        field: fieldName,
        message: `${fieldName} must be a number`,
        value
      };
    }
    if (min !== undefined && numValue < min) {
      return {
        field: fieldName,
        message: `${fieldName} must be at least ${min}`,
        value
      };
    }
    if (max !== undefined && numValue > max) {
      return {
        field: fieldName,
        message: `${fieldName} must be no more than ${max}`,
        value
      };
    }
    return null;
  }

  protected static validateEnum(
    value: any,
    fieldName: string,
    allowedValues: any[]
  ): IValidationError | null {
    if (!allowedValues.includes(value)) {
      return {
        field: fieldName,
        message: `${fieldName} must be one of: ${allowedValues.join(', ')}`,
        value
      };
    }
    return null;
  }

}