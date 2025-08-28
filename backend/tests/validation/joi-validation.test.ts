import request from 'supertest';
import { validateJoi, validateJoiBody, validateJoiQuery, validateJoiParams } from '../../src/validators';
import { authSchemas, productSchemas, userSchemas, communitySchemas } from '../../src/validators/schemas';
import Joi from 'joi';

describe('Joi Validation Middleware', () => {
  describe('validateJoi function', () => {
    it('should validate request body successfully', async () => {
      const mockReq = {
        body: { email: 'test@example.com', password: 'password123' },
        query: {},
        params: {}
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      const mockNext = jest.fn();

      const middleware = validateJoi({ body: authSchemas.login });
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return validation error for invalid body', async () => {
      const mockReq = {
        body: { email: 'invalid-email', password: '' },
        query: {},
        params: {}
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      const mockNext = jest.fn();

      const middleware = validateJoi({ body: authSchemas.login });
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: expect.arrayContaining([
              expect.objectContaining({
                field: expect.stringContaining('body.'),
                message: expect.any(String)
              })
            ])
          })
        })
      );
    });

    it('should validate query parameters successfully', async () => {
      const mockReq = {
        body: {},
        query: { page: '1', limit: '20' },
        params: {}
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      const mockNext = jest.fn();

      const middleware = validateJoi({ query: productSchemas.search.query });
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return validation error for invalid query parameters', async () => {
      const mockReq = {
        body: {},
        query: { page: 'invalid', limit: '1000' },
        params: {}
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      const mockNext = jest.fn();

      const middleware = validateJoi({ query: productSchemas.search.query });
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should validate path parameters successfully', async () => {
      const mockReq = {
        body: {},
        query: {},
        params: { id: '123e4567-e89b-12d3-a456-426614174000' }
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      const mockNext = jest.fn();

      const middleware = validateJoi({ params: productSchemas.getById.params });
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return validation error for invalid path parameters', async () => {
      const mockReq = {
        body: {},
        query: {},
        params: { id: 'invalid-uuid' }
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      const mockNext = jest.fn();

      const middleware = validateJoi({ params: productSchemas.getById.params });
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should validate multiple schemas simultaneously', async () => {
      const mockReq = {
        body: { content: 'This is a test testimonial content that is long enough', rating: 5 },
        query: { page: '1' },
        params: { id: '123e4567-e89b-12d3-a456-426614174000' }
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      const mockNext = jest.fn();

      const middleware = validateJoi({
        body: communitySchemas.createTestimonial,
        query: Joi.object({ page: Joi.string().optional() }),
        params: Joi.object({ id: Joi.string().uuid().required() })
      });
      
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should strip unknown fields when stripUnknown is true', async () => {
      const mockReq = {
        body: { 
          email: 'test@example.com', 
          password: 'password123',
          unknownField: 'should be removed'
        },
        query: {},
        params: {}
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      const mockNext = jest.fn();

      const middleware = validateJoi({ body: authSchemas.login }, { stripUnknown: true });
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body).not.toHaveProperty('unknownField');
      expect(mockReq.body).toHaveProperty('email');
      expect(mockReq.body).toHaveProperty('password');
    });

    it('should handle validation middleware errors gracefully', async () => {
      const mockReq = {
        body: {},
        query: {},
        params: {}
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      const mockNext = jest.fn();

      // Create an invalid schema that will throw an error
      const invalidSchema = null as any;
      
      const middleware = validateJoi({ body: invalidSchema });
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_MIDDLEWARE_ERROR',
            message: 'Internal validation error'
          })
        })
      );
    });
  });

  describe('Convenience functions', () => {
    it('validateJoiBody should work correctly', async () => {
      const mockReq = {
        body: { email: 'test@example.com', password: 'password123' },
        query: {},
        params: {}
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      const mockNext = jest.fn();

      const middleware = validateJoiBody(authSchemas.login);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('validateJoiQuery should work correctly', async () => {
      const mockReq = {
        body: {},
        query: { page: '1', limit: '20' },
        params: {}
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      const mockNext = jest.fn();

      const middleware = validateJoiQuery(productSchemas.search.query);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('validateJoiParams should work correctly', async () => {
      const mockReq = {
        body: {},
        query: {},
        params: { id: '123e4567-e89b-12d3-a456-426614174000' }
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      const mockNext = jest.fn();

      const middleware = validateJoiParams(productSchemas.getById.params);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Schema validation', () => {
    it('should validate user profile update schema', async () => {
      const validData = {
        first_name: 'John',
        last_name: 'Doe',
        timezone: 'America/New_York',
        zip_code: '12345'
      };

      const { error } = userSchemas.updateProfile.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid user profile data', async () => {
      const invalidData = {
        first_name: '', // too short
        zip_code: 'invalid' // invalid format
      };

      const { error } = userSchemas.updateProfile.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details).toHaveLength(2);
    });

    it('should validate community testimonial schema', async () => {
      const validData = {
        content: 'This is a great testimonial with enough content to pass validation',
        rating: 5,
        isPublic: true,
        tags: ['helpful', 'great-service'],
        metadata: {
          productsSaved: 10,
          moneySaved: 150.50,
          timeUsing: '6 months',
          favoriteFeature: 'Real-time alerts'
        }
      };

      const { error } = communitySchemas.createTestimonial.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid testimonial data', async () => {
      const invalidData = {
        content: 'Too short', // less than 10 characters
        rating: 6, // out of range
        metadata: {
          productsSaved: -1 // negative number
        }
      };

      const { error } = communitySchemas.createTestimonial.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details.length).toBeGreaterThan(0);
    });

    it('should validate product search schema with all parameters', async () => {
      const validData = {
        q: 'pokemon cards',
        category_id: '123e4567-e89b-12d3-a456-426614174000',
        min_price: 10,
        max_price: 100,
        availability: 'in_stock',
        page: 1,
        limit: 20,
        sort_by: 'name',
        sort_order: 'asc'
      };

      const { error } = productSchemas.search.query.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should apply default values correctly', async () => {
      const inputData = {
        q: 'pokemon'
      };

      const { error, value } = productSchemas.search.query.validate(inputData);
      expect(error).toBeUndefined();
      expect(value.page).toBe(1);
      expect(value.limit).toBe(20);
      expect(value.sort_by).toBe('name');
      expect(value.sort_order).toBe('asc');
    });
  });

  describe('Error message formatting', () => {
    it('should provide clear error messages', async () => {
      const mockReq = {
        body: { 
          email: 'invalid-email',
          password: '123' // too short
        },
        query: {},
        params: {}
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      const mockNext = jest.fn();

      const middleware = validateJoi({ body: authSchemas.register });
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining([
              expect.objectContaining({
                field: 'body.email',
                message: expect.stringContaining('valid email')
              }),
              expect.objectContaining({
                field: 'body.password',
                message: expect.stringContaining('8 characters')
              })
            ])
          })
        })
      );
    });

    it('should include correlation ID in error responses', async () => {
      const mockReq = {
        body: { email: 'invalid' },
        query: {},
        params: {},
        correlationId: 'test-correlation-id'
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      const mockNext = jest.fn();

      const middleware = validateJoi({ body: authSchemas.login });
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            correlationId: 'test-correlation-id'
          })
        })
      );
    });
  });
});

describe('Schema completeness', () => {
  it('should have schemas for all major entities', () => {
    // Verify that we have comprehensive schemas
    expect(authSchemas).toBeDefined();
    expect(authSchemas.register).toBeDefined();
    expect(authSchemas.login).toBeDefined();
    
    expect(productSchemas).toBeDefined();
    expect(productSchemas.search).toBeDefined();
    
    expect(userSchemas).toBeDefined();
    expect(userSchemas.updateProfile).toBeDefined();
    
    expect(communitySchemas).toBeDefined();
    expect(communitySchemas.createTestimonial).toBeDefined();
    expect(communitySchemas.createPost).toBeDefined();
  });

  it('should have consistent UUID validation across schemas', () => {
    // Test that UUID validation is consistent
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const invalidUuid = 'not-a-uuid';

    // Test product ID validation
    const { error: validError } = productSchemas.getById.params.validate({ id: validUuid });
    expect(validError).toBeUndefined();

    const { error: invalidError } = productSchemas.getById.params.validate({ id: invalidUuid });
    expect(invalidError).toBeDefined();
  });

  it('should have consistent pagination schemas', () => {
    // Test that pagination is consistent across different endpoints
    const paginationData = { page: 1, limit: 20 };

    const productSearchResult = productSchemas.search.query.validate(paginationData);
    expect(productSearchResult.error).toBeUndefined();

    const communityPostsResult = communitySchemas.getPosts.query.validate(paginationData);
    expect(communityPostsResult.error).toBeUndefined();
  });
});