export const AlertProcessingService = {
  generateAlert: jest.fn().mockResolvedValue({
    status: 'processed',
    alertId: 'mock-alert-id',
    deliveryChannels: ['web_push', 'email']
  }),
  processAlert: jest.fn().mockResolvedValue({
    success: true,
    deliveryChannels: ['web_push']
  }),
  processPendingAlerts: jest.fn().mockResolvedValue({
    processed: 0,
    failed: 0,
    scheduled: 0
  }),
  retryFailedAlerts: jest.fn().mockResolvedValue({
    retried: 0,
    succeeded: 0,
    permanentlyFailed: 0
  }),
  getProcessingStats: jest.fn().mockResolvedValue({
    pendingAlerts: 0,
    failedAlerts: 0,
    alertsProcessedToday: 0,
    successRate: 100
  })
};

export interface AlertGenerationData {
  userId: string;
  productId: string;
  retailerId: string;
  watchId?: string;
  type: string;
  data: any;
}
