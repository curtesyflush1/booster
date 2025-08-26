import { safeCount, safeSum, safeStatsMap, isValidResultArray, safeQueryResult } from '../../src/utils/database';

describe('Database Utilities', () => {
  describe('safeCount', () => {
    it('should handle empty results', () => {
      expect(safeCount([])).toBe(0);
    });

    it('should handle undefined results', () => {
      expect(safeCount(undefined as any)).toBe(0);
    });

    it('should handle null results', () => {
      expect(safeCount(null as any)).toBe(0);
    });

    it('should parse string counts correctly', () => {
      expect(safeCount([{ count: '42' }])).toBe(42);
      expect(safeCount([{ count: '0' }])).toBe(0);
    });

    it('should handle numeric counts', () => {
      expect(safeCount([{ count: 42 }])).toBe(42);
      expect(safeCount([{ count: 0 }])).toBe(0);
    });

    it('should handle invalid string counts', () => {
      expect(safeCount([{ count: 'invalid' }])).toBe(0);
      expect(safeCount([{ count: '' }])).toBe(0);
    });

    it('should handle missing count property', () => {
      expect(safeCount([{}])).toBe(0);
      expect(safeCount([{ other: 'value' }])).toBe(0);
    });

    it('should handle multiple results (uses first)', () => {
      expect(safeCount([{ count: '10' }, { count: '20' }])).toBe(10);
    });
  });

  describe('safeSum', () => {
    it('should handle empty results', () => {
      expect(safeSum([], 'total')).toBe(0);
    });

    it('should handle undefined results', () => {
      expect(safeSum(undefined as any, 'total')).toBe(0);
    });

    it('should parse string sums correctly', () => {
      expect(safeSum([{ total: '123.45' }], 'total')).toBe(123.45);
      expect(safeSum([{ total: '0' }], 'total')).toBe(0);
    });

    it('should handle numeric sums', () => {
      expect(safeSum([{ total: 123.45 }], 'total')).toBe(123.45);
      expect(safeSum([{ total: 0 }], 'total')).toBe(0);
    });

    it('should handle invalid string sums', () => {
      expect(safeSum([{ total: 'invalid' }], 'total')).toBe(0);
      expect(safeSum([{ total: '' }], 'total')).toBe(0);
    });

    it('should handle missing field', () => {
      expect(safeSum([{}], 'total')).toBe(0);
      expect(safeSum([{ other: 'value' }], 'total')).toBe(0);
    });

    it('should handle null values', () => {
      expect(safeSum([{ total: null }], 'total')).toBe(0);
      expect(safeSum([{ total: undefined }], 'total')).toBe(0);
    });
  });

  describe('safeStatsMap', () => {
    it('should handle empty results', () => {
      const result = safeStatsMap([], 'type', 'count');
      expect(result).toEqual({});
    });

    it('should handle undefined results', () => {
      const result = safeStatsMap(undefined as any, 'type', 'count');
      expect(result).toEqual({});
    });

    it('should process valid statistics correctly', () => {
      const results = [
        { type: 'restock', count: '10' },
        { type: 'price_drop', count: 15 },
        { type: 'low_stock', count: '5' }
      ];
      
      const expected = {
        restock: 10,
        price_drop: 15,
        low_stock: 5
      };
      
      expect(safeStatsMap(results, 'type', 'count')).toEqual(expected);
    });

    it('should handle missing keys or values', () => {
      const results = [
        { type: 'restock', count: '10' },
        { count: '15' }, // missing type
        { type: 'low_stock' }, // missing count
        { type: 'valid', count: '20' }
      ];
      
      const expected = {
        restock: 10,
        valid: 20
      };
      
      expect(safeStatsMap(results, 'type', 'count')).toEqual(expected);
    });

    it('should handle invalid numeric values', () => {
      const results = [
        { type: 'restock', count: 'invalid' },
        { type: 'price_drop', count: '15' },
        { type: 'low_stock', count: null }
      ];
      
      const expected = {
        price_drop: 15
      };
      
      expect(safeStatsMap(results, 'type', 'count')).toEqual(expected);
    });

    it('should use default value field', () => {
      const results = [
        { status: 'active', count: '10' },
        { status: 'inactive', count: '5' }
      ];
      
      const expected = {
        active: 10,
        inactive: 5
      };
      
      expect(safeStatsMap(results, 'status')).toEqual(expected);
    });
  });

  describe('isValidResultArray', () => {
    it('should return true for valid arrays', () => {
      expect(isValidResultArray([{ id: 1 }])).toBe(true);
      expect(isValidResultArray([1, 2, 3])).toBe(true);
    });

    it('should return false for empty arrays', () => {
      expect(isValidResultArray([])).toBe(false);
    });

    it('should return false for non-arrays', () => {
      expect(isValidResultArray(null)).toBe(false);
      expect(isValidResultArray(undefined)).toBe(false);
      expect(isValidResultArray('string')).toBe(false);
      expect(isValidResultArray({})).toBe(false);
      expect(isValidResultArray(123)).toBe(false);
    });
  });

  describe('safeQueryResult', () => {
    it('should return value when defined', () => {
      expect(safeQueryResult('test', 'default')).toBe('test');
      expect(safeQueryResult(0, 42)).toBe(0);
      expect(safeQueryResult(false, true)).toBe(false);
      expect(safeQueryResult(null, 'default')).toBe(null);
    });

    it('should return default when undefined', () => {
      expect(safeQueryResult(undefined, 'default')).toBe('default');
    });

    it('should work with complex objects', () => {
      const obj = { id: 1, name: 'test' };
      const defaultObj = { id: 0, name: 'default' };
      
      expect(safeQueryResult(obj, defaultObj)).toBe(obj);
      expect(safeQueryResult(undefined, defaultObj)).toBe(defaultObj);
    });
  });
});