// Permission management service for BoosterBeacon browser extension
// Handles dynamic permission requests and management for retailer access

import { RetailerId, SUPPORTED_RETAILERS } from '../shared/types';
import { log } from '../shared/utils';

export interface PermissionStatus {
  retailerId: RetailerId;
  hasPermission: boolean;
  isRequired: boolean;
  lastChecked: number;
}

export interface PermissionRequest {
  retailerId: RetailerId;
  reason: string;
  features: string[];
}

export class PermissionManager {
  private static instance: PermissionManager;
  
  private constructor() {}
  
  static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  /**
   * Check if we have permission for a specific retailer
   */
  async hasRetailerPermission(retailerId: RetailerId): Promise<boolean> {
    const retailer = SUPPORTED_RETAILERS[retailerId];
    if (!retailer) {
      return false;
    }

    try {
      const hasPermission = await chrome.permissions.contains({
        origins: [`https://${retailer.domain}/*`]
      });
      
      log('info', `Permission check for ${retailerId}: ${hasPermission}`);
      return hasPermission;
    } catch (error) {
      log('error', `Failed to check permission for ${retailerId}`, error);
      return false;
    }
  }

  /**
   * Request permission for a specific retailer
   */
  async requestRetailerPermission(
    retailerId: RetailerId, 
    reason: string = 'Enable product monitoring and checkout assistance'
  ): Promise<boolean> {
    const retailer = SUPPORTED_RETAILERS[retailerId];
    if (!retailer) {
      throw new Error(`Unsupported retailer: ${retailerId}`);
    }

    try {
      // Check if we already have permission
      const hasPermission = await this.hasRetailerPermission(retailerId);
      if (hasPermission) {
        return true;
      }

      // Show user-friendly explanation before requesting
      const userConsent = await this.showPermissionExplanation(retailerId, reason);
      if (!userConsent) {
        return false;
      }

      // Request the permission
      const granted = await chrome.permissions.request({
        origins: [`https://${retailer.domain}/*`]
      });

      if (granted) {
        log('info', `Permission granted for ${retailerId}`);
        await this.onPermissionGranted(retailerId);
      } else {
        log('info', `Permission denied for ${retailerId}`);
      }

      return granted;
    } catch (error) {
      log('error', `Failed to request permission for ${retailerId}`, error);
      return false;
    }
  }

  /**
   * Remove permission for a specific retailer
   */
  async removeRetailerPermission(retailerId: RetailerId): Promise<boolean> {
    const retailer = SUPPORTED_RETAILERS[retailerId];
    if (!retailer) {
      return false;
    }

    try {
      const removed = await chrome.permissions.remove({
        origins: [`https://${retailer.domain}/*`]
      });

      if (removed) {
        log('info', `Permission removed for ${retailerId}`);
        await this.onPermissionRemoved(retailerId);
      }

      return removed;
    } catch (error) {
      log('error', `Failed to remove permission for ${retailerId}`, error);
      return false;
    }
  }

  /**
   * Get permission status for all retailers
   */
  async getAllPermissionStatuses(): Promise<PermissionStatus[]> {
    const statuses: PermissionStatus[] = [];
    
    for (const retailerId of Object.keys(SUPPORTED_RETAILERS) as RetailerId[]) {
      const hasPermission = await this.hasRetailerPermission(retailerId);
      
      statuses.push({
        retailerId,
        hasPermission,
        isRequired: false, // All retailer permissions are now optional
        lastChecked: Date.now()
      });
    }
    
    return statuses;
  }

  /**
   * Request permissions for multiple retailers at once
   */
  async requestMultipleRetailerPermissions(
    retailerIds: RetailerId[], 
    reason: string = 'Enable monitoring for selected retailers'
  ): Promise<{ [key in RetailerId]?: boolean }> {
    const results: { [key in RetailerId]?: boolean } = {};
    
    // Validate input
    const validRetailerIds = retailerIds.filter(id => this.isValidRetailerId(id));
    if (validRetailerIds.length === 0) {
      return results;
    }

    // Build origins array
    const origins = validRetailerIds.map(id => {
      const retailer = SUPPORTED_RETAILERS[id];
      return `https://${retailer.domain}/*`;
    });

    try {
      // Show explanation for all retailers
      const userConsent = await this.showMultiplePermissionExplanation(validRetailerIds, reason);
      if (!userConsent) {
        // Mark all as denied
        validRetailerIds.forEach(id => results[id] = false);
        return results;
      }

      // Request all permissions at once
      const granted = await chrome.permissions.request({ origins });

      if (granted) {
        // Check permissions in parallel for better performance
        const permissionChecks = validRetailerIds.map(async (retailerId) => {
          const hasPermission = await this.hasRetailerPermission(retailerId);
          results[retailerId] = hasPermission;
          return { retailerId, hasPermission };
        });

        const permissionResults = await Promise.allSettled(permissionChecks);
        
        // Process granted permissions in parallel
        const grantedPermissions = permissionResults
          .filter((result): result is PromiseFulfilledResult<{retailerId: RetailerId, hasPermission: boolean}> => 
            result.status === 'fulfilled' && result.value.hasPermission)
          .map(result => result.value.retailerId);

        if (grantedPermissions.length > 0) {
          await Promise.allSettled(
            grantedPermissions.map(retailerId => this.onPermissionGranted(retailerId))
          );
        }
      } else {
        // Mark all as denied
        validRetailerIds.forEach(id => results[id] = false);
      }

      return results;
    } catch (error) {
      log('error', 'Failed to request multiple permissions', error);
      validRetailerIds.forEach(id => results[id] = false);
      return results;
    }
  }

  /**
   * Check if user needs to grant any permissions for their current settings
   */
  async checkRequiredPermissions(): Promise<RetailerId[]> {
    const missingPermissions: RetailerId[] = [];
    
    try {
      // Get user's retailer settings with validation
      const settings = await chrome.storage.sync.get(['booster_settings']);
      const retailerSettings = this.validateRetailerSettings(settings['booster_settings']?.retailerSettings);
      
      // Check permissions for enabled retailers
      for (const [retailerId, config] of Object.entries(retailerSettings)) {
        if (this.isValidRetailerId(retailerId) && 
            this.isValidRetailerConfig(config) && 
            config.enabled && 
            !await this.hasRetailerPermission(retailerId as RetailerId)) {
          missingPermissions.push(retailerId as RetailerId);
        }
      }
    } catch (error) {
      log('error', 'Failed to check required permissions', error);
    }
    
    return missingPermissions;
  }

  /**
   * Validate retailer settings structure
   */
  private validateRetailerSettings(settings: any): Record<string, any> {
    if (!settings || typeof settings !== 'object') {
      return {};
    }
    return settings;
  }

  /**
   * Type guard for retailer ID validation
   */
  private isValidRetailerId(id: string): id is RetailerId {
    return id in SUPPORTED_RETAILERS;
  }

  /**
   * Validate retailer configuration object
   */
  private isValidRetailerConfig(config: any): config is { enabled: boolean } {
    return config && 
           typeof config === 'object' && 
           typeof config.enabled === 'boolean';
  }

  /**
   * Set up permission change listeners
   */
  setupPermissionListeners(): void {
    if (chrome.permissions.onAdded) {
      chrome.permissions.onAdded.addListener((permissions) => {
        log('info', 'Permissions added', permissions);
        this.handlePermissionChange('added', permissions);
      });
    }

    if (chrome.permissions.onRemoved) {
      chrome.permissions.onRemoved.addListener((permissions) => {
        log('info', 'Permissions removed', permissions);
        this.handlePermissionChange('removed', permissions);
      });
    }
  }

  /**
   * Handle permission changes
   */
  private async handlePermissionChange(
    action: 'added' | 'removed', 
    permissions: chrome.permissions.Permissions
  ): Promise<void> {
    if (!permissions.origins) return;

    for (const origin of permissions.origins) {
      const retailerId = this.getRetailerIdFromOrigin(origin);
      if (retailerId) {
        if (action === 'added') {
          await this.onPermissionGranted(retailerId);
        } else {
          await this.onPermissionRemoved(retailerId);
        }
      }
    }
  }

  /**
   * Get retailer ID from origin URL
   */
  private getRetailerIdFromOrigin(origin: string): RetailerId | null {
    for (const [id, retailer] of Object.entries(SUPPORTED_RETAILERS)) {
      if (origin.includes(retailer.domain)) {
        return id as RetailerId;
      }
    }
    return null;
  }

  /**
   * Show user-friendly permission explanation
   */
  private async showPermissionExplanation(
    retailerId: RetailerId, 
    reason: string
  ): Promise<boolean> {
    const retailer = SUPPORTED_RETAILERS[retailerId];
    
    const message = `BoosterBeacon needs permission to access ${retailer.name} to:\n\n` +
      `• Monitor product availability\n` +
      `• Detect products on pages you visit\n` +
      `• Assist with checkout processes\n` +
      `• Provide add-to-cart functionality\n\n` +
      `Reason: ${reason}\n\n` +
      `Grant permission to ${retailer.name}?`;

    return confirm(message);
  }

  /**
   * Show explanation for multiple retailer permissions
   */
  private async showMultiplePermissionExplanation(
    retailerIds: RetailerId[], 
    reason: string
  ): Promise<boolean> {
    const retailerNames = retailerIds.map(id => SUPPORTED_RETAILERS[id].name).join(', ');
    
    const message = `BoosterBeacon needs permission to access the following retailers:\n\n` +
      `${retailerNames}\n\n` +
      `This will enable:\n` +
      `• Product monitoring and alerts\n` +
      `• Checkout assistance\n` +
      `• Price tracking\n\n` +
      `Reason: ${reason}\n\n` +
      `Grant permissions for these retailers?`;

    return confirm(message);
  }

  /**
   * Handle permission granted event
   */
  private async onPermissionGranted(retailerId: RetailerId): Promise<void> {
    try {
      // Update retailer settings to enable the retailer
      const settings = await chrome.storage.sync.get(['booster_settings']);
      const currentSettings = settings['booster_settings'] || {};
      
      if (!currentSettings.retailerSettings) {
        currentSettings.retailerSettings = {};
      }
      
      if (!currentSettings.retailerSettings[retailerId]) {
        currentSettings.retailerSettings[retailerId] = {
          enabled: true,
          autoLogin: false,
          autoFill: true
        };
      } else {
        currentSettings.retailerSettings[retailerId].enabled = true;
      }
      
      await chrome.storage.sync.set({ booster_settings: currentSettings });
      
      // Notify background script
      chrome.runtime.sendMessage({
        type: 'PERMISSION_GRANTED',
        payload: { retailerId }
      });
      
      log('info', `Permission granted and settings updated for ${retailerId}`);
    } catch (error) {
      log('error', `Failed to handle permission granted for ${retailerId}`, error);
    }
  }

  /**
   * Handle permission removed event
   */
  private async onPermissionRemoved(retailerId: RetailerId): Promise<void> {
    try {
      // Update retailer settings to disable the retailer
      const settings = await chrome.storage.sync.get(['booster_settings']);
      const currentSettings = settings['booster_settings'] || {};
      
      if (currentSettings.retailerSettings && currentSettings.retailerSettings[retailerId]) {
        currentSettings.retailerSettings[retailerId].enabled = false;
      }
      
      await chrome.storage.sync.set({ booster_settings: currentSettings });
      
      // Notify background script
      chrome.runtime.sendMessage({
        type: 'PERMISSION_REMOVED',
        payload: { retailerId }
      });
      
      log('info', `Permission removed and settings updated for ${retailerId}`);
    } catch (error) {
      log('error', `Failed to handle permission removed for ${retailerId}`, error);
    }
  }

  /**
   * Validate that all required permissions are present
   */
  async validateRequiredPermissions(): Promise<{
    valid: boolean;
    missing: string[];
    optional: string[];
  }> {
    const requiredPermissions = ['storage', 'activeTab', 'notifications', 'alarms'];
    const requiredOrigins = ['https://api.boosterbeacon.com/*'];
    
    const missing: string[] = [];
    const optional: string[] = [];
    
    // Check required permissions
    for (const permission of requiredPermissions) {
      const hasPermission = await chrome.permissions.contains({
        permissions: [permission]
      });
      
      if (!hasPermission) {
        missing.push(permission);
      }
    }
    
    // Check required origins
    for (const origin of requiredOrigins) {
      const hasPermission = await chrome.permissions.contains({
        origins: [origin]
      });
      
      if (!hasPermission) {
        missing.push(origin);
      }
    }
    
    // Check optional retailer permissions
    for (const retailerId of Object.keys(SUPPORTED_RETAILERS) as RetailerId[]) {
      const hasPermission = await this.hasRetailerPermission(retailerId);
      if (!hasPermission) {
        optional.push(retailerId);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing,
      optional
    };
  }
}