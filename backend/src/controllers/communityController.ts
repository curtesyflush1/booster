import { Request, Response } from 'express';
import { communityService } from '../services/communityService';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../types/express';

export class CommunityController {

    /**
     * Create testimonial
     */
    static async createTestimonial(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const { content, rating, isPublic = true, tags = [], metadata = {} } = req.body;

            const testimonial = await communityService.createTestimonial({
                userId,
                userName: req.user?.email?.split('@')[0] || 'Anonymous',
                content,
                rating,
                isVerified: req.user?.role === 'admin' || req.user?.role === 'super_admin',
                isPublic,
                isFeatured: false,
                tags,
                metadata
            });

            logger.info(`User ${userId} created testimonial ${testimonial.id}`);

            res.status(201).json({
                success: true,
                data: {
                    id: testimonial.id,
                    content: testimonial.content,
                    rating: testimonial.rating,
                    isPublic: testimonial.isPublic,
                    tags: testimonial.tags,
                    metadata: testimonial.metadata,
                    moderationStatus: testimonial.moderationStatus,
                    createdAt: testimonial.createdAt
                }
            });
        } catch (error) {
            logger.error('Failed to create testimonial:', error);
            res.status(500).json({
                error: 'Failed to create testimonial',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get testimonials
     */
    static async getTestimonials(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const {
                userId,
                isPublic,
                isFeatured,
                moderationStatus,
                minRating,
                tags,
                limit = 20,
                offset = 0
            } = req.query;

            const filters: any = {};

            if (userId) filters.userId = userId as string;
            if (isPublic !== undefined) filters.isPublic = isPublic === 'true';
            if (isFeatured !== undefined) filters.isFeatured = isFeatured === 'true';
            if (moderationStatus) filters.moderationStatus = moderationStatus as string;
            if (minRating) filters.minRating = parseInt(minRating as string);
            if (tags) filters.tags = (tags as string).split(',');
            filters.limit = parseInt(limit as string);
            filters.offset = parseInt(offset as string);

            // Non-admin users can only see approved public testimonials (unless viewing their own)
            if (req.user?.role !== 'admin') {
                if (!userId || userId !== req.user?.id) {
                    filters.moderationStatus = 'approved';
                    filters.isPublic = true;
                }
            }

            const result = await communityService.getTestimonials(filters);

            res.json({
                success: true,
                data: {
                    testimonials: result.testimonials.map(t => ({
                        id: t.id,
                        userName: t.userName,
                        userAvatar: t.userAvatar,
                        content: t.content,
                        rating: t.rating,
                        isVerified: t.isVerified,
                        tags: t.tags,
                        metadata: t.metadata,
                        createdAt: t.createdAt,
                        ...(req.user?.role === 'admin' && {
                            userId: t.userId,
                            moderationStatus: t.moderationStatus,
                            moderationNotes: t.moderationNotes
                        })
                    })),
                    total: result.total,
                    limit: filters.limit,
                    offset: filters.offset
                }
            });
        } catch (error) {
            logger.error('Failed to get testimonials:', error);
            res.status(500).json({ error: 'Failed to retrieve testimonials' });
        }
    }

    /**
     * Update testimonial
     */
    static async updateTestimonial(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const updates = req.body;

            const testimonial = await communityService.getTestimonial(id);
            if (!testimonial) {
                res.status(404).json({ error: 'Testimonial not found' });
                return;
            }

            // Only allow updates if user owns it or is admin
            if (testimonial.userId !== req.user?.id && req.user?.role !== 'admin') {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            const updated = await communityService.updateTestimonial(id, updates);

            logger.info(`User ${req.user?.id} updated testimonial ${id}`);

            res.json({
                success: true,
                data: {
                    id: updated.id,
                    content: updated.content,
                    rating: updated.rating,
                    isPublic: updated.isPublic,
                    tags: updated.tags,
                    metadata: updated.metadata,
                    updatedAt: updated.updatedAt
                }
            });
        } catch (error) {
            logger.error('Failed to update testimonial:', error);
            res.status(500).json({ error: 'Failed to update testimonial' });
        }
    }

    /**
     * Delete testimonial
     */
    static async deleteTestimonial(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const testimonial = await communityService.getTestimonial(id);
            if (!testimonial) {
                res.status(404).json({ error: 'Testimonial not found' });
                return;
            }

            // Only allow deletion if user owns it or is admin
            if (testimonial.userId !== req.user?.id && req.user?.role !== 'admin') {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            await communityService.deleteTestimonial(id);

            logger.info(`User ${req.user?.id} deleted testimonial ${id}`);

            res.json({
                success: true,
                message: 'Testimonial deleted successfully'
            });
        } catch (error) {
            logger.error('Failed to delete testimonial:', error);
            res.status(500).json({ error: 'Failed to delete testimonial' });
        }
    }

    /**
     * Create community post
     */
    static async createPost(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const { type, title, content, images = [], tags = [], isPublic = true } = req.body;

            const post = await communityService.createPost({
                userId,
                userName: req.user?.email?.split('@')[0] || 'Anonymous',
                type,
                title,
                content,
                images,
                tags,
                isPublic,
                isFeatured: false
            });

            logger.info(`User ${userId} created community post ${post.id}`);

            res.status(201).json({
                success: true,
                data: {
                    id: post.id,
                    type: post.type,
                    title: post.title,
                    content: post.content,
                    images: post.images,
                    tags: post.tags,
                    isPublic: post.isPublic,
                    moderationStatus: post.moderationStatus,
                    createdAt: post.createdAt
                }
            });
        } catch (error) {
            logger.error('Failed to create community post:', error);
            res.status(500).json({
                error: 'Failed to create community post',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get community posts
     */
    static async getPosts(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const {
                userId,
                type,
                isPublic,
                isFeatured,
                moderationStatus,
                tags,
                limit = 20,
                offset = 0
            } = req.query;

            const filters: any = {};

            if (userId) filters.userId = userId as string;
            if (type) filters.type = type as string;
            if (isPublic !== undefined) filters.isPublic = isPublic === 'true';
            if (isFeatured !== undefined) filters.isFeatured = isFeatured === 'true';
            if (moderationStatus) filters.moderationStatus = moderationStatus as string;
            if (tags) filters.tags = (tags as string).split(',');
            filters.limit = parseInt(limit as string);
            filters.offset = parseInt(offset as string);

            // Non-admin users can only see approved public posts (unless viewing their own)
            if (req.user?.role !== 'admin') {
                if (!userId || userId !== req.user?.id) {
                    filters.moderationStatus = 'approved';
                    filters.isPublic = true;
                }
            }

            const result = await communityService.getPosts(filters);

            res.json({
                success: true,
                data: {
                    posts: result.posts.map(p => ({
                        id: p.id,
                        userName: p.userName,
                        userAvatar: p.userAvatar,
                        type: p.type,
                        title: p.title,
                        content: p.content,
                        images: p.images,
                        tags: p.tags,
                        likes: p.likes,
                        comments: p.comments,
                        createdAt: p.createdAt,
                        ...(req.user?.role === 'admin' && {
                            userId: p.userId,
                            moderationStatus: p.moderationStatus
                        })
                    })),
                    total: result.total,
                    limit: filters.limit,
                    offset: filters.offset
                }
            });
        } catch (error) {
            logger.error('Failed to get community posts:', error);
            res.status(500).json({ error: 'Failed to retrieve community posts' });
        }
    }

    /**
     * Like/unlike post
     */
    static async togglePostLike(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const result = await communityService.togglePostLike(id, userId);

            logger.info(`User ${userId} ${result.liked ? 'liked' : 'unliked'} post ${id}`);

            res.json({
                success: true,
                data: {
                    postId: id,
                    liked: result.liked,
                    totalLikes: result.totalLikes
                }
            });
        } catch (error) {
            logger.error('Failed to toggle post like:', error);
            res.status(500).json({ error: 'Failed to toggle post like' });
        }
    }

    /**
     * Add comment to post
     */
    static async addComment(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { content, isPublic = true } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const comment = await communityService.addComment({
                postId: id,
                userId,
                userName: req.user?.email?.split('@')[0] || 'Anonymous',
                content,
                isPublic
            });

            logger.info(`User ${userId} added comment ${comment.id} to post ${id}`);

            res.status(201).json({
                success: true,
                data: {
                    id: comment.id,
                    content: comment.content,
                    userName: comment.userName,
                    createdAt: comment.createdAt,
                    moderationStatus: comment.moderationStatus
                }
            });
        } catch (error) {
            logger.error('Failed to add comment:', error);
            res.status(500).json({
                error: 'Failed to add comment',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get post comments
     */
    static async getPostComments(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { limit = 50, offset = 0 } = req.query;

            const filters: any = {
                limit: parseInt(limit as string),
                offset: parseInt(offset as string)
            };

            // Non-admin users can only see approved public comments
            if (req.user?.role !== 'admin') {
                filters.moderationStatus = 'approved';
                filters.isPublic = true;
            }

            const result = await communityService.getPostComments(id, filters);

            res.json({
                success: true,
                data: {
                    comments: result.comments.map(c => ({
                        id: c.id,
                        userName: c.userName,
                        userAvatar: c.userAvatar,
                        content: c.content,
                        likes: c.likes,
                        createdAt: c.createdAt,
                        ...(req.user?.role === 'admin' && {
                            userId: c.userId,
                            moderationStatus: c.moderationStatus
                        })
                    })),
                    total: result.total,
                    limit: filters.limit,
                    offset: filters.offset
                }
            });
        } catch (error) {
            logger.error('Failed to get post comments:', error);
            res.status(500).json({ error: 'Failed to retrieve post comments' });
        }
    }

    /**
     * Get community statistics
     */
    static async getCommunityStats(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const stats = await communityService.getCommunityStats();

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Failed to get community stats:', error);
            res.status(500).json({ error: 'Failed to retrieve community statistics' });
        }
    }

    /**
     * Get featured content
     */
    static async getFeaturedContent(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const content = await communityService.getFeaturedContent();

            res.json({
                success: true,
                data: {
                    testimonials: content.testimonials.map(t => ({
                        id: t.id,
                        userName: t.userName,
                        userAvatar: t.userAvatar,
                        content: t.content,
                        rating: t.rating,
                        isVerified: t.isVerified,
                        tags: t.tags,
                        metadata: t.metadata,
                        createdAt: t.createdAt
                    })),
                    posts: content.posts.map(p => ({
                        id: p.id,
                        userName: p.userName,
                        userAvatar: p.userAvatar,
                        type: p.type,
                        title: p.title,
                        content: p.content,
                        images: p.images,
                        tags: p.tags,
                        likes: p.likes,
                        comments: p.comments,
                        createdAt: p.createdAt
                    }))
                }
            });
        } catch (error) {
            logger.error('Failed to get featured content:', error);
            res.status(500).json({ error: 'Failed to retrieve featured content' });
        }
    }

    /**
     * Moderate content (admin only)
     */
    static async moderateContent(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({ error: 'Admin access required' });
                return;
            }

            const { contentType, contentId, action, notes } = req.body;

            if (!['testimonial', 'post', 'comment'].includes(contentType)) {
                res.status(400).json({ error: 'Invalid content type' });
                return;
            }

            if (!['approve', 'reject'].includes(action)) {
                res.status(400).json({ error: 'Invalid action' });
                return;
            }

            await communityService.moderateContent(contentType, contentId, action, notes);

            logger.info(`Admin ${req.user?.id} ${action}d ${contentType} ${contentId}`);

            res.json({
                success: true,
                message: `${contentType} ${action}d successfully`,
                data: {
                    contentType,
                    contentId,
                    action,
                    moderatedAt: new Date().toISOString()
                }
            });
        } catch (error) {
            logger.error('Failed to moderate content:', error);
            res.status(500).json({
                error: 'Failed to moderate content',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}