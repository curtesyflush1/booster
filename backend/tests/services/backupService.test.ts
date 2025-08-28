import { backupService } from '../../src/services/backupService';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('child_process');
jest.mock('crypto');

const mockExec = jest.mocked(exec);
const mockFs = jest.mocked(fs);

describe('BackupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
    process.env.BACKUP_DIR = './test-backups';
    process.env.BACKUP_RETENTION_DAYS = '7';
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.BACKUP_DIR;
    delete process.env.BACKUP_RETENTION_DAYS;
  });

  describe('Database Backup Creation', () => {
    it('should create a successful database backup', async () => {
      // Mock successful command execution
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, 'Backup completed', '');
        return {} as any;
      });

      // Mock file operations
      mockFs.stat.mockResolvedValue({ size: 1024 } as any);
      mockFs.access.mockResolvedValue(undefined);

      // Mock backup service methods
      const service = backupService as any;
      service.ensureBackupDirectory = jest.fn().mockResolvedValue(undefined);
      service.compressBackup = jest.fn().mockResolvedValue('./test-backups/backup.sql.gz');
      service.calculateChecksum = jest.fn().mockResolvedValue('abc123');
      service.verifyBackup = jest.fn().mockResolvedValue(true);
      service.cleanupOldBackups = jest.fn().mockResolvedValue(undefined);

      const result = await backupService.createDatabaseBackup();

      expect(result.success).toBe(true);
      expect(result.filename).toBeDefined();
      expect(result.size).toBe(1024);
      expect(result.checksum).toBe('abc123');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle backup failures gracefully', async () => {
      // Mock failed command execution
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(new Error('pg_dump failed'), '', 'Error message');
        return {} as any;
      });

      const service = backupService as any;
      service.ensureBackupDirectory = jest.fn().mockResolvedValue(undefined);

      const result = await backupService.createDatabaseBackup();

      expect(result.success).toBe(false);
      expect(result.error).toContain('pg_dump failed');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should fail if backup integrity verification fails', async () => {
      // Mock successful command execution but failed verification
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, 'Backup completed', '');
        return {} as any;
      });

      mockFs.stat.mockResolvedValue({ size: 1024 } as any);

      const service = backupService as any;
      service.ensureBackupDirectory = jest.fn().mockResolvedValue(undefined);
      service.compressBackup = jest.fn().mockResolvedValue('./test-backups/backup.sql.gz');
      service.calculateChecksum = jest.fn().mockResolvedValue('abc123');
      service.verifyBackup = jest.fn().mockResolvedValue(false); // Verification fails
      service.cleanupOldBackups = jest.fn().mockResolvedValue(undefined);

      const result = await backupService.createDatabaseBackup();

      expect(result.success).toBe(false);
      expect(result.error).toContain('integrity verification failed');
    });
  });

  describe('Database Restore', () => {
    it('should restore from backup successfully', async () => {
      const backupFilename = 'test-backup.sql';

      // Mock successful operations
      mockFs.access.mockResolvedValue(undefined);
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, 'Restore completed', '');
        return {} as any;
      });

      const service = backupService as any;
      service.verifyBackup = jest.fn().mockResolvedValue(true);

      const result = await backupService.restoreFromBackup(backupFilename);

      expect(result.success).toBe(true);
      expect(result.filename).toBe(backupFilename);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle restore failures', async () => {
      const backupFilename = 'test-backup.sql';

      // Mock file access failure
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const result = await backupService.restoreFromBackup(backupFilename);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should fail if backup verification fails before restore', async () => {
      const backupFilename = 'test-backup.sql';

      mockFs.access.mockResolvedValue(undefined);

      const service = backupService as any;
      service.verifyBackup = jest.fn().mockResolvedValue(false);

      const result = await backupService.restoreFromBackup(backupFilename);

      expect(result.success).toBe(false);
      expect(result.error).toContain('corrupted or invalid');
    });
  });

  describe('Backup Listing', () => {
    it('should list available backups', async () => {
      const mockFiles = [
        'booster-beacon-db-20231201-120000.sql',
        'booster-beacon-db-20231202-120000.sql.gz',
        'other-file.txt'
      ];

      mockFs.readdir.mockResolvedValue(mockFiles as any);
      mockFs.stat.mockResolvedValue({
        size: 1024,
        birthtime: new Date('2023-12-01T12:00:00Z')
      } as any);

      const service = backupService as any;
      service.calculateChecksum = jest.fn().mockResolvedValue('abc123');

      const backups = await backupService.listBackups();

      expect(backups).toHaveLength(2); // Only backup files, not other-file.txt
      expect(backups[0]?.filename).toContain('booster-beacon-db-');
      expect(backups[0]?.size).toBe(1024);
      expect(backups[0]?.checksum).toBe('abc123');
    });

    it('should handle errors when listing backups', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Directory not found'));

      const backups = await backupService.listBackups();

      expect(backups).toEqual([]);
    });
  });

  describe('Backup Verification', () => {
    it('should verify SQL backup files', async () => {
      const filepath = './test-backup.sql';
      
      mockFs.stat.mockResolvedValue({ size: 1024 } as any);
      mockFs.readFile.mockResolvedValue('CREATE TABLE test; INSERT INTO test VALUES (1);' as any);

      const service = backupService as any;
      const isValid = await service.verifyBackup(filepath);

      expect(isValid).toBe(true);
    });

    it('should reject empty backup files', async () => {
      const filepath = './test-backup.sql';
      
      mockFs.stat.mockResolvedValue({ size: 0 } as any);

      const service = backupService as any;
      const isValid = await service.verifyBackup(filepath);

      expect(isValid).toBe(false);
    });

    it('should reject SQL files without expected content', async () => {
      const filepath = './test-backup.sql';
      
      mockFs.stat.mockResolvedValue({ size: 1024 } as any);
      mockFs.readFile.mockResolvedValue('This is not a SQL backup file' as any);

      const service = backupService as any;
      const isValid = await service.verifyBackup(filepath);

      expect(isValid).toBe(false);
    });
  });

  describe('Backup Cleanup', () => {
    it('should clean up old backups based on retention policy', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

      const service = backupService as any;
      service.listBackups = jest.fn().mockResolvedValue([
        {
          filename: 'old-backup.sql.gz',
          size: 1024,
          created: oldDate,
          checksum: 'abc123'
        },
        {
          filename: 'recent-backup.sql.gz',
          size: 1024,
          created: recentDate,
          checksum: 'def456'
        }
      ]);

      mockFs.unlink.mockResolvedValue(undefined);

      await service.cleanupOldBackups();

      // Should delete the old backup but keep the recent one
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('old-backup.sql.gz')
      );
      expect(mockFs.unlink).not.toHaveBeenCalledWith(
        expect.stringContaining('recent-backup.sql.gz')
      );
    });
  });

  describe('Compression and Encryption', () => {
    it('should compress backup files', async () => {
      const filepath = './test-backup.sql';
      const expectedCompressedPath = './test-backup.sql.gz';

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, 'Compression completed', '');
        return {} as any;
      });

      const service = backupService as any;
      const compressedPath = await service.compressBackup(filepath);

      expect(compressedPath).toBe(expectedCompressedPath);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('gzip')
      );
    });

    it('should handle compression failures', async () => {
      const filepath = './test-backup.sql';

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(new Error('Compression failed'), '', 'Error');
        return {} as any;
      });

      const service = backupService as any;

      await expect(service.compressBackup(filepath)).rejects.toThrow('Compression failed');
    });
  });
});