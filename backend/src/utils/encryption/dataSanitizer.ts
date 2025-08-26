type SanitizableValue = string | number | boolean | null | undefined | object;

export class DataSanitizer {
  private static readonly SENSITIVE_FIELDS = new Set([
    'password',
    'password_hash',
    'token',
    'api_key',
    'secret',
    'private_key',
    'auth_token',
    'access_token',
    'refresh_token',
    'session_id',
    'csrf_token',
    'jwt',
    'bearer',
    'authorization',
    'credit_card',
    'ssn',
    'social_security'
  ]);

  private static readonly REDACTED_VALUE = '[REDACTED]';

  static sanitizeForLogging(data: SanitizableValue): SanitizableValue {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeForLogging(item));
    }

    const sanitized: Record<string, SanitizableValue> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (this.isSensitiveField(key)) {
        sanitized[key] = this.REDACTED_VALUE;
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeForLogging(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private static isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    
    // Check exact matches
    if (this.SENSITIVE_FIELDS.has(lowerFieldName)) {
      return true;
    }

    // Check if field contains sensitive keywords
    for (const sensitiveField of this.SENSITIVE_FIELDS) {
      if (lowerFieldName.includes(sensitiveField)) {
        return true;
      }
    }

    return false;
  }

  static addSensitiveField(fieldName: string): void {
    this.SENSITIVE_FIELDS.add(fieldName.toLowerCase());
  }

  static removeSensitiveField(fieldName: string): void {
    this.SENSITIVE_FIELDS.delete(fieldName.toLowerCase());
  }

  static getSensitiveFields(): string[] {
    return Array.from(this.SENSITIVE_FIELDS);
  }
}