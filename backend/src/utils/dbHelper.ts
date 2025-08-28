import { BaseModel } from '../models/BaseModel';

/**
 * Database helper class to provide access to the database connection
 * This is needed because BaseModel.db is protected
 */
export class DatabaseHelper {
    static get db() {
        // Create a temporary instance to access the protected db property
        const tempModel = new (class extends BaseModel<any> {
            validate() { return []; }
            sanitize(data: any) { return data; }
        })();

        return (tempModel as any).constructor.db;
    }
}