export class BaseModel {
  static tableName = 'base_model';
  
  static async findById(id: string) {
    return null;
  }
  
  static async findBy(criteria: any) {
    return [];
  }
  
  static async create(data: any) {
    return { id: 'mock-id', ...data };
  }
  
  static async updateById(id: string, data: any) {
    return { id, ...data };
  }
  
  static async deleteById(id: string) {
    return true;
  }
}
