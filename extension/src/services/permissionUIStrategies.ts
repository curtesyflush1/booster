// Strategy pattern for different permission UI contexts
import { RetailerId, SUPPORTED_RETAILERS } from '../shared/types';
import { PERMISSION_FEATURES, PermissionFeature } from './permissionConstants';

export interface PermissionUIStrategy {
  showExplanation(retailerId: RetailerId, context: PermissionContext): Promise<boolean>;
  showMultipleExplanation(retailerIds: RetailerId[], context: PermissionContext): Promise<boolean>;
}

export interface PermissionContext {
  reason: string;
  features: PermissionFeature[];
  urgency: 'low' | 'medium' | 'high';
  source: 'user_action' | 'auto_detection' | 'settings_page';
}

// Strategy for first-time setup
export class FirstTimeSetupUIStrategy implements PermissionUIStrategy {
  async showExplanation(retailerId: RetailerId, context: PermissionContext): Promise<boolean> {
    const retailer = SUPPORTED_RETAILERS[retailerId];
    const features = context.features.map(f => `• ${PERMISSION_FEATURES[f]}`).join('\n');
    
    const message = `Welcome to BoosterBeacon! 🚀\n\n` +
      `To get started with ${retailer.name}, we need permission to:\n\n` +
      `${features}\n\n` +
      `This enables our core functionality: ${context.reason}\n\n` +
      `Grant permission to continue setup?`;

    return confirm(message);
  }

  async showMultipleExplanation(retailerIds: RetailerId[], context: PermissionContext): Promise<boolean> {
    const retailerNames = retailerIds.map(id => SUPPORTED_RETAILERS[id].name).join(', ');
    const features = context.features.map(f => `• ${PERMISSION_FEATURES[f]}`).join('\n');
    
    const message = `Welcome to BoosterBeacon! 🚀\n\n` +
      `To monitor products across ${retailerNames}, we need permissions for:\n\n` +
      `${features}\n\n` +
      `This enables: ${context.reason}\n\n` +
      `Grant permissions to get started?`;

    return confirm(message);
  }
}

// Strategy for runtime permission requests
export class RuntimePermissionUIStrategy implements PermissionUIStrategy {
  async showExplanation(retailerId: RetailerId, context: PermissionContext): Promise<boolean> {
    const retailer = SUPPORTED_RETAILERS[retailerId];
    const urgencyText = this.getUrgencyText(context.urgency);
    
    const message = `${urgencyText}\n\n` +
      `BoosterBeacon detected you're on ${retailer.name} but needs permission to:\n\n` +
      `• Help you with this page\n` +
      `• Monitor products you're interested in\n` +
      `• Provide checkout assistance\n\n` +
      `Reason: ${context.reason}\n\n` +
      `Grant permission now?`;

    return confirm(message);
  }

  async showMultipleExplanation(retailerIds: RetailerId[], context: PermissionContext): Promise<boolean> {
    const retailerNames = retailerIds.map(id => SUPPORTED_RETAILERS[id].name).join(', ');
    
    const message = `BoosterBeacon can help you across multiple retailers!\n\n` +
      `Grant permissions for: ${retailerNames}\n\n` +
      `This enables:\n` +
      `• Cross-retailer price comparison\n` +
      `• Unified product monitoring\n` +
      `• Seamless checkout assistance\n\n` +
      `Continue with permissions?`;

    return confirm(message);
  }

  private getUrgencyText(urgency: 'low' | 'medium' | 'high'): string {
    switch (urgency) {
      case 'high': return '⚡ Quick Action Needed!';
      case 'medium': return '🔔 Permission Required';
      case 'low': return 'ℹ️ Optional Enhancement';
    }
  }
}

// Strategy for settings page
export class SettingsPageUIStrategy implements PermissionUIStrategy {
  async showExplanation(retailerId: RetailerId, context: PermissionContext): Promise<boolean> {
    const retailer = SUPPORTED_RETAILERS[retailerId];
    
    const message = `Enable ${retailer.name} Integration\n\n` +
      `This permission allows BoosterBeacon to:\n` +
      `• Monitor product availability\n` +
      `• Provide checkout assistance\n` +
      `• Track price changes\n\n` +
      `You can revoke this permission anytime in settings.\n\n` +
      `Enable ${retailer.name} integration?`;

    return confirm(message);
  }

  async showMultipleExplanation(retailerIds: RetailerId[], context: PermissionContext): Promise<boolean> {
    const retailerNames = retailerIds.map(id => SUPPORTED_RETAILERS[id].name).join(', ');
    
    const message = `Enable Multiple Retailer Integrations\n\n` +
      `Retailers: ${retailerNames}\n\n` +
      `This will enable comprehensive monitoring and assistance across all selected retailers.\n\n` +
      `You can manage individual permissions later in settings.\n\n` +
      `Enable all selected integrations?`;

    return confirm(message);
  }
}

// Factory for creating appropriate strategy
export class PermissionUIStrategyFactory {
  static create(source: PermissionContext['source']): PermissionUIStrategy {
    switch (source) {
      case 'user_action':
        return new RuntimePermissionUIStrategy();
      case 'auto_detection':
        return new RuntimePermissionUIStrategy();
      case 'settings_page':
        return new SettingsPageUIStrategy();
      default:
        return new FirstTimeSetupUIStrategy();
    }
  }
}