import { User } from '../models/User';
import { IUser, IUserManagementFilters, IAdminUserDetails } from '../types/database';
import { AdminAuditService } from './adminAuditService';
import { logger } from '../utils/logger';
import { db } from '../config/database';
import { safeCount } from '../utils/database';

export class AdminUserService {
    /**
     * Get users with pagination and filtering for admin dashboard
     */
    static async getUsers(
        page: number = 1,
        limit: number = 50,
        filters: IUserManagementFilters = {}
    ): Promise<{
        users: IAdminUserDetails[];
        total: number;
        page: number;
        limit: number;
    }> {
        try {
            const offset = (page - 1) * limit;

            let query = db('users')
                .select(
                    'users.*',
                    db.raw('COUNT(DISTINCT watches.id) as watch_count'),
                    db.raw('COUNT(DISTINCT alerts.id) as alert_count'),
                    db.raw('MAX(GREATEST(users.last_login, alerts.created_at, watches.created_at)) as last_activity')
                )
                .leftJoin('watches', 'users.id', 'watches.user_id')
                .leftJoin('alerts', 'users.id', 'alerts.user_id')
                .groupBy('users.id')
                .orderBy('users.created_at', 'desc')
                .limit(limit)
                .offset(offset);

            let countQuery = db('users').count('* as count');

            // Apply filters
            if (filters.search) {
                const searchTerm = `%${filters.search}%`;
                query = query.where(function (builder) {
                    builder.where('users.email', 'ilike', searchTerm)
                        .orWhere('users.first_name', 'ilike', searchTerm)
                        .orWhere('users.last_name', 'ilike', searchTerm);
                });
                countQuery = countQuery.where(function (builder) {
                    builder.where('email', 'ilike', searchTerm)
                        .orWhere('first_name', 'ilike', searchTerm)
                        .orWhere('last_name', 'ilike', searchTerm);
                });
            }

            if (filters.role) {
                query = query.where('users.role', filters.role);
                countQuery = countQuery.where('role', filters.role);
            }

            if (filters.subscription_tier) {
                query = query.where('users.subscription_tier', filters.subscription_tier);
                countQuery = countQuery.where('subscription_tier', filters.subscription_tier);
            }

            if (filters.email_verified !== undefined) {
                query = query.where('users.email_verified', filters.email_verified);
                countQuery = countQuery.where('email_verified', filters.email_verified);
            }

            if (filters.created_after) {
                query = query.where('users.created_at', '>=', filters.created_after);
                countQuery = countQuery.where('created_at', '>=', filters.created_after);
            }

            if (filters.created_before) {
                query = query.where('users.created_at', '<=', filters.created_before);
                countQuery = countQuery.where('created_at', '<=', filters.created_before);
            }

            const [users, countResult] = await Promise.all([
                query,
                countQuery.first()
            ]);

            const total = safeCount(countResult ? [countResult] : []);

            // Remove password hash from results
            const sanitizedUsers = users.map((user: any) => {
                const { password_hash, ...userWithoutPassword } = user;
                return {
                    ...userWithoutPassword,
                    watch_count: parseInt(user.watch_count) || 0,
                    alert_count: parseInt(user.alert_count) || 0,
                    last_activity: user.last_activity || null
                } as IAdminUserDetails;
            });

            return {
                users: sanitizedUsers,
                total,
                page,
                limit
            };
        } catch (error) {
            logger.error('Failed to get users for admin', {
                error: error instanceof Error ? error.message : String(error),
                filters
            });
            throw new Error('Failed to retrieve users');
        }
    }

    /**
     * Get detailed user information for admin
     */
    static async getUserDetails(userId: string): Promise<IAdminUserDetails | null> {
        try {
            const userResult = await db('users')
                .select(
                    'users.*',
                    db.raw('COUNT(DISTINCT watches.id) as watch_count'),
                    db.raw('COUNT(DISTINCT alerts.id) as alert_count'),
                    db.raw('MAX(GREATEST(users.last_login, alerts.created_at, watches.created_at)) as last_activity')
                )
                .leftJoin('watches', 'users.id', 'watches.user_id')
                .leftJoin('alerts', 'users.id', 'alerts.user_id')
                .where('users.id', userId)
                .groupBy('users.id')
                .first();

            if (!userResult) {
                return null;
            }

            const { password_hash, ...userWithoutPassword } = userResult;

            return {
                ...userWithoutPassword,
                watch_count: parseInt(userResult.watch_count) || 0,
                alert_count: parseInt(userResult.alert_count) || 0,
                last_activity: userResult.last_activity || null
            } as IAdminUserDetails;
        } catch (error) {
            logger.error('Failed to get user details for admin', {
                error: error instanceof Error ? error.message : String(error),
                userId
            });
            throw new Error('Failed to retrieve user details');
        }
    }

    /**
     * Update user role and permissions
     */
    static async updateUserRole(
        adminUserId: string,
        targetUserId: string,
        role: 'user' | 'admin' | 'super_admin',
        permissions: string[] = [],
        ipAddress?: string,
        userAgent?: string
    ): Promise<boolean> {
        try {
            const updateData: Partial<IUser> = {
                role,
                admin_permissions: permissions
            };

            const updated = await User.updateById(targetUserId, updateData);

            if (updated) {
                await AdminAuditService.logAction(
                    adminUserId,
                    'user_role_updated',
                    'user',
                    targetUserId,
                    { newRole: role, permissions },
                    ipAddress,
                    userAgent
                );

                logger.info('User role updated by admin', {
                    adminUserId,
                    targetUserId,
                    newRole: role,
                    permissions
                });
            }

            return updated !== null;
        } catch (error) {
            logger.error('Failed to update user role', {
                error: error instanceof Error ? error.message : String(error),
                adminUserId,
                targetUserId,
                role
            });
            throw new Error('Failed to update user role');
        }
    }

    /**
     * Suspend or unsuspend a user
     */
    static async suspendUser(
        adminUserId: string,
        targetUserId: string,
        suspend: boolean,
        reason?: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<boolean> {
        try {
            const lockUntil = suspend ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null; // 1 year suspension

            const updated = await User.updateById(targetUserId, {
                locked_until: lockUntil
            });

            if (updated) {
                await AdminAuditService.logAction(
                    adminUserId,
                    suspend ? 'user_suspended' : 'user_unsuspended',
                    'user',
                    targetUserId,
                    { reason },
                    ipAddress,
                    userAgent
                );

                logger.info(`User ${suspend ? 'suspended' : 'unsuspended'} by admin`, {
                    adminUserId,
                    targetUserId,
                    reason
                });
            }

            return updated !== null;
        } catch (error) {
            logger.error('Failed to suspend/unsuspend user', {
                error: error instanceof Error ? error.message : String(error),
                adminUserId,
                targetUserId,
                suspend
            });
            throw new Error('Failed to update user suspension status');
        }
    }

    /**
     * Delete a user (soft delete by deactivating)
     */
    static async deleteUser(
        adminUserId: string,
        targetUserId: string,
        reason?: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<boolean> {
        try {
            // Soft delete by setting email to deleted state and locking account
            const timestamp = Date.now();
            const updated = await User.updateById(targetUserId, {
                email: `deleted_${timestamp}@boosterbeacon.com`,
                locked_until: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), // 100 years
                email_verified: false
            });

            if (updated) {
                await AdminAuditService.logAction(
                    adminUserId,
                    'user_deleted',
                    'user',
                    targetUserId,
                    { reason },
                    ipAddress,
                    userAgent
                );

                logger.info('User deleted by admin', {
                    adminUserId,
                    targetUserId,
                    reason
                });
            }

            return updated !== null;
        } catch (error) {
            logger.error('Failed to delete user', {
                error: error instanceof Error ? error.message : String(error),
                adminUserId,
                targetUserId
            });
            throw new Error('Failed to delete user');
        }
    }

    /**
     * Get user statistics for admin dashboard
     */
    static async getUserStats(): Promise<{
        total: number;
        active: number;
        new_today: number;
        new_this_week: number;
        pro_subscribers: number;
        conversion_rate: number;
        by_role: Record<string, number>;
    }> {
        try {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

            // Get basic counts
            const [
                totalResult,
                activeResult,
                newTodayResult,
                newWeekResult,
                proResult,
                roleStatsResult
            ] = await Promise.all([
                db('users').count('* as count').first(),
                db('users').where('locked_until', null).orWhere('locked_until', '<', now).count('* as count').first(),
                db('users').where('created_at', '>=', today).count('* as count').first(),
                db('users').where('created_at', '>=', weekAgo).count('* as count').first(),
                db('users').where('subscription_tier', 'pro').count('* as count').first(),
                db('users').select('role').count('* as count').groupBy('role')
            ]);

            const total = parseInt(totalResult?.count as string) || 0;
            const active = parseInt(activeResult?.count as string) || 0;
            const newToday = parseInt(newTodayResult?.count as string) || 0;
            const newThisWeek = parseInt(newWeekResult?.count as string) || 0;
            const proSubscribers = parseInt(proResult?.count as string) || 0;

            const conversionRate = total > 0 ? (proSubscribers / total) * 100 : 0;

            const byRole: Record<string, number> = {};
            roleStatsResult.forEach((row: any) => {
                byRole[row.role] = parseInt(row.count as string);
            });

            return {
                total,
                active,
                new_today: newToday,
                new_this_week: newThisWeek,
                pro_subscribers: proSubscribers,
                conversion_rate: Math.round(conversionRate * 100) / 100,
                by_role: byRole
            };
        } catch (error) {
            logger.error('Failed to get user stats', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw new Error('Failed to retrieve user statistics');
        }
    }
}