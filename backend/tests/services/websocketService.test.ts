import { Server as HTTPServer } from 'http';
import { createServer } from 'http';

// Import using require to avoid TypeScript compilation issues
const { WebSocketService } = require('../../dist/services/websocketService');

describe('WebSocketService Import Test', () => {
  it('should be able to import the module', () => {
    expect(WebSocketService).toBeDefined();
  });

  it('should have WebSocketService as a class', () => {
    expect(typeof WebSocketService).toBe('function');
  });

  it('should be able to create an instance with mock HTTP server', () => {
    const mockServer = createServer();
    const wsService = new WebSocketService(mockServer);
    expect(wsService).toBeInstanceOf(WebSocketService);
    mockServer.close();
  });
});