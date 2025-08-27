import { Alert } from '../models/Alert';
import { logger } from '../utils/logger';
import { safeCount } from '../utils/database';

export interface AlertAnalytics {
    period: {
        days: number;
        startDate: string;
        endDate: string;
    };
    summary: {
        totalAlerts: number;
        sentAlerts: number;
        clickedAlerts: number;
        readAlerts: number;
        clickThroughRate: number;
        readRate: number;
    };
    dailyBreakdown: Array<{
        date: string;
        total: number;
        sent: number;
        clicked: number;
        read: number;
    }>;
}

export class AlertAnalyticsService {
    /**
     * Get comprehensive alert analytics for a user
     */
    static async getUserAnalytics(userId: string, days: number = 30): Promise<AlertAnalytics> {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        try {
            const [summary, dailyBreakdown] = await Promise.all([
                this.getAnalyticsSummary(userId, cutoffDate),
                this.getDailyBreakdown(userId, cutoffDate)
            ]);

            return {
                period: {
                    days,
                    startDate: cutoffDate.toISOString(),
                    endDate: new Date().toISOString()
                },
                summary,
                dailyBreakdown
            };
        } catch (error) {
            logger.error('Error generating user analytics:', error);
            throw error;
        }
    }

    /**
     * Get summary analytics for a user
     */
    private static async getAnalyticsSummary(userId: string, cutoffDate: Date) {
        const queries = [
            // Total alerts
            Alert['db'](Alert.getTableName())
                .where('user_id', userId)
                .where('created_at', '>=', cutoffDate)
                .count('* as count'),

            // Sent alerts
            Alert['db'](Alert.getTableName())
                .where('user_id', userId)
                .where('status', 'sent')
                .where('created_at', '>=', cutoffDate)
                .count('* as count'),

            // Clicked alerts
            Alert['db'](Alert.getTableName())
                .where('user_id', userId)
                .whereNotNull('clicked_at')
                .where('created_at', '>=', cutoffDate)
                .count('* as count'),

            // Read alerts
            Alert['db'](Alert.getTableName())
                .where('user_id', userId)
                .whereNotNull('read_at')
                .where('created_at', '>=', cutoffDate)
                .count('* as count')
        ];

        const [totalAlerts, sentAlerts, clickedAlerts, readAlerts] = await Promise.all(queries);

        const totalCount = safeCount(totalAlerts);
        const sentCount = safeCount(sentAlerts);
        const clickedCount = safeCount(clickedAlerts);
        const readCount = safeCount(readAlerts);

        const clickThroughRate = sentCount > 0 ? (clickedCount / sentCount) * 100 : 0;
        const readRate = totalCount > 0 ? (readCount / totalCount) * 100 : 0;

        return {
            totalAlerts: totalCount,
            sentAlerts: sentCount,
            clickedAlerts: clickedCount,
            readAlerts: readCount,
            clickThroughRate: Math.round(clickThroughRate * 100) / 100,
            readRate: Math.round(readRate * 100) / 100
        };
    }

    /**
     * Get daily breakdown of alert metrics
     */
    private static async getDailyBreakdown(userId: string, cutoffDate: Date) {
        const dailyStats = await Alert['db'](Alert.getTableName())
            .select(Alert['db'].raw('DATE(created_at) as date'))
            .count('* as total')
            .sum(Alert['db'].raw('CASE WHEN status = ? THEN 1 ELSE 0 END', ['sent']))
            .sum(Alert['db'].raw('CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END'))
            .sum(Alert['db'].raw('CASE WHEN read_at IS NOT NULL THEN 1 ELSE 0 END'))
            .where('user_id', userId)
            .where('created_at', '>=', cutoffDate)
            .groupBy(Alert['db'].raw('DATE(created_at)'))
            .orderBy('date', 'desc');

        return dailyStats.map((stat: any) => ({
            date: stat.date,
            total: parseInt(stat.total as string),
            sent: parseInt(stat.sent as string),
            clicked: parseInt(stat.clicked as string),
            read: parseInt(stat.read as string)
        }));
    }
}