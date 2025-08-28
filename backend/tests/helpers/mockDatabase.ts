import { jest } from '@jest/globals';

// Mock Knex query builder
const createMockQueryBuilder = () => ({
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  whereNotNull: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  having: jest.fn().mockReturnThis(),
  join: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  count: jest.fn().mockResolvedValue([{ count: '0' }]),
  first: jest.fn().mockResolvedValue(null),
  insert: jest.fn().mockResolvedValue([1]),
  update: jest.fn().mockResolvedValue(1),
  delete: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
  then: jest.fn().mockResolvedValue([]),
  catch: jest.fn().mockReturnThis(),
  finally: jest.fn().mockReturnThis()
});

// Mock Knex instance
export const mockKnex = jest.fn().mockImplementation((tableName?: string) => {
  const queryBuilder = createMockQueryBuilder();
  if (tableName) {
    return queryBuilder;
  }
  return {
    ...queryBuilder,
    raw: jest.fn().mockResolvedValue({ rows: [] }),
    transaction: jest.fn().mockImplementation((callback) => {
      return callback(mockKnex);
    }),
    destroy: jest.fn().mockResolvedValue(undefined),
    migrate: {
      latest: jest.fn().mockResolvedValue([]),
      rollback: jest.fn().mockResolvedValue([])
    },
    seed: {
      run: jest.fn().mockResolvedValue([])
    }
  };
});

// Mock BaseModel
export const mockBaseModel = {
  getKnex: jest.fn().mockReturnValue(mockKnex),
  query: jest.fn().mockReturnValue(createMockQueryBuilder()),
  $query: jest.fn().mockReturnValue(createMockQueryBuilder())
};

// Setup database mocks
jest.mock('../../src/models/BaseModel', () => ({
  BaseModel: mockBaseModel
}));

jest.mock('../../src/config/database', () => ({
  getDatabaseConfig: jest.fn().mockReturnValue({
    client: 'sqlite3',
    connection: ':memory:',
    useNullAsDefault: true
  }),
  checkDatabaseHealth: jest.fn().mockResolvedValue({ healthy: true }),
  initializeDatabase: jest.fn().mockResolvedValue(mockKnex)
}));