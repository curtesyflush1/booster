// Shared utility functions for the BoosterBeacon browser extension

import { SUPPORTED_RETAILERS, RetailerInfo, ExtensionMessage, MessageResponse } from './types';

/**
 * Get the current retailer based on the current URL
 */
export function getCurrentRetailer(url: string = window.location.href): RetailerInfo | null {
  const hostname = new URL(url).hostname.toLowerCase();
  
  for (const retailer of Object.values(SUPPORTED_RETAILERS)) {
    if (hostname.includes(retailer.domain)) {
      return retailer;
    }
  }
  
  return null;
}

/**
 * Check if the current page is a supported retailer
 */
export function isSupportedRetailer(url: string = window.location.href): boolean {
  return getCurrentRetailer(url) !== null;
}

/**
 * Send a message between extension components
 */
export function sendExtensionMessage(
  message: Omit<ExtensionMessage, 'timestamp'>
): Promise<MessageResponse> {
  return new Promise((resolve) => {
    const fullMessage: ExtensionMessage = {
      ...message,
      timestamp: Date.now()
    };
    
    chrome.runtime.sendMessage(fullMessage, (response: MessageResponse) => {
      if (chrome.runtime.lastError) {
        resolve({
          success: false,
          error: {
            code: 'RUNTIME_ERROR',
            message: chrome.runtime.lastError.message || 'Unknown error'
          }
        });
      } else {
        resolve(response || { success: true });
      }
    });
  });
}

/**
 * Get data from extension storage
 */
export function getStorageData<T>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        resolve(null);
      } else {
        resolve(result[key] || null);
      }
    });
  });
}

/**
 * Set data in extension storage
 */
export function setStorageData(key: string, value: any): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Remove data from extension storage
 */
export function removeStorageData(key: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.remove([key], () => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Clear all extension storage data
 */
export function clearStorageData(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Log messages with extension context
 */
export function log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const prefix = `[BoosterBeacon Extension ${timestamp}]`;
  
  switch (level) {
    case 'info':
      console.log(prefix, message, data || '');
      break;
    case 'warn':
      console.warn(prefix, message, data || '');
      break;
    case 'error':
      console.error(prefix, message, data || '');
      break;
  }
}

/**
 * Debounce function to limit rapid function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function to limit function calls to once per interval
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Generate a unique ID for tracking purposes
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Format currency values
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(timestamp: string | number): string {
  const now = Date.now();
  const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  const diff = now - time;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}