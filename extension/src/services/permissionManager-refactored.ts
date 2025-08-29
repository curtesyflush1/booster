// Refactored Permission Management with separated concerns
import { RetailerId, SUPPORTED_RETAILERS } from '../shared/types';
import { log } from '../shared/utils';

// Separate interface for permission operations
interface IPermissionChecker {
  hasPermission(retailerId: RetailerId): Promise<boolean>;
  requestPermission(retailerId: RetailerId, reason?: string): Promise<boolean>;
  removePermission(retailerId: RetailerId): Promise<boolean>;
}

// Separate interface for UI interactions
interface IPermissionUI {
  showPermissionExplanation(retailerId: RetailerId, reason: string): Promise<boolean>;
  showMultiplePermissionExplanation(retailerIds: RetailerId[], reason: string): Promise<boolean>;
}

// Separate interface for storage operations
interface IPermissionStorage {
  updateRetailerSettings(retailerId: RetailerId, enabled: boolean): Promise<void>;
  getRetailerSettings(): Promise<Record<string, any>>;
}

// Core permission checker - focused on Chrome API interactions
class ChromePermissionChecker implements IPermissionChecker {
  async hasPermission(retailerId: RetailerId): Promise<boolean> {
    const retailer = SUPPORTED_RETAILERS[retailerId];
    if (!retailer) return false;

    try {
      return await chrome.permissions.contains({
        origins: [`https://${retailer.domain}/*`]
      });
    } catch (error) {
      log('error', `Failed to check permission for ${retailerId}`, error);
      return false;
    }
  }

  async requestPermission(retailerId: RetailerId, reason?: string): Promise<boolean> {
    const retailer = SUPPORTED_RETAILERS[retailerId];
    if (!retailer) {
      throw new Error(`Unsupported retailer: ${retailerId}`);
    }

    try {
      return await chrome.permissions.request({
        origins: [`https://${retailer.domain}/*`]
      });
    } catch (error) {
      log('error', `Failed to request permission for ${retailerId}`, error);
      return false;
    }
  }

  async removePermission(retailerId: RetailerId): Promise<boolean> {
    const retailer = SUPPORTED_RETAILERS[retailerId];
    if (!retailer) return false;

    try {
      return await chrome.permissions.remove({
        origins: [`https://${retailer.domain}/*`]
      });
    } catch (error) {
      log('error', `Failed to remove permission for ${retailerId}`, error);
      return false;
    }
  }
}

// UI handler - focused on user interactions
class PermissionUIHandler implements IPermissionUI {
  async showPermissionExplanation(retailerId: RetailerId, reason: string): Promise<boolean> {
    const retailer = SUPPORTED_RETAILERS[retailerId];
    const message = this.buildPermissionMessage(retailer.name, reason);
    return confirm(message);
  }

  async showMultiplePermissionExplanation(retailerIds: RetailerId[], reason: string): Promise<boolean> {
    const retailerNames = retailerIds.map(id => SUPPORTED_RETAILERS[id].name).join(', ');
    const message = this.buildMultiplePermissionMessage(retailerNames, reason);
    return confirm(message);
  }

  private buildPermissionMessage(retailerName: string, reason: string): string {
    return `BoosterBeacon needs permission to access ${retailerName} to:\n\n` +
      `• Monitor product availability\n` +
      `• Detect products on pages you visit\n` +
      `• Assist with checkout processes\n` +
      `• Provide add-to-cart functionality\n\n` +
      `Reason: ${reason}\n\n` +
      `Grant permission to ${retailerName}?`;
  }

  private buildMultiplePermissionMessage(retailerNames: string, reason: string): string {
    return `BoosterBeacon needs permission to access the following retailers:\n\n` +
      `${retailerNames}\n\n` +
      `This will enable:\n` +
      `• Product monitoring and alerts\n` +
      `• Checkout assistance\n` +
      `• Price tracking\n\n` +
      `Reason: ${reason}\n\n` +
      `Grant permissions for these retailers?`;
  }
}

// Storage handler - focused on settings management
class PermissionStorageHandler implements IPermissionStorage {
  async updateRetailerSettings(retailerId: RetailerId, enabled: boolean): Promise<void> {
    try {
      const settings = await chrome.storage.sync.get(['booster_settings']);
      const currentSettings = settings.booster_settings || {};
      
      if (!currentSettings.retailerSettings) {
        currentSettings.retailerSettings = {};
      }
      
      if (!currentSettings.retailerSettings[retailerId]) {
        currentSettings.retailerSettings[retailerId] = {
          enabled,
          autoLogin: false,
          autoFill: true
        };
      } else {
        currentSettings.retailerSettings[retailerId].enabled = enabled;
      }
      
      await chrome.storage.sync.set({ booster_settings: currentSettings });
    } catch (error) {
      log('error', `Failed to update settings for ${retailerId}`, error);
      throw error;
    }
  }

  async getRetailerSettings(): Promise<Record<string, any>> {
    try {
      const settings = await chrome.storage.sync.get(['booster_settings']);
      return settings.booster_settings?.retailerSettings || {};
    } catch (error) {
      log('error', 'Failed to get retailer settings', error);
      return {};
    }
  }
}

// Main permission manager - orchestrates the components
export class PermissionManager {
  private static instance: PermissionManager;
  private permissionChecker: IPermissionChecker;
  private uiHandler: IPermissionUI;
  private storageHandler: IPermissionStorage;
  
  private constructor() {
    this.permissionChecker = new ChromePermissionChecker();
    this.uiHandler = new PermissionUIHandler();
    this.storageHandler = new PermissionStorageHandler();
  }
  
  static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  // Simplified public interface
  async hasRetailerPermission(retailerId: RetailerId): Promise<boolean> {
    const hasPermission = await this.permissionChecker.hasPermission(retailerId);
    log('info', `Permission check for ${retailerId}: ${hasPermission}`);
    return hasPermission;
  }

  async requestRetailerPermission(
    retailerId: RetailerId, 
    reason: string = 'Enable product monitoring and checkout assistance'
  ): Promise<boolean> {
    // Check if already granted
    if (await this.hasRetailerPermission(retailerId)) {
      return true;
    }

    // Show explanation and get consent
    const userConsent = await this.uiHandler.showPermissionExplanation(retailerId, reason);
    if (!userConsent) {
      return false;
    }

    // Request permission
    const granted = await this.permissionChecker.requestPermission(retailerId, reason);
    
    if (granted) {
      await this.handlePermissionGranted(retailerId);
      log('info', `Permission granted for ${retailerId}`);
    } else {
      log('info', `Permission denied for ${retailerId}`);
    }

    return granted;
  }

  private async handlePermissionGranted(retailerId: RetailerId): Promise<void> {
    await this.storageHandler.updateRetailerSettings(retailerId, true);
    
    // Notify background script
    chrome.runtime.sendMessage({
      type: 'PERMISSION_GRANTED',
      payload: { retailerId }
    });
  }

  // ... rest of the methods would follow similar pattern
}