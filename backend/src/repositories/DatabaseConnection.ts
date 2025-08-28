import { Knex } from 'knex';
import { IDatabaseConnection } from '../types/dependencies';
import { db } from '../config/database';

/**
 * Database connection wrapper for dependency injection
 */
export class DatabaseConnection implements IDatabaseConnection {
  private knex: Knex;

  constructor(knexInstance?: Knex) {
    this.knex = knexInstance || db;
  }

  getKnex(): Knex {
    return this.knex;
  }
}