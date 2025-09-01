import { redisService } from './redisService';
import { logger } from '../utils/logger';

export interface EventBusOptions {
  stream?: string;
}

export class EventBusService {
  private defaultStream: string;

  constructor(streamName?: string) {
    this.defaultStream = streamName || process.env.EVENT_STREAM_NAME || 'bb:events';
  }

  /**
   * Emit an event to the Redis Stream. Payload will be JSON-stringified.
   */
  async emit(eventType: string, payload: Record<string, any>, options: EventBusOptions = {}): Promise<string | null> {
    const stream = options.stream || this.defaultStream;
    try {
      const client = redisService.getClient() as any;
      const message = {
        type: eventType,
        ts: Date.now().toString(),
        payload: JSON.stringify(payload)
      } as any;
      // XADD stream * field value ...
      const id = await client.xAdd(stream, '*', message);
      logger.debug('Event emitted', { stream, eventType, id });
      return id as string;
    } catch (error) {
      logger.error('Failed to emit event', {
        eventType,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
}

export const eventBusService = new EventBusService();

