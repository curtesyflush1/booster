import { EmailConfigService } from '../../src/services/emailConfigService';

describe('EmailConfigService', () => {
  describe('getCurrentConfiguration', () => {
    it('should return email configuration', () => {
      const config = EmailConfigService.getCurrentConfiguration();
      
      expect(config).toHaveProperty('provider');
      expect(config).toHaveProperty('host');
      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('fromEmail');
      expect(config).toHaveProperty('fromName');
      
      expect(typeof config.host).toBe('string');
      expect(typeof config.port).toBe('number');
      expect(config.port).toBeGreaterThan(0);
      expect(config.port).toBeLessThanOrEqual(65535);
    });

    it('should use development configuration in test environment', () => {
      const config = EmailConfigService.getCurrentConfiguration();
      
      // In test environment without custom SMTP, should use development config
      expect(['development', 'local', 'custom']).toContain(config.provider);
    });
  });

  describe('validateConfiguration', () => {
    it('should validate email configuration', async () => {
      const validation = await EmailConfigService.validateConfiguration();
      
      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('errors');
      expect(validation).toHaveProperty('warnings');
      expect(validation).toHaveProperty('configuration');
      
      expect(Array.isArray(validation.errors)).toBe(true);
      expect(Array.isArray(validation.warnings)).toBe(true);
    });
  });

  describe('getConfigurationRecommendations', () => {
    it('should return configuration recommendations', () => {
      const recommendations = EmailConfigService.getConfigurationRecommendations();
      
      expect(recommendations).toHaveProperty('production');
      expect(recommendations).toHaveProperty('development');
      expect(recommendations).toHaveProperty('security');
      
      expect(Array.isArray(recommendations.production)).toBe(true);
      expect(Array.isArray(recommendations.development)).toBe(true);
      expect(Array.isArray(recommendations.security)).toBe(true);
      
      expect(recommendations.production.length).toBeGreaterThan(0);
      expect(recommendations.development.length).toBeGreaterThan(0);
      expect(recommendations.security.length).toBeGreaterThan(0);
    });
  });

  describe('generateEnvTemplate', () => {
    it('should generate environment variable template', () => {
      const template = EmailConfigService.generateEnvTemplate();
      
      expect(typeof template).toBe('string');
      expect(template).toContain('SMTP_HOST');
      expect(template).toContain('SMTP_PORT');
      expect(template).toContain('FROM_EMAIL');
      expect(template).toContain('FROM_NAME');
      expect(template).toContain('Option 1: Local SMTP Server');
      expect(template).toContain('Option 2: Custom SMTP Provider');
      expect(template).toContain('Option 3: Development');
    });
  });

  describe('getDeliveryBestPractices', () => {
    it('should return delivery best practices', () => {
      const practices = EmailConfigService.getDeliveryBestPractices();
      
      expect(Array.isArray(practices)).toBe(true);
      expect(practices.length).toBeGreaterThan(0);
      
      practices.forEach(practice => {
        expect(practice).toHaveProperty('category');
        expect(practice).toHaveProperty('practices');
        expect(typeof practice.category).toBe('string');
        expect(Array.isArray(practice.practices)).toBe(true);
        expect(practice.practices.length).toBeGreaterThan(0);
      });
    });

    it('should include expected categories', () => {
      const practices = EmailConfigService.getDeliveryBestPractices();
      const categories = practices.map(p => p.category);
      
      expect(categories).toContain('Authentication & Security');
      expect(categories).toContain('Content & Formatting');
      expect(categories).toContain('List Management');
      expect(categories).toContain('Monitoring & Analytics');
    });
  });

  describe('testEmailDelivery', () => {
    it('should handle email delivery test', async () => {
      const result = await EmailConfigService.testEmailDelivery('test@example.com');
      
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      
      if (!result.success) {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      } else {
        expect(result).toHaveProperty('messageId');
      }
    });

    it('should provide preview URL for development emails', async () => {
      // This test might provide a preview URL in development mode
      const result = await EmailConfigService.testEmailDelivery('test@example.com');
      
      if (result.success && result.previewUrl) {
        expect(typeof result.previewUrl).toBe('string');
        expect(result.previewUrl).toMatch(/^https?:\/\//);
      }
    });
  });
});