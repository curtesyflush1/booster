import { apiClient } from './apiClient';
import { Alert, PaginatedResponse } from '../types';

export interface AlertFilters {
  page?: number;
  limit?: number;
  status?: 'pending' | 'sent' | 'failed' | 'read';
  type?: 'restock' | 'price_drop' | 'low_stock' | 'pre_order';
  unread_only?: boolean;
  search?: string;
  start_date?: string;
  end_date?: string;
}

export interface AlertStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  clickThroughRate: number;
  recentAlerts: number;
}

export interface AlertAnalytics {
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  summary: {
    totalAlerts: number;
    sentAlerts: number;
    clickedAlerts: number;
    readAlerts: number;
    clickThroughRate: number;
    readRate: number;
  };
  dailyBreakdown: Array<{
    date: string;
    total: number;
    sent: number;
    clicked: number;
    read: number;
  }>;
}

class AlertService {
  // Get user's alerts with filtering and pagination
  async getAlerts(filters: AlertFilters = {}): Promise<PaginatedResponse<Alert>> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });

    const response = await apiClient.get<PaginatedResponse<Alert>>(`/alerts?${params.toString()}`);

    return {
      data: response.data.data,
      pagination: response.data.pagination
    };
  }

  // Get specific alert by ID
  async getAlert(alertId: string): Promise<Alert> {
    const response = await apiClient.get<{ alert: Alert }>(`/alerts/${alertId}`);
    return response.data.alert;
  }

  // Mark alert as read
  async markAsRead(alertId: string): Promise<void> {
    await apiClient.patch(`/alerts/${alertId}/read`);
  }

  // Mark alert as clicked
  async markAsClicked(alertId: string): Promise<void> {
    await apiClient.patch(`/alerts/${alertId}/clicked`);
  }

  // Bulk mark alerts as read
  async bulkMarkAsRead(alertIds: string[]): Promise<{ updatedCount: number }> {
    const response = await apiClient.patch<{ updatedCount: number }>('/alerts/bulk/read', {
      alertIds
    });
    return response.data;
  }

  // Delete alert
  async deleteAlert(alertId: string): Promise<void> {
    await apiClient.delete(`/alerts/${alertId}`);
  }

  // Get alert statistics
  async getAlertStats(): Promise<AlertStats> {
    const response = await apiClient.get<{ data: { stats: AlertStats } }>('/alerts/stats/summary');
    // API responses are wrapped as { data: { ... } }
    return (response.data as any)?.data?.stats as AlertStats;
  }

  // Get alert analytics
  async getAlertAnalytics(days: number = 30): Promise<AlertAnalytics> {
    const response = await apiClient.get<{ data: { analytics: AlertAnalytics } }>(
      `/alerts/analytics/engagement?days=${days}`
    );
    return (response.data as any)?.data?.analytics as AlertAnalytics;
  }

  // Helper method to format alert data for display
  formatAlertData(alert: Alert): {
    title: string;
    subtitle: string;
    price: string;
    priceChange?: string;
    urgency: 'low' | 'medium' | 'high' | 'urgent';
    isRead: boolean;
    timeAgo: string;
  } {
    const title = alert.data.productName;
    const subtitle = `Available at ${alert.data.retailerName}`;
    const price = alert.data.price ? `$${alert.data.price.toFixed(2)}` : 'Price not available';
    
    let priceChange: string | undefined;
    if (alert.data.priceChange) {
      const change = alert.data.priceChange.percentChange;
      const sign = change > 0 ? '+' : '';
      priceChange = `${sign}${change.toFixed(1)}%`;
    }

    const timeAgo = this.getTimeAgo(new Date(alert.createdAt));

    return {
      title,
      subtitle,
      price,
      priceChange,
      urgency: alert.priority,
      isRead: alert.isRead,
      timeAgo
    };
  }

  // Helper method to get human-readable time ago
  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks}w ago`;
    }

    return date.toLocaleDateString();
  }

  // Get alert type display information
  getAlertTypeInfo(type: Alert['type']): {
    label: string;
    icon: string;
    color: string;
  } {
    const typeMap: Record<Alert['type'], { label: string; icon: string; color: string }> = {
      restock: {
        label: 'Restock',
        icon: '📦',
        color: 'text-green-400'
      },
      price_drop: {
        label: 'Price Drop',
        icon: '💰',
        color: 'text-blue-400'
      },
      low_stock: {
        label: 'Low Stock',
        icon: '⚠️',
        color: 'text-yellow-400'
      },
      pre_order: {
        label: 'Pre-order',
        icon: '🎯',
        color: 'text-purple-400'
      },
      back_in_stock: {
        label: 'Back in Stock',
        icon: '📦',
        color: 'text-green-400'
      }
    };

    return typeMap[type] || {
      label: 'Alert',
      icon: '🔔',
      color: 'text-gray-400'
    };
  }

  // Get priority display information
  getPriorityInfo(priority: Alert['priority']): {
    label: string;
    color: string;
    bgColor: string;
  } {
    const priorityMap = {
      low: {
        label: 'Low',
        color: 'text-gray-400',
        bgColor: 'bg-gray-100'
      },
      medium: {
        label: 'Medium',
        color: 'text-blue-400',
        bgColor: 'bg-blue-100'
      },
      high: {
        label: 'High',
        color: 'text-orange-400',
        bgColor: 'bg-orange-100'
      },
      urgent: {
        label: 'Urgent',
        color: 'text-red-400',
        bgColor: 'bg-red-100'
      }
    };

    return priorityMap[priority] || priorityMap.medium;
  }
}

export const alertService = new AlertService();
