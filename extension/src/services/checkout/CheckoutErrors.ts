// Specific error types for better error handling
export class CheckoutError extends Error {
  constructor(
    message: string,
    public readonly step: string,
    public readonly retailerId: string,
    public readonly recoverable: boolean = false
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}

export class ElementNotFoundError extends CheckoutError {
  constructor(selector: string, step: string, retailerId: string) {
    super(`Element not found: ${selector}`, step, retailerId, true);
    this.name = 'ElementNotFoundError';
  }
}

export class ConfigurationError extends CheckoutError {
  constructor(message: string, retailerId: string) {
    super(message, 'configuration', retailerId, false);
    this.name = 'ConfigurationError';
  }
}

export class SafetyLimitError extends CheckoutError {
  constructor(message: string, retailerId: string) {
    super(message, 'safety_check', retailerId, false);
    this.name = 'SafetyLimitError';
  }
}