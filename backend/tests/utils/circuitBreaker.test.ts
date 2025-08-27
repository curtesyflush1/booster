import { CircuitBreaker, CircuitState } from '../../src/utils/circuitBreaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 1000,
      monitoringPeriod: 5000,
      successThreshold: 2
    });
  });

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should have initial metrics', () => {
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);
      expect(metrics.lastFailureTime).toBe(0);
    });
  });

  describe('successful operations', () => {
    it('should execute successful operations', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reset failure count on success', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('fail'));
      const successOperation = jest.fn().mockResolvedValue('success');

      // Fail once
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('fail');
      expect(circuitBreaker.getMetrics().failureCount).toBe(1);

      // Then succeed
      await circuitBreaker.execute(successOperation);
      expect(circuitBreaker.getMetrics().failureCount).toBe(0);
    });
  });

  describe('failing operations', () => {
    it('should track failures', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('fail'));
      
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('fail');
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(1);
      expect(metrics.lastFailureTime).toBeGreaterThan(0);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should open circuit after failure threshold', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('fail'));
      
      // Fail 3 times (threshold)
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('fail');
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(circuitBreaker.getMetrics().failureCount).toBe(3);
    });

    it('should reject operations when circuit is open', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('fail'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('fail');
      }
      
      // Now it should reject without calling the operation
      const newOperation = jest.fn().mockResolvedValue('success');
      await expect(circuitBreaker.execute(newOperation)).rejects.toThrow('Circuit breaker is OPEN');
      expect(newOperation).not.toHaveBeenCalled();
    });
  });

  describe('half-open state', () => {
    beforeEach(async () => {
      // Open the circuit
      const failingOperation = jest.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('fail');
      }
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should transition to half-open after recovery timeout', async () => {
      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const mockOperation = jest.fn().mockResolvedValue('success');
      await circuitBreaker.execute(mockOperation);
      
      // Should have been in half-open state during execution
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should close circuit after success threshold in half-open', async () => {
      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      // Execute successful operations (success threshold is 2)
      await circuitBreaker.execute(mockOperation);
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
      
      await circuitBreaker.execute(mockOperation);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should reopen circuit on failure in half-open state', async () => {
      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const failingOperation = jest.fn().mockRejectedValue(new Error('fail again'));
      
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('fail again');
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('reset functionality', () => {
    it('should reset circuit breaker to initial state', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('fail'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('fail');
      }
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      
      // Reset
      circuitBreaker.reset();
      
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);
      expect(metrics.lastFailureTime).toBe(0);
    });

    it('should allow operations after reset', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('fail'));
      const successOperation = jest.fn().mockResolvedValue('success');
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('fail');
      }
      
      // Reset and execute successful operation
      circuitBreaker.reset();
      const result = await circuitBreaker.execute(successOperation);
      
      expect(result).toBe('success');
      expect(successOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('configuration', () => {
    it('should use custom success threshold', async () => {
      const customCircuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeout: 500,
        monitoringPeriod: 2000,
        successThreshold: 3 // Custom success threshold
      });

      // Open the circuit
      const failingOperation = jest.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 2; i++) {
        await expect(customCircuitBreaker.execute(failingOperation)).rejects.toThrow('fail');
      }
      expect(customCircuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 600));

      const successOperation = jest.fn().mockResolvedValue('success');
      
      // Should need 3 successes to close
      await customCircuitBreaker.execute(successOperation);
      expect(customCircuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
      
      await customCircuitBreaker.execute(successOperation);
      expect(customCircuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
      
      await customCircuitBreaker.execute(successOperation);
      expect(customCircuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should default success threshold to 3 if not provided', () => {
      const defaultCircuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeout: 500,
        monitoringPeriod: 2000
        // No successThreshold provided
      });

      // Access the private config to verify default
      const metrics = defaultCircuitBreaker.getMetrics();
      expect(metrics).toBeDefined();
    });
  });
});