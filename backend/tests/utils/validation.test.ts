import { validateUUID } from '../../src/utils/validation';

describe('Validation Utils', () => {
  describe('validateUUID', () => {
    it('should validate correct UUIDs', () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      expect(validateUUID(validUUID)).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(validateUUID('invalid-uuid')).toBe(false);
      expect(validateUUID('')).toBe(false);
      expect(validateUUID('123')).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(validateUUID(null as any)).toBe(false);
      expect(validateUUID(undefined as any)).toBe(false);
    });
  });
});