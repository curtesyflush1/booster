import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { loggerWithContext } from '../utils/logger';

const execAsync = promisify(exec);

export interface BackupResult {
  success: boolean;
  filename?: string;
  size?: number;
  checksum?: string;
  duration: number;
  error?: string;
}

export interface BackupConfig {
  databaseUrl: string;
  backupDir: string;
  retentionDays: number;
  compressionLevel: number;
  encryptionKey?: string | undefined;
}

class BackupService {
  private config: BackupConfig;

  constructor() {
    this.config = {
      databaseUrl: process.env.DATABASE_URL || '',
      backupDir: process.env.BACKUP_DIR || './backups',
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
      compressionLevel: parseInt(process.env.BACKUP_COMPRESSION_LEVEL || '6'),
      encryptionKey: process.env.BACKUP_ENCRYPTION_KEY
    };
  }

  /**
   * Create a full database backup
   */
  async createDatabaseBackup(): Promise<BackupResult> {
    const startTime = Date.now();
    
    try {
      loggerWithContext.info('Starting database backup');

      // Ensure backup directory exists
      await this.ensureBackupDirectory();

      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `booster-beacon-db-${timestamp}.sql`;
      const filepath = path.join(this.config.backupDir, filename);

      // Create pg_dump command
      const dumpCommand = this.buildDumpCommand(filepath);
      
      loggerWithContext.debug('Executing database dump', { command: dumpCommand });

      // Execute backup
      await execAsync(dumpCommand);

      // Compress backup if requested
      let finalFilepath = filepath;
      if (this.config.compressionLevel > 0) {
        finalFilepath = await this.compressBackup(filepath);
        await fs.unlink(filepath); // Remove uncompressed file
      }

      // Encrypt backup if encryption key is provided
      if (this.config.encryptionKey) {
        finalFilepath = await this.encryptBackup(finalFilepath);
        await fs.unlink(finalFilepath.replace('.enc', '')); // Remove unencrypted file
      }

      // Get file stats and checksum
      const stats = await fs.stat(finalFilepath);
      const checksum = await this.calculateChecksum(finalFilepath);

      // Verify backup integrity
      const isValid = await this.verifyBackup(finalFilepath);
      if (!isValid) {
        throw new Error('Backup integrity verification failed');
      }

      const duration = Date.now() - startTime;
      const result: BackupResult = {
        success: true,
        filename: path.basename(finalFilepath),
        size: stats.size,
        checksum,
        duration
      };

      loggerWithContext.info('Database backup completed successfully', {
        filename: result.filename,
        size: result.size,
        duration: result.duration,
        checksum: result.checksum
      });

      // Clean up old backups
      await this.cleanupOldBackups();

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = (error as Error).message;
      
      loggerWithContext.error('Database backup failed', error as Error, {
        duration,
        config: this.config
      });

      return {
        success: false,
        duration,
        error: errorMessage
      };
    }
  }

  /**
   * Restore database from backup
   */
  async restoreFromBackup(backupFilename: string): Promise<BackupResult> {
    const startTime = Date.now();
    
    try {
      loggerWithContext.info('Starting database restore', { backupFilename });

      const backupPath = path.join(this.config.backupDir, backupFilename);
      
      // Verify backup exists
      await fs.access(backupPath);

      // Decrypt if needed
      let restoreFilepath = backupPath;
      if (backupFilename.endsWith('.enc')) {
        restoreFilepath = await this.decryptBackup(backupPath);
      }

      // Decompress if needed
      if (restoreFilepath.endsWith('.gz')) {
        restoreFilepath = await this.decompressBackup(restoreFilepath);
      }

      // Verify backup integrity before restore
      const isValid = await this.verifyBackup(restoreFilepath);
      if (!isValid) {
        throw new Error('Backup file is corrupted or invalid');
      }

      // Create restore command
      const restoreCommand = this.buildRestoreCommand(restoreFilepath);
      
      loggerWithContext.debug('Executing database restore', { command: restoreCommand });

      // Execute restore
      await execAsync(restoreCommand);

      // Clean up temporary files
      if (restoreFilepath !== backupPath) {
        await fs.unlink(restoreFilepath);
      }

      const duration = Date.now() - startTime;
      const result: BackupResult = {
        success: true,
        filename: backupFilename,
        duration
      };

      loggerWithContext.info('Database restore completed successfully', {
        filename: backupFilename,
        duration
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = (error as Error).message;
      
      loggerWithContext.error('Database restore failed', error as Error, {
        backupFilename,
        duration
      });

      return {
        success: false,
        duration,
        error: errorMessage
      };
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<Array<{
    filename: string;
    size: number;
    created: Date;
    checksum?: string;
  }>> {
    try {
      const files = await fs.readdir(this.config.backupDir);
      const backupFiles = files.filter(file => 
        file.startsWith('booster-beacon-db-') && 
        (file.endsWith('.sql') || file.endsWith('.sql.gz') || file.endsWith('.sql.gz.enc'))
      );

      const backups = await Promise.all(
        backupFiles.map(async (filename) => {
          const filepath = path.join(this.config.backupDir, filename);
          const stats = await fs.stat(filepath);
          
          return {
            filename,
            size: stats.size,
            created: stats.birthtime,
            checksum: await this.calculateChecksum(filepath)
          };
        })
      );

      return backups.sort((a, b) => b.created.getTime() - a.created.getTime());

    } catch (error) {
      loggerWithContext.error('Failed to list backups', error as Error);
      return [];
    }
  }

  /**
   * Schedule automatic backups
   */
  scheduleAutomaticBackups(): void {
    const backupInterval = process.env.BACKUP_INTERVAL_HOURS || '24';
    const intervalMs = parseInt(backupInterval) * 60 * 60 * 1000;

    loggerWithContext.info('Scheduling automatic backups', {
      intervalHours: backupInterval,
      retentionDays: this.config.retentionDays
    });

    setInterval(async () => {
      try {
        await this.createDatabaseBackup();
      } catch (error) {
        loggerWithContext.error('Scheduled backup failed', error as Error);
      }
    }, intervalMs);

    // Run initial backup after 5 minutes
    setTimeout(async () => {
      try {
        await this.createDatabaseBackup();
      } catch (error) {
        loggerWithContext.error('Initial scheduled backup failed', error as Error);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.access(this.config.backupDir);
    } catch {
      await fs.mkdir(this.config.backupDir, { recursive: true });
      loggerWithContext.info('Created backup directory', { dir: this.config.backupDir });
    }
  }

  /**
   * Build pg_dump command
   */
  private buildDumpCommand(filepath: string): string {
    const url = new URL(this.config.databaseUrl);
    
    return `PGPASSWORD="${url.password}" pg_dump ` +
           `--host="${url.hostname}" ` +
           `--port="${url.port || 5432}" ` +
           `--username="${url.username}" ` +
           `--dbname="${url.pathname.slice(1)}" ` +
           `--verbose --clean --no-owner --no-privileges ` +
           `--file="${filepath}"`;
  }

  /**
   * Build psql restore command
   */
  private buildRestoreCommand(filepath: string): string {
    const url = new URL(this.config.databaseUrl);
    
    return `PGPASSWORD="${url.password}" psql ` +
           `--host="${url.hostname}" ` +
           `--port="${url.port || 5432}" ` +
           `--username="${url.username}" ` +
           `--dbname="${url.pathname.slice(1)}" ` +
           `--file="${filepath}"`;
  }

  /**
   * Compress backup file
   */
  private async compressBackup(filepath: string): Promise<string> {
    const compressedPath = `${filepath}.gz`;
    const command = `gzip -${this.config.compressionLevel} -c "${filepath}" > "${compressedPath}"`;
    
    await execAsync(command);
    return compressedPath;
  }

  /**
   * Decompress backup file
   */
  private async decompressBackup(filepath: string): Promise<string> {
    const decompressedPath = filepath.replace('.gz', '');
    const command = `gunzip -c "${filepath}" > "${decompressedPath}"`;
    
    await execAsync(command);
    return decompressedPath;
  }

  /**
   * Encrypt backup file
   */
  private async encryptBackup(filepath: string): Promise<string> {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key not provided');
    }

    const encryptedPath = `${filepath}.enc`;
    const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher('aes-256-cbc', key);
    const input = await fs.readFile(filepath);
    
    const encrypted = Buffer.concat([
      iv,
      cipher.update(input),
      cipher.final()
    ]);
    
    await fs.writeFile(encryptedPath, encrypted);
    return encryptedPath;
  }

  /**
   * Decrypt backup file
   */
  private async decryptBackup(filepath: string): Promise<string> {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key not provided');
    }

    const decryptedPath = filepath.replace('.enc', '');
    const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
    
    const encrypted = await fs.readFile(filepath);
    const iv = encrypted.slice(0, 16);
    const data = encrypted.slice(16);
    
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final()
    ]);
    
    await fs.writeFile(decryptedPath, decrypted);
    return decryptedPath;
  }

  /**
   * Calculate file checksum
   */
  private async calculateChecksum(filepath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const data = await fs.readFile(filepath);
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * Verify backup integrity
   */
  private async verifyBackup(filepath: string): Promise<boolean> {
    try {
      // Basic verification - check if file exists and has content
      const stats = await fs.stat(filepath);
      if (stats.size === 0) {
        return false;
      }

      // For SQL files, check if they contain expected SQL commands (case-insensitive)
      if (filepath.endsWith('.sql')) {
        const content = (await fs.readFile(filepath, 'utf8')) || '';
        const upper = String(content).toUpperCase();
        return upper.includes('CREATE') || upper.includes('INSERT') || upper.includes('COPY');
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      const oldBackups = backups.filter(backup => backup.created < cutoffDate);

      for (const backup of oldBackups) {
        const filepath = path.join(this.config.backupDir, backup.filename);
        await fs.unlink(filepath);
        
        loggerWithContext.info('Deleted old backup', {
          filename: backup.filename,
          age: Math.floor((Date.now() - backup.created.getTime()) / (1000 * 60 * 60 * 24))
        });
      }

      if (oldBackups.length > 0) {
        loggerWithContext.info('Backup cleanup completed', {
          deletedCount: oldBackups.length,
          retentionDays: this.config.retentionDays
        });
      }

    } catch (error) {
      loggerWithContext.error('Backup cleanup failed', error as Error);
    }
  }
}

export const backupService = new BackupService();
