// Push Notification Service for BoosterBeacon Frontend
import { apiClient } from './apiClient';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPermissionState {
  permission: NotificationPermission;
  isSupported: boolean;
  isServiceWorkerSupported: boolean;
  canRequestPermission: boolean;
}

export interface PushNotificationStats {
  subscriptionCount: number;
  notificationsSent: number;
  lastNotificationSent?: Date;
}

class PushNotificationService {
  private vapidPublicKey: string | null = null;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private pushSubscription: PushSubscription | null = null;

  /**
   * Initialize the push notification service
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing push notification service...');

      // Check if service workers are supported
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service workers are not supported');
      }

      // Check if push notifications are supported
      if (!('PushManager' in window)) {
        throw new Error('Push notifications are not supported');
      }

      // Register service worker
      await this.registerServiceWorker();

      // Get VAPID public key from server
      await this.fetchVapidPublicKey();

      console.log('Push notification service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize push notification service:', error);
      throw error;
    }
  }

  /**
   * Register the service worker
   */
  private async registerServiceWorker(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service worker registered:', registration);

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      this.serviceWorkerRegistration = registration;

      // Listen for service worker updates
      registration.addEventListener('updatefound', () => {
        console.log('Service worker update found');
        const newWorker = registration.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New service worker installed, prompting for update');
              this.notifyServiceWorkerUpdate();
            }
          });
        }
      });

    } catch (error) {
      console.error('Service worker registration failed:', error);
      throw error;
    }
  }

  /**
   * Fetch VAPID public key from server
   */
  private async fetchVapidPublicKey(): Promise<void> {
    try {
      const response = await apiClient.get('/notifications/vapid-public-key');
      this.vapidPublicKey = response.data.publicKey;
      console.log('VAPID public key fetched successfully');
    } catch (error) {
      console.error('Failed to fetch VAPID public key:', error);
      throw error;
    }
  }

  /**
   * Get current notification permission state
   */
  getPermissionState(): NotificationPermissionState {
    const isSupported = 'Notification' in window;
    const isServiceWorkerSupported = 'serviceWorker' in navigator;
    const permission = isSupported ? Notification.permission : 'denied';
    
    return {
      permission,
      isSupported,
      isServiceWorkerSupported,
      canRequestPermission: isSupported && permission === 'default'
    };
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<NotificationPermission> {
    try {
      if (!('Notification' in window)) {
        throw new Error('Notifications are not supported');
      }

      if (Notification.permission === 'granted') {
        return 'granted';
      }

      if (Notification.permission === 'denied') {
        throw new Error('Notification permission was denied');
      }

      // Request permission
      const permission = await Notification.requestPermission();
      console.log('Notification permission result:', permission);

      return permission;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      throw error;
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<void> {
    try {
      console.log('Subscribing to push notifications...');

      // Ensure service worker is registered
      if (!this.serviceWorkerRegistration) {
        await this.registerServiceWorker();
      }

      // Ensure we have VAPID public key
      if (!this.vapidPublicKey) {
        await this.fetchVapidPublicKey();
      }

      // Request notification permission
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission not granted');
      }

      // Check for existing subscription
      const existingSubscription = await this.serviceWorkerRegistration!.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('Existing push subscription found');
        this.pushSubscription = existingSubscription;
        await this.sendSubscriptionToServer(existingSubscription);
        return;
      }

      // Create new subscription
      const subscription = await this.serviceWorkerRegistration!.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey!)
      });

      console.log('New push subscription created:', subscription);
      this.pushSubscription = subscription;

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);

      console.log('Successfully subscribed to push notifications');
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<void> {
    try {
      console.log('Unsubscribing from push notifications...');

      if (!this.pushSubscription) {
        // Try to get existing subscription
        if (this.serviceWorkerRegistration) {
          this.pushSubscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
        }
      }

      if (!this.pushSubscription) {
        console.log('No push subscription found');
        return;
      }

      // Unsubscribe from push manager
      const success = await this.pushSubscription.unsubscribe();
      if (!success) {
        throw new Error('Failed to unsubscribe from push manager');
      }

      // Remove subscription from server
      await this.removeSubscriptionFromServer(this.pushSubscription.endpoint);

      this.pushSubscription = null;
      console.log('Successfully unsubscribed from push notifications');
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  }

  /**
   * Check if user is currently subscribed
   */
  async isSubscribed(): Promise<boolean> {
    try {
      if (!this.serviceWorkerRegistration) {
        return false;
      }

      const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
      this.pushSubscription = subscription;
      return subscription !== null;
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      return false;
    }
  }

  /**
   * Get current push subscription
   */
  async getSubscription(): Promise<PushSubscription | null> {
    try {
      if (!this.serviceWorkerRegistration) {
        return null;
      }

      const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
      this.pushSubscription = subscription;
      return subscription;
    } catch (error) {
      console.error('Failed to get push subscription:', error);
      return null;
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(): Promise<void> {
    try {
      console.log('Sending test notification...');
      await apiClient.post('/notifications/test');
      console.log('Test notification sent successfully');
    } catch (error) {
      console.error('Failed to send test notification:', error);
      throw error;
    }
  }

  /**
   * Get push notification statistics
   */
  async getStats(): Promise<PushNotificationStats> {
    try {
      const response = await apiClient.get('/notifications/stats');
      return response.data.stats;
    } catch (error) {
      console.error('Failed to get push notification stats:', error);
      throw error;
    }
  }

  /**
   * Send subscription to server
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
        }
      };

      await apiClient.post('/notifications/subscribe', subscriptionData);
      console.log('Subscription sent to server successfully');
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
      throw error;
    }
  }

  /**
   * Remove subscription from server
   */
  private async removeSubscriptionFromServer(endpoint: string): Promise<void> {
    try {
      await apiClient.post('/notifications/unsubscribe', { endpoint });
      console.log('Subscription removed from server successfully');
    } catch (error) {
      console.error('Failed to remove subscription from server:', error);
      throw error;
    }
  }

  /**
   * Convert VAPID key from URL-safe base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Notify about service worker update
   */
  private notifyServiceWorkerUpdate(): void {
    // This could trigger a UI notification to the user
    console.log('Service worker update available');
    
    // Dispatch custom event for UI to handle
    window.dispatchEvent(new CustomEvent('sw-update-available'));
  }

  /**
   * Update service worker
   */
  async updateServiceWorker(): Promise<void> {
    try {
      if (!this.serviceWorkerRegistration) {
        throw new Error('No service worker registration found');
      }

      await this.serviceWorkerRegistration.update();
      
      // Send message to service worker to skip waiting
      if (this.serviceWorkerRegistration.waiting) {
        this.serviceWorkerRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // Reload page after update
      window.location.reload();
    } catch (error) {
      console.error('Failed to update service worker:', error);
      throw error;
    }
  }

  /**
   * Show local notification (for testing)
   */
  async showLocalNotification(title: string, options: NotificationOptions = {}): Promise<void> {
    try {
      if (Notification.permission !== 'granted') {
        throw new Error('Notification permission not granted');
      }

      const notification = new Notification(title, {
        icon: '/icons/notification-icon-192.png',
        badge: '/icons/badge-72.png',
        ...options
      });

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

    } catch (error) {
      console.error('Failed to show local notification:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;