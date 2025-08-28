import Joi from 'joi';

/**
 * Schema factory for creating consistent validation patterns
 * This promotes reusability and consistency across the application
 */
export class SchemaFactory {
  /**
   * Create a standard CRUD schema set for an entity
   */
  static createCRUDSchemas(entityName: string, fields: Record<string, Joi.Schema>) {
    return {
      create: {
        body: Joi.object(fields).required()
      },
      update: {
        params: Joi.object({
          [`${entityName}Id`]: Joi.string().uuid().required()
        }),
        body: Joi.object(
          Object.fromEntries(
            Object.entries(fields).map(([key, schema]) => [key, schema.optional()])
          )
        )
      },
      getById: {
        params: Joi.object({
          [`${entityName}Id`]: Joi.string().uuid().required()
        })
      },
      delete: {
        params: Joi.object({
          [`${entityName}Id`]: Joi.string().uuid().required()
        })
      },
      list: {
        query: Joi.object({
          page: Joi.number().integer().min(1).default(1),
          limit: Joi.number().integer().min(1).max(100).default(20),
          search: Joi.string().max(200).optional(),
          sort_by: Joi.string().optional(),
          sort_order: Joi.string().valid('asc', 'desc').default('desc')
        })
      }
    };
  }

  /**
   * Create pagination schema
   */
  static createPaginationSchema(maxLimit = 100) {
    return Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(maxLimit).default(20)
    });
  }

  /**
   * Create UUID parameter schema
   */
  static createUUIDParam(paramName: string) {
    return Joi.object({
      [paramName]: Joi.string().uuid().required().messages({
        'string.uuid': `${paramName} must be a valid UUID`,
        'any.required': `${paramName} is required`
      })
    });
  }

  /**
   * Create date range query schema
   */
  static createDateRangeSchema() {
    return {
      start_date: Joi.date().iso().optional(),
      end_date: Joi.date().iso().min(Joi.ref('start_date')).optional()
    };
  }
}