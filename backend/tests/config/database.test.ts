import { handleDatabaseError } from '../../src/config/database';

describe('Database Configuration', () => {
  describe('handleDatabaseError', () => {
    it('should handle unique violation errors', () => {
      const error = {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
        constraint: 'users_email_unique'
      };

      const handled = handleDatabaseError(error);
      
      expect(handled.code).toBe('DUPLICATE_ENTRY');
      expect(handled.message).toBe('A record with this value already exists');
      expect(handled.constraint).toBe('users_email_unique');
    });

    it('should handle foreign key violation errors', () => {
      const error = {
        code: '23503',
        message: 'insert or update on table violates foreign key constraint',
        constraint: 'watches_user_id_foreign'
      };

      const handled = handleDatabaseError(error);
      
      expect(handled.code).toBe('FOREIGN_KEY_VIOLATION');
      expect(handled.message).toBe('Referenced record does not exist');
      expect(handled.constraint).toBe('watches_user_id_foreign');
    });

    it('should handle not null violation errors', () => {
      const error = {
        code: '23502',
        message: 'null value in column violates not-null constraint',
        column: 'email'
      };

      const handled = handleDatabaseError(error);
      
      expect(handled.code).toBe('REQUIRED_FIELD_MISSING');
      expect(handled.message).toBe('Required field is missing');
      expect(handled.column).toBe('email');
    });

    it('should handle connection errors', () => {
      const error = {
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 127.0.0.1:5432'
      };

      const handled = handleDatabaseError(error);
      
      expect(handled.code).toBe('CONNECTION_REFUSED');
      expect(handled.message).toBe('Unable to connect to database');
    });

    it('should handle unknown errors', () => {
      const error = {
        code: 'UNKNOWN_CODE',
        message: 'Some unknown error'
      };

      const handled = handleDatabaseError(error);
      
      expect(handled.code).toBe('UNKNOWN_CODE');
      expect(handled.message).toBe('Some unknown error');
    });

    it('should handle errors without code', () => {
      const error = {
        message: 'Error without code'
      };

      const handled = handleDatabaseError(error);
      
      expect(handled.code).toBe('UNKNOWN_ERROR');
      expect(handled.message).toBe('Error without code');
    });
  });
});