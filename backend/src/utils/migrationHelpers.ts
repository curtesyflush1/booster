import { Knex } from 'knex';

/**
 * Migration helper utilities for better error handling and validation
 */
export class MigrationHelpers {
  /**
   * Safely add column with validation
   */
  static async addColumnSafely(
    knex: Knex,
    tableName: string,
    columnName: string,
    columnBuilder: (table: Knex.CreateTableBuilder) => void
  ): Promise<void> {
    const hasColumn = await knex.schema.hasColumn(tableName, columnName);
    if (!hasColumn) {
      await knex.schema.alterTable(tableName, (table) => {
        columnBuilder(table);
      });
    }
  }

  /**
   * Safely drop column with validation
   */
  static async dropColumnSafely(
    knex: Knex,
    tableName: string,
    columnName: string
  ): Promise<void> {
    const hasColumn = await knex.schema.hasColumn(tableName, columnName);
    if (hasColumn) {
      await knex.schema.alterTable(tableName, (table) => {
        table.dropColumn(columnName);
      });
    }
  }

  /**
   * Safely add index with validation
   */
  static async addIndexSafely(
    knex: Knex,
    tableName: string,
    columns: string | string[],
    indexName?: string
  ): Promise<void> {
    const indexExists = await this.indexExists(knex, tableName, indexName || this.generateIndexName(tableName, columns));
    if (!indexExists) {
      await knex.schema.alterTable(tableName, (table) => {
        if (indexName) {
          table.index(columns, indexName);
        } else {
          table.index(columns);
        }
      });
    }
  }

  /**
   * Safely drop index with validation
   */
  static async dropIndexSafely(
    knex: Knex,
    tableName: string,
    indexName: string
  ): Promise<void> {
    const indexExists = await this.indexExists(knex, tableName, indexName);
    if (indexExists) {
      await knex.schema.alterTable(tableName, (table) => {
        table.dropIndex([], indexName);
      });
    }
  }

  /**
   * Check if index exists
   */
  private static async indexExists(
    knex: Knex,
    tableName: string,
    indexName: string
  ): Promise<boolean> {
    try {
      const result = await knex.raw(`
        SELECT 1 FROM pg_indexes 
        WHERE tablename = ? AND indexname = ?
      `, [tableName, indexName]);
      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate standard index name
   */
  private static generateIndexName(tableName: string, columns: string | string[]): string {
    const columnStr = Array.isArray(columns) ? columns.join('_') : columns;
    return `${tableName}_${columnStr}_index`;
  }

  /**
   * Validate foreign key constraint
   */
  static async validateForeignKey(
    knex: Knex,
    tableName: string,
    columnName: string,
    referencedTable: string,
    referencedColumn: string = 'id'
  ): Promise<void> {
    const invalidRows = await knex(tableName)
      .leftJoin(referencedTable, `${tableName}.${columnName}`, `${referencedTable}.${referencedColumn}`)
      .whereNotNull(`${tableName}.${columnName}`)
      .whereNull(`${referencedTable}.${referencedColumn}`)
      .count('* as count')
      .first();

    if (invalidRows && parseInt(invalidRows.count as string) > 0) {
      throw new Error(
        `Foreign key validation failed: ${invalidRows.count} rows in ${tableName}.${columnName} ` +
        `reference non-existent records in ${referencedTable}.${referencedColumn}`
      );
    }
  }

  /**
   * Backup table before major changes
   */
  static async backupTable(knex: Knex, tableName: string): Promise<string> {
    const backupTableName = `${tableName}_backup_${Date.now()}`;
    await knex.raw(`CREATE TABLE ${backupTableName} AS SELECT * FROM ${tableName}`);
    return backupTableName;
  }

  /**
   * Restore table from backup
   */
  static async restoreFromBackup(
    knex: Knex,
    originalTableName: string,
    backupTableName: string
  ): Promise<void> {
    await knex.raw(`DROP TABLE IF EXISTS ${originalTableName}`);
    await knex.raw(`ALTER TABLE ${backupTableName} RENAME TO ${originalTableName}`);
  }

  /**
   * Validate data integrity after migration
   */
  static async validateDataIntegrity(
    knex: Knex,
    validations: Array<{
      name: string;
      query: string;
      expectedCount?: number;
      maxCount?: number;
      minCount?: number;
    }>
  ): Promise<void> {
    for (const validation of validations) {
      const result = await knex.raw(validation.query);
      const count = parseInt(result.rows[0]?.count || '0');

      if (validation.expectedCount !== undefined && count !== validation.expectedCount) {
        throw new Error(`Data integrity check '${validation.name}' failed: expected ${validation.expectedCount}, got ${count}`);
      }

      if (validation.maxCount !== undefined && count > validation.maxCount) {
        throw new Error(`Data integrity check '${validation.name}' failed: count ${count} exceeds maximum ${validation.maxCount}`);
      }

      if (validation.minCount !== undefined && count < validation.minCount) {
        throw new Error(`Data integrity check '${validation.name}' failed: count ${count} below minimum ${validation.minCount}`);
      }
    }
  }
}