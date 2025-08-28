import { EmailPreferencesService } from '../../src/services/emailPreferencesService';
import { db } from '../../src/config/database';

// Mock the database
jest.mock('../../src/config/database', () => ({
  db: jest.fn()
}));

const mockDb = db as jest.MockedFunction<typeof db>;

describe('EmailPreferencesService', () => {
  const userId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserPreferences', () => {
    it('should return existing preferences', async () => {
      const mockPreferences = {
        user_id: userId,
        alert_emails: true,
        marketing_emails: false,
        weekly_digest: true,
        unsubscribe_token: 'token-123',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockPreferences)
      } as any);

      const result = await EmailPreferencesService.getUserPreferences(userId);

      expect(result).toEqual({
        userId,
        alertEmails: true,
        marketingEmails: false,
        weeklyDigest: true,
        unsubscribeToken: 'token-123',
        createdAt: mockPreferences.created_at,
        updatedAt: mockPreferences.updated_at
      });
    });

    it('should create default preferences if none exist', async () => {
      // Mock no existing preferences
      mockDb.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      } as any);

      // Mock insert for creating default preferences
      mockDb.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue([])
      } as any);

      const result = await EmailPreferencesService.getUserPreferences(userId);

      expect(result).toEqual({
        userId,
        alertEmails: true,
        marketingEmails: true,
        weeklyDigest: true,
        unsubscribeToken: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences successfully', async () => {
      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(1)
      } as any);

      const result = await EmailPreferencesService.updatePreferences(userId, {
        alertEmails: false,
        marketingEmails: true
      });

      expect(result).toBe(true);
    });

    it('should handle update failure', async () => {
      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockRejectedValue(new Error('Database error'))
      } as any);

      const result = await EmailPreferencesService.updatePreferences(userId, {
        alertEmails: false
      });

      expect(result).toBe(false);
    });
  });

  describe('createUnsubscribeToken', () => {
    it('should create unsubscribe token successfully', async () => {
      mockDb.mockReturnValue({
        insert: jest.fn().mockResolvedValue([])
      } as any);

      const result = await EmailPreferencesService.createUnsubscribeToken(userId, 'alerts');

      expect(result).toMatch(/^alerts_\d+_[a-z0-9]+$/);
    });
  });

  describe('processUnsubscribe', () => {
    it('should process valid unsubscribe token', async () => {
      const token = 'alerts_123_abc';
      const mockToken = {
        user_id: userId,
        email_type: 'alerts'
      };

      // Mock token lookup
      mockDb.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockToken)
      } as any);

      // Mock preferences update
      mockDb.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(1)
      } as any);

      // Mock token marking as used
      mockDb.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(1)
      } as any);

      const result = await EmailPreferencesService.processUnsubscribe(token);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully unsubscribed from alerts emails');
      expect(result.userId).toBe(userId);
      expect(result.emailType).toBe('alerts');
    });

    it('should reject invalid token', async () => {
      const token = 'invalid-token';

      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      } as any);

      const result = await EmailPreferencesService.processUnsubscribe(token);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid or expired unsubscribe token');
    });

    it('should handle all email types unsubscribe', async () => {
      const token = 'all_123_abc';
      const mockToken = {
        user_id: userId,
        email_type: 'all'
      };

      // Mock token lookup
      mockDb.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockToken)
      } as any);

      // Mock preferences update
      mockDb.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(1)
      } as any);

      // Mock token marking as used
      mockDb.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(1)
      } as any);

      const result = await EmailPreferencesService.processUnsubscribe(token);

      expect(result.success).toBe(true);
      expect(result.emailType).toBe('all');
    });
  });

  describe('canReceiveEmail', () => {
    it('should return true for enabled alert emails', async () => {
      const mockPreferences = {
        user_id: userId,
        alert_emails: true,
        marketing_emails: false,
        weekly_digest: true,
        unsubscribe_token: 'token-123',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockPreferences)
      } as any);

      const result = await EmailPreferencesService.canReceiveEmail(userId, 'alerts');

      expect(result).toBe(true);
    });

    it('should return false for disabled marketing emails', async () => {
      const mockPreferences = {
        user_id: userId,
        alert_emails: true,
        marketing_emails: false,
        weekly_digest: true,
        unsubscribe_token: 'token-123',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockPreferences)
      } as any);

      const result = await EmailPreferencesService.canReceiveEmail(userId, 'marketing');

      expect(result).toBe(false);
    });

    it('should return false if preferences not found', async () => {
      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      } as any);

      const result = await EmailPreferencesService.canReceiveEmail(userId, 'alerts');

      expect(result).toBe(false);
    });
  });

  describe('getDeliveryStats', () => {
    it('should return delivery statistics', async () => {
      const mockStats = {
        total_sent: '100',
        total_delivered: '95',
        total_bounced: '3',
        total_complained: '2'
      };

      mockDb.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockStats)
      } as any);

      const result = await EmailPreferencesService.getDeliveryStats();

      expect(result).toEqual({
        totalSent: 100,
        totalDelivered: 95,
        totalBounced: 3,
        totalComplained: 2,
        deliveryRate: 95,
        bounceRate: 3,
        complaintRate: 2
      });
    });

    it('should handle zero emails sent', async () => {
      const mockStats = {
        total_sent: '0',
        total_delivered: '0',
        total_bounced: '0',
        total_complained: '0'
      };

      mockDb.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockStats)
      } as any);

      const result = await EmailPreferencesService.getDeliveryStats();

      expect(result).toEqual({
        totalSent: 0,
        totalDelivered: 0,
        totalBounced: 0,
        totalComplained: 0,
        deliveryRate: 0,
        bounceRate: 0,
        complaintRate: 0
      });
    });

    it('should return user-specific stats when userId provided', async () => {
      const mockStats = {
        total_sent: '50',
        total_delivered: '48',
        total_bounced: '1',
        total_complained: '1'
      };

      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockStats)
      } as any);

      const result = await EmailPreferencesService.getDeliveryStats(userId);

      expect(result).toEqual({
        totalSent: 50,
        totalDelivered: 48,
        totalBounced: 1,
        totalComplained: 1,
        deliveryRate: 96,
        bounceRate: 2,
        complaintRate: 2
      });
    });
  });

  describe('generateUnsubscribeToken', () => {
    it('should generate valid unsubscribe token', () => {
      const token = EmailPreferencesService.generateUnsubscribeToken();

      expect(token).toMatch(/^unsub_\d+_[a-z0-9]+$/);
      expect(token.length).toBeGreaterThan(20);
    });

    it('should generate unique tokens', () => {
      const token1 = EmailPreferencesService.generateUnsubscribeToken();
      const token2 = EmailPreferencesService.generateUnsubscribeToken();

      expect(token1).not.toBe(token2);
    });
  });
});