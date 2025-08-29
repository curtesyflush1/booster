// Dedicated message handling service
import { ExtensionMessage, MessageResponse, MessageType } from '../../shared/types';
import { performanceMonitor } from '../../shared/performanceMonitor';
import { log } from '../../shared/utils';

export class MessageHandler {
  private handlers = new Map<MessageType, (payload: any, sender?: chrome.runtime.MessageSender) => Promise<MessageResponse>>();

  constructor(
    private cacheManager: CacheManager,
    private credentialService: any,
    private notificationService: any
  ) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.handlers.set(MessageType.GET_USER_STATUS, this.handleGetUserStatus.bind(this));
    this.handlers.set(MessageType.UPDATE_SETTINGS, this.handleUpdateSettings.bind(this));
    this.handlers.set(MessageType.ADD_TO_CART, this.handleAddToCart.bind(this));
    // ... register other handlers
  }

  public async processMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    // Validate message format
    if (!this.isValidMessage(message)) {
      return {
        success: false,
        error: { code: 'INVALID_MESSAGE', message: 'Invalid message format' }
      };
    }

    const handler = this.handlers.get(message.type);
    if (!handler) {
      return {
        success: false,
        error: { code: 'UNKNOWN_MESSAGE_TYPE', message: 'Unknown message type' }
      };
    }

    return performanceMonitor.timeFunction(
      'message_processing',
      () => handler(message.payload, sender),
      { messageType: message.type }
    );
  }

  private isValidMessage(message: ExtensionMessage): boolean {
    return !!(message && message.type && message.timestamp);
  }

  private async handleGetUserStatus(): Promise<MessageResponse> {
    try {
      const user = await this.cacheManager.getCachedUser();
      const authToken = await this.cacheManager.getAuthToken();
      
      return {
        success: true,
        data: {
          user,
          isAuthenticated: !!(user && authToken)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: { code: 'USER_STATUS_ERROR', message: 'Failed to get user status' }
      };
    }
  }

  private async handleUpdateSettings(payload: any): Promise<MessageResponse> {
    try {
      const updatedSettings = await this.cacheManager.updateSettings(payload);
      return { success: true, data: updatedSettings };
    } catch (error) {
      return {
        success: false,
        error: { code: 'SETTINGS_UPDATE_ERROR', message: 'Failed to update settings' }
      };
    }
  }

  private async handleAddToCart(payload: any, sender?: chrome.runtime.MessageSender): Promise<MessageResponse> {
    try {
      log('info', 'Add to cart requested', payload);
      
      if (sender?.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: MessageType.EXECUTE_ADD_TO_CART,
          payload,
          timestamp: Date.now()
        });
      }
      
      return { success: true, data: { message: 'Add to cart initiated' } };
    } catch (error) {
      return {
        success: false,
        error: { code: 'ADD_TO_CART_ERROR', message: 'Failed to add to cart' }
      };
    }
  }
}