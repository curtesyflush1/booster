// Export all models for easy importing
export { BaseModel } from './BaseModel';
export { User } from './User';
export { Product } from './Product';
export { Watch } from './Watch';
export { WatchPack } from './WatchPack';
export { UserWatchPack } from './UserWatchPack';
export { Alert } from './Alert';

// Re-export types for convenience
export type {
  IUser,
  IProduct,
  IWatch,
  IWatchPack,
  IUserWatchPack,
  IAlert,
  IValidationError,
  IDatabaseError,
  IUserRegistration,
  ILoginCredentials,
  IAuthToken
} from '../types/database';