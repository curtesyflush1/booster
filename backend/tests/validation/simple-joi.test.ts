import { validateJoi } from '../../src/middleware/joiValidation';
import { authSchemas } from '../../src/validators/schemas';
import Joi from 'joi';

describe('Simple Joi Validation Test', () => {
  it('should validate a simple schema', () => {
    const schema = Joi.object({
      name: Joi.string().required(),
      age: Joi.number().integer().min(0).required()
    });

    const validData = { name: 'John', age: 25 };
    const { error } = schema.validate(validData);
    
    expect(error).toBeUndefined();
  });

  it('should reject invalid data', () => {
    const schema = Joi.object({
      name: Joi.string().required(),
      age: Joi.number().integer().min(0).required()
    });

    const invalidData = { name: '', age: -1 };
    const { error } = schema.validate(invalidData, { abortEarly: false });
    
    expect(error).toBeDefined();
    expect(error?.details).toHaveLength(2);
  });

  it('should validate auth login schema', () => {
    const validData = {
      email: 'test@example.com',
      password: 'password123'
    };

    const { error } = authSchemas.login.validate(validData);
    expect(error).toBeUndefined();
  });

  it('should reject invalid auth data', () => {
    const invalidData = {
      email: 'invalid-email',
      password: '123' // too short
    };

    const { error } = authSchemas.login.validate(invalidData);
    expect(error).toBeDefined();
    expect(error?.details.length).toBeGreaterThan(0);
  });
});