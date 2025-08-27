import { PerformanceTracker as IPerformanceTracker, EncryptionMetrics, EncryptionOperation } from './types';

// Configuration interface for PerformanceTracker
interface PerformanceTrackerConfig {
    maxOperations?: number; // Maximum number of different operations to track
    enableWarnings?: boolean; // Enable performance warnings
    slowOperationThreshold?: number; // Threshold in ms for slow operation warnings
    retentionPeriod?: number; // How long to keep metrics in ms
    enableDetailedMetrics?: boolean; // Track min/max/percentiles
}

// Validation for configuration with more comprehensive checks
const validateConfig = (config: PerformanceTrackerConfig): void => {
    if (config.maxOperations !== undefined) {
        if (!Number.isInteger(config.maxOperations) || config.maxOperations <= 0) {
            throw new Error('maxOperations must be a positive integer');
        }
        if (config.maxOperations > 100000) {
            throw new Error('maxOperations cannot exceed 100,000 to prevent memory issues');
        }
    }
    
    if (config.slowOperationThreshold !== undefined) {
        if (typeof config.slowOperationThreshold !== 'number' || config.slowOperationThreshold < 0) {
            throw new Error('slowOperationThreshold must be a non-negative number');
        }
        if (config.slowOperationThreshold > 60000) {
            throw new Error('slowOperationThreshold cannot exceed 60 seconds');
        }
    }
    
    if (config.retentionPeriod !== undefined) {
        if (!Number.isInteger(config.retentionPeriod) || config.retentionPeriod <= 0) {
            throw new Error('retentionPeriod must be a positive integer (milliseconds)');
        }
        if (config.retentionPeriod > 7 * 24 * 60 * 60 * 1000) { // 7 days
            throw new Error('retentionPeriod cannot exceed 7 days to prevent memory issues');
        }
    }
};

// Enhanced metrics interface
interface OperationMetrics {
    count: number;
    totalTime: number;
    averageTime: number;
    errors: number;
    minTime: number;
    maxTime: number;
    lastExecutionTime: number;
}

// Generic performance tracker for any operations
export class PerformanceTracker {
    private metrics: Record<string, OperationMetrics> = {};
    private config: Required<PerformanceTrackerConfig>;

    constructor(config: PerformanceTrackerConfig = {}) {
        validateConfig(config);
        this.config = {
            maxOperations: config.maxOperations ?? 1000,
            enableWarnings: config.enableWarnings ?? false,
            slowOperationThreshold: config.slowOperationThreshold ?? 1000,
            retentionPeriod: config.retentionPeriod ?? 24 * 60 * 60 * 1000, // 24 hours
            enableDetailedMetrics: config.enableDetailedMetrics ?? true
        };
    }

    async trackOperation<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
        // Validate operation name
        if (!operationName || typeof operationName !== 'string') {
            throw new Error('Operation name must be a non-empty string');
        }
        
        if (operationName.length > 100) {
            throw new Error('Operation name cannot exceed 100 characters');
        }
        
        // Prevent memory leaks by limiting tracked operations
        if (!this.metrics[operationName] && Object.keys(this.metrics).length >= this.config.maxOperations) {
            if (this.config.enableWarnings) {
                console.warn(`PerformanceTracker: Maximum operations limit (${this.config.maxOperations}) reached. Ignoring new operation: ${operationName}`);
            }
            return operation(); // Execute without tracking
        }

        const startTime = performance.now();
        
        if (!this.metrics[operationName]) {
            this.metrics[operationName] = {
                count: 0,
                totalTime: 0,
                averageTime: 0,
                errors: 0,
                minTime: Infinity,
                maxTime: 0,
                lastExecutionTime: 0
            };
        }

        try {
            const result = await operation();
            const duration = performance.now() - startTime;
            
            this.updateMetrics(operationName, duration, false);
            
            // Warn about slow operations
            if (this.config.enableWarnings && duration > this.config.slowOperationThreshold) {
                console.warn(`PerformanceTracker: Slow operation detected - ${operationName}: ${duration.toFixed(2)}ms`);
            }
            
            return result;
        } catch (error) {
            const duration = performance.now() - startTime;
            this.updateMetrics(operationName, duration, true);
            throw error;
        }
    }

    private updateMetrics(operationName: string, duration: number, isError: boolean): void {
        const metric = this.metrics[operationName];
        if (!metric) {
            throw new Error(`Metric not found for operation: ${operationName}`);
        }
        
        metric.count++;
        metric.totalTime += duration;
        metric.averageTime = metric.totalTime / metric.count;
        metric.lastExecutionTime = duration;
        
        if (duration < metric.minTime) {
            metric.minTime = duration;
        }
        
        if (duration > metric.maxTime) {
            metric.maxTime = duration;
        }
        
        if (isError) {
            metric.errors++;
        }
    }

    getMetrics() {
        return { ...this.metrics };
    }

    getMetricsForOperation(operationName: string): OperationMetrics | undefined {
        return this.metrics[operationName] ? { ...this.metrics[operationName] } : undefined;
    }

    getSummary() {
        const operations = Object.keys(this.metrics);
        const totalOperations = operations.reduce((sum, op) => {
            const metric = this.metrics[op];
            return sum + (metric?.count ?? 0);
        }, 0);
        const totalErrors = operations.reduce((sum, op) => {
            const metric = this.metrics[op];
            return sum + (metric?.errors ?? 0);
        }, 0);
        const totalTime = operations.reduce((sum, op) => {
            const metric = this.metrics[op];
            return sum + (metric?.totalTime ?? 0);
        }, 0);
        
        return {
            totalOperations,
            totalErrors,
            totalTime,
            averageTime: totalOperations > 0 ? totalTime / totalOperations : 0,
            errorRate: totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0,
            uniqueOperations: operations.length
        };
    }

    reset(): void {
        this.metrics = {};
    }

    resetOperation(operationName: string): boolean {
        if (this.metrics[operationName]) {
            delete this.metrics[operationName];
            return true;
        }
        return false;
    }
}

export class EncryptionPerformanceTracker implements IPerformanceTracker {
    private startTime: number = 0;
    private metrics: EncryptionMetrics = {
        encryptionTime: 0,
        decryptionTime: 0,
        keyDerivationTime: 0,
        hashTime: 0,
        verifyTime: 0,
        operationCount: 0,
        lastOperation: new Date(),
        averageEncryptionTime: 0,
        averageDecryptionTime: 0,
        averageHashTime: 0,
        averageVerifyTime: 0,
        slowestOperation: null,
        fastestOperation: null
    };
    private encryptionTimes: number[] = [];
    private decryptionTimes: number[] = [];
    private hashTimes: number[] = [];
    private verifyTimes: number[] = [];

    startTimer(): void {
        this.startTime = performance.now();
    }

    endTimer(operation: EncryptionOperation): number {
        if (this.startTime === 0) {
            throw new Error('Timer not started. Call startTimer() first.');
        }
        
        const duration = performance.now() - this.startTime;
        this.updateMetrics(operation, duration);
        this.startTime = 0; // Reset timer
        return duration;
    }

    private updateMetrics(operation: EncryptionOperation, duration: number): void {
        this.metrics.operationCount++;
        this.metrics.lastOperation = new Date();

        // Update slowest/fastest operation tracking
        this.updateExtremeOperations(operation, duration);

        switch (operation) {
            case 'encrypt':
                this.metrics.encryptionTime = duration;
                this.encryptionTimes.push(duration);
                this.metrics.averageEncryptionTime = this.calculateAverage(this.encryptionTimes);
                this.trimArray(this.encryptionTimes);
                break;
            case 'decrypt':
                this.metrics.decryptionTime = duration;
                this.decryptionTimes.push(duration);
                this.metrics.averageDecryptionTime = this.calculateAverage(this.decryptionTimes);
                this.trimArray(this.decryptionTimes);
                break;
            case 'keyDerivation':
                this.metrics.keyDerivationTime = duration;
                break;
            case 'hash':
                this.metrics.hashTime = duration;
                this.hashTimes.push(duration);
                this.metrics.averageHashTime = this.calculateAverage(this.hashTimes);
                this.trimArray(this.hashTimes);
                break;
            case 'verify':
                this.metrics.verifyTime = duration;
                this.verifyTimes.push(duration);
                this.metrics.averageVerifyTime = this.calculateAverage(this.verifyTimes);
                this.trimArray(this.verifyTimes);
                break;
        }
    }

    private updateExtremeOperations(operation: EncryptionOperation, duration: number): void {
        if (!this.metrics.slowestOperation || duration > this.metrics.slowestOperation.duration) {
            this.metrics.slowestOperation = { type: operation, duration };
        }
        
        if (!this.metrics.fastestOperation || duration < this.metrics.fastestOperation.duration) {
            this.metrics.fastestOperation = { type: operation, duration };
        }
    }

    private trimArray(array: number[]): void {
        // Keep only last 100 measurements for rolling average
        if (array.length > 100) {
            array.splice(0, array.length - 100);
        }
    }

    private calculateAverage(times: number[]): number {
        if (times.length === 0) return 0;
        return times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    getMetrics(): EncryptionMetrics {
        return { ...this.metrics };
    }

    reset(): void {
        this.startTime = 0;
        this.metrics = {
            encryptionTime: 0,
            decryptionTime: 0,
            keyDerivationTime: 0,
            hashTime: 0,
            verifyTime: 0,
            operationCount: 0,
            lastOperation: new Date(),
            averageEncryptionTime: 0,
            averageDecryptionTime: 0,
            averageHashTime: 0,
            averageVerifyTime: 0,
            slowestOperation: null,
            fastestOperation: null
        };
        this.encryptionTimes = [];
        this.decryptionTimes = [];
        this.hashTimes = [];
        this.verifyTimes = [];
    }
}