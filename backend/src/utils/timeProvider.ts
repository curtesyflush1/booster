/**
 * Time provider abstraction for better testability
 */
export interface ITimeProvider {
  now(): Date;
  getTime(): number;
}

export class SystemTimeProvider implements ITimeProvider {
  now(): Date {
    return new Date();
  }

  getTime(): number {
    return Date.now();
  }
}

export class MockTimeProvider implements ITimeProvider {
  constructor(private mockTime: Date) {}

  now(): Date {
    return new Date(this.mockTime);
  }

  getTime(): number {
    return this.mockTime.getTime();
  }

  setTime(time: Date): void {
    this.mockTime = time;
  }
}

// Default instance
export const timeProvider: ITimeProvider = new SystemTimeProvider();