// Tests for PermissionManager service

import { PermissionManager } from '../../src/services/permissionManager';
import { RetailerId, SUPPORTED_RETAILERS } from '../../src/shared/types';

// Mock Chrome APIs
const mockChrome = {
  permissions: {
    contains: jest.fn(),
    request: jest.fn(),
    remove: jest.fn(),
    onAdded: {
      addListener: jest.fn()
    },
    onRemoved: {
      addListener: jest.fn()
    }
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  runtime: {
    sendMessage: jest.fn()
  }
};

// @ts-ignore
global.chrome = mockChrome;

describe('PermissionManager', () => {
  let permissionManager: PermissionManager;

  beforeEach(() => {
    permissionManager = PermissionManager.getInstance();
    jest.clearAllMocks();
  });

  describe('hasRetailerPermission', () => {
    it('should check if permission exists for a retailer', async () => {
      const retailerId: RetailerId = 'bestbuy';
      mockChrome.permissions.contains.mockResolvedValue(true);

      const result = await permissionManager.hasRetailerPermission(retailerId);

      expect(result).toBe(true);
      expect(mockChrome.permissions.contains).toHaveBeenCalledWith({
        origins: [`https://${SUPPORTED_RETAILERS[retailerId].domain}/*`]
      });
    });

    it('should return false for unsupported retailer', async () => {
      const result = await permissionManager.hasRetailerPermission('invalid' as RetailerId);
      expect(result).toBe(false);
    });

    it('should handle permission check errors', async () => {
      mockChrome.permissions.contains.mockRejectedValue(new Error('Permission check failed'));

      const result = await permissionManager.hasRetailerPermission('bestbuy');
      expect(result).toBe(false);
    });
  });

  describe('requestRetailerPermission', () => {
    beforeEach(() => {
      // Mock confirm dialog
      global.confirm = jest.fn().mockReturnValue(true);
    });

    it('should request permission for a retailer', async () => {
      const retailerId: RetailerId = 'bestbuy';
      mockChrome.permissions.contains.mockResolvedValue(false);
      mockChrome.permissions.request.mockResolvedValue(true);
      mockChrome.storage.sync.get.mockResolvedValue({});
      mockChrome.storage.sync.set.mockResolvedValue(undefined);

      const result = await permissionManager.requestRetailerPermission(retailerId);

      expect(result).toBe(true);
      expect(mockChrome.permissions.request).toHaveBeenCalledWith({
        origins: [`https://${SUPPORTED_RETAILERS[retailerId].domain}/*`]
      });
    });

    it('should return true if permission already exists', async () => {
      const retailerId: RetailerId = 'bestbuy';
      mockChrome.permissions.contains.mockResolvedValue(true);

      const result = await permissionManager.requestRetailerPermission(retailerId);

      expect(result).toBe(true);
      expect(mockChrome.permissions.request).not.toHaveBeenCalled();
    });

    it('should return false if user denies permission', async () => {
      const retailerId: RetailerId = 'bestbuy';
      mockChrome.permissions.contains.mockResolvedValue(false);
      global.confirm = jest.fn().mockReturnValue(false);

      const result = await permissionManager.requestRetailerPermission(retailerId);

      expect(result).toBe(false);
      expect(mockChrome.permissions.request).not.toHaveBeenCalled();
    });

    it('should throw error for unsupported retailer', async () => {
      await expect(
        permissionManager.requestRetailerPermission('invalid' as RetailerId)
      ).rejects.toThrow('Unsupported retailer: invalid');
    });
  });

  describe('removeRetailerPermission', () => {
    it('should remove permission for a retailer', async () => {
      const retailerId: RetailerId = 'bestbuy';
      mockChrome.permissions.remove.mockResolvedValue(true);
      mockChrome.storage.sync.get.mockResolvedValue({});
      mockChrome.storage.sync.set.mockResolvedValue(undefined);

      const result = await permissionManager.removeRetailerPermission(retailerId);

      expect(result).toBe(true);
      expect(mockChrome.permissions.remove).toHaveBeenCalledWith({
        origins: [`https://${SUPPORTED_RETAILERS[retailerId].domain}/*`]
      });
    });

    it('should return false for unsupported retailer', async () => {
      const result = await permissionManager.removeRetailerPermission('invalid' as RetailerId);
      expect(result).toBe(false);
    });

    it('should handle removal errors', async () => {
      mockChrome.permissions.remove.mockRejectedValue(new Error('Removal failed'));

      const result = await permissionManager.removeRetailerPermission('bestbuy');
      expect(result).toBe(false);
    });
  });

  describe('getAllPermissionStatuses', () => {
    it('should return status for all supported retailers', async () => {
      mockChrome.permissions.contains
        .mockResolvedValueOnce(true)  // bestbuy
        .mockResolvedValueOnce(false) // walmart
        .mockResolvedValueOnce(true)  // costco
        .mockResolvedValueOnce(false); // samsclub

      const statuses = await permissionManager.getAllPermissionStatuses();

      expect(statuses).toHaveLength(4);
      expect(statuses[0]).toMatchObject({
        retailerId: 'bestbuy',
        hasPermission: true,
        isRequired: false
      });
      expect(statuses[1]).toMatchObject({
        retailerId: 'walmart',
        hasPermission: false,
        isRequired: false
      });
    });
  });

  describe('validateRequiredPermissions', () => {
    it('should validate all required permissions', async () => {
      // Mock required permissions as granted
      mockChrome.permissions.contains
        .mockResolvedValueOnce(true)  // storage
        .mockResolvedValueOnce(true)  // activeTab
        .mockResolvedValueOnce(true)  // notifications
        .mockResolvedValueOnce(true)  // alarms
        .mockResolvedValueOnce(true)  // api.boosterbeacon.com
        .mockResolvedValueOnce(false) // bestbuy (optional)
        .mockResolvedValueOnce(false) // walmart (optional)
        .mockResolvedValueOnce(false) // costco (optional)
        .mockResolvedValueOnce(false); // samsclub (optional)

      const validation = await permissionManager.validateRequiredPermissions();

      expect(validation.valid).toBe(true);
      expect(validation.missing).toHaveLength(0);
      expect(validation.optional).toEqual(['bestbuy', 'walmart', 'costco', 'samsclub']);
    });

    it('should identify missing required permissions', async () => {
      // Mock some required permissions as missing
      mockChrome.permissions.contains
        .mockResolvedValueOnce(true)  // storage
        .mockResolvedValueOnce(false) // activeTab - MISSING
        .mockResolvedValueOnce(true)  // notifications
        .mockResolvedValueOnce(false) // alarms - MISSING
        .mockResolvedValueOnce(true)  // api.boosterbeacon.com
        .mockResolvedValueOnce(false) // bestbuy (optional)
        .mockResolvedValueOnce(false) // walmart (optional)
        .mockResolvedValueOnce(false) // costco (optional)
        .mockResolvedValueOnce(false); // samsclub (optional)

      const validation = await permissionManager.validateRequiredPermissions();

      expect(validation.valid).toBe(false);
      expect(validation.missing).toEqual(['activeTab', 'alarms']);
      expect(validation.optional).toEqual(['bestbuy', 'walmart', 'costco', 'samsclub']);
    });
  });

  describe('requestMultipleRetailerPermissions', () => {
    beforeEach(() => {
      global.confirm = jest.fn().mockReturnValue(true);
    });

    it('should request permissions for multiple retailers', async () => {
      const retailerIds: RetailerId[] = ['bestbuy', 'walmart'];
      mockChrome.permissions.request.mockResolvedValue(true);
      mockChrome.permissions.contains
        .mockResolvedValueOnce(true)  // bestbuy check after request
        .mockResolvedValueOnce(true); // walmart check after request
      mockChrome.storage.sync.get.mockResolvedValue({});
      mockChrome.storage.sync.set.mockResolvedValue(undefined);

      const results = await permissionManager.requestMultipleRetailerPermissions(retailerIds);

      expect(results.bestbuy).toBe(true);
      expect(results.walmart).toBe(true);
      expect(mockChrome.permissions.request).toHaveBeenCalledWith({
        origins: [
          'https://bestbuy.com/*',
          'https://walmart.com/*'
        ]
      });
    });

    it('should handle user denial', async () => {
      const retailerIds: RetailerId[] = ['bestbuy', 'walmart'];
      global.confirm = jest.fn().mockReturnValue(false);

      const results = await permissionManager.requestMultipleRetailerPermissions(retailerIds);

      expect(results.bestbuy).toBe(false);
      expect(results.walmart).toBe(false);
      expect(mockChrome.permissions.request).not.toHaveBeenCalled();
    });
  });

  describe('checkRequiredPermissions', () => {
    it('should identify missing permissions for enabled retailers', async () => {
      // Mock user settings with enabled retailers
      mockChrome.storage.sync.get.mockResolvedValue({
        booster_settings: {
          retailerSettings: {
            bestbuy: { enabled: true },
            walmart: { enabled: false },
            costco: { enabled: true }
          }
        }
      });

      // Mock permission checks
      mockChrome.permissions.contains
        .mockResolvedValueOnce(true)  // bestbuy - has permission
        .mockResolvedValueOnce(false); // costco - missing permission

      const missingPermissions = await permissionManager.checkRequiredPermissions();

      expect(missingPermissions).toEqual(['costco']);
    });

    it('should return empty array when all enabled retailers have permissions', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        booster_settings: {
          retailerSettings: {
            bestbuy: { enabled: true },
            walmart: { enabled: false }
          }
        }
      });

      mockChrome.permissions.contains.mockResolvedValue(true);

      const missingPermissions = await permissionManager.checkRequiredPermissions();

      expect(missingPermissions).toEqual([]);
    });
  });
});