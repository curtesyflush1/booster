import { logger } from '../utils/logger';
import { User } from '../models/User';

interface Testimonial {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  rating: number; // 1-5 stars
  isVerified: boolean;
  isPublic: boolean;
  isFeatured: boolean;
  tags: string[];
  metadata: {
    productsSaved?: number;
    moneySaved?: number;
    timeUsing?: string;
    favoriteFeature?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  moderationNotes?: string;
}

interface CommunityPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  type: 'success_story' | 'tip' | 'collection_showcase' | 'deal_share' | 'question';
  title: string;
  content: string;
  images?: string[];
  tags: string[];
  likes: number;
  comments: number;
  isPublic: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
  moderationStatus: 'pending' | 'approved' | 'rejected';
}

interface Comment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  likes: number;
  isPublic: boolean;
  createdAt: Date;
  moderationStatus: 'pending' | 'approved' | 'rejected';
}

interface CommunityStats {
  totalTestimonials: number;
  averageRating: number;
  totalPosts: number;
  totalComments: number;
  activeUsers: number;
  featuredContent: number;
}

export class CommunityService {
  private testimonials: Map<string, Testimonial> = new Map();
  private posts: Map<string, CommunityPost> = new Map();
  private comments: Map<string, Comment> = new Map();

  /**
   * Create a new testimonial
   */
  async createTestimonial(data: Omit<Testimonial, 'id' | 'createdAt' | 'updatedAt' | 'moderationStatus'>): Promise<Testimonial> {
    const testimonial: Testimonial = {
      ...data,
      id: `testimonial_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      moderationStatus: 'pending'
    };

    // Validate user exists
    const user = await User.findById(data.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Auto-approve testimonials from verified users with good history
    if (data.isVerified || (user as any).subscription_tier === 'pro') {
      testimonial.moderationStatus = 'approved';
    }

    this.testimonials.set(testimonial.id, testimonial);
    
    logger.info(`Created testimonial ${testimonial.id} by user ${data.userId}`);
    return testimonial;
  }

  /**
   * Update testimonial
   */
  async updateTestimonial(testimonialId: string, updates: Partial<Testimonial>): Promise<Testimonial> {
    const existing = this.testimonials.get(testimonialId);
    if (!existing) {
      throw new Error('Testimonial not found');
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    this.testimonials.set(testimonialId, updated);
    logger.info(`Updated testimonial ${testimonialId}`);
    return updated;
  }

  /**
   * Delete testimonial
   */
  async deleteTestimonial(testimonialId: string): Promise<void> {
    const testimonial = this.testimonials.get(testimonialId);
    if (!testimonial) {
      throw new Error('Testimonial not found');
    }

    this.testimonials.delete(testimonialId);
    logger.info(`Deleted testimonial ${testimonialId}`);
  }

  /**
   * Get testimonial by ID
   */
  async getTestimonial(testimonialId: string): Promise<Testimonial | null> {
    return this.testimonials.get(testimonialId) || null;
  }

  /**
   * Get testimonials with filters
   */
  async getTestimonials(filters: {
    userId?: string;
    isPublic?: boolean;
    isFeatured?: boolean;
    moderationStatus?: string;
    minRating?: number;
    tags?: string[];
    limit?: number;
    offset?: number;
  } = {}): Promise<{ testimonials: Testimonial[]; total: number }> {
    let testimonials = Array.from(this.testimonials.values());

    // Apply filters
    if (filters.userId) {
      testimonials = testimonials.filter(t => t.userId === filters.userId);
    }

    if (filters.isPublic !== undefined) {
      testimonials = testimonials.filter(t => t.isPublic === filters.isPublic);
    }

    if (filters.isFeatured !== undefined) {
      testimonials = testimonials.filter(t => t.isFeatured === filters.isFeatured);
    }

    if (filters.moderationStatus) {
      testimonials = testimonials.filter(t => t.moderationStatus === filters.moderationStatus);
    }

    if (filters.minRating) {
      testimonials = testimonials.filter(t => t.rating >= filters.minRating!);
    }

    if (filters.tags && filters.tags.length > 0) {
      testimonials = testimonials.filter(t => 
        filters.tags!.some(tag => t.tags.includes(tag))
      );
    }

    const total = testimonials.length;

    // Sort by creation date (newest first)
    testimonials.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 20;
    testimonials = testimonials.slice(offset, offset + limit);

    return { testimonials, total };
  }

  /**
   * Create a community post
   */
  async createPost(data: Omit<CommunityPost, 'id' | 'createdAt' | 'updatedAt' | 'likes' | 'comments' | 'moderationStatus'>): Promise<CommunityPost> {
    const post: CommunityPost = {
      ...data,
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      likes: 0,
      comments: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      moderationStatus: 'pending'
    };

    // Validate user exists
    const user = await User.findById(data.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Auto-approve posts from verified users
    if ((user as any).subscription_tier === 'pro') {
      post.moderationStatus = 'approved';
    }

    this.posts.set(post.id, post);
    
    logger.info(`Created community post ${post.id} by user ${data.userId}`);
    return post;
  }

  /**
   * Update community post
   */
  async updatePost(postId: string, updates: Partial<CommunityPost>): Promise<CommunityPost> {
    const existing = this.posts.get(postId);
    if (!existing) {
      throw new Error('Post not found');
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    this.posts.set(postId, updated);
    logger.info(`Updated community post ${postId}`);
    return updated;
  }

  /**
   * Delete community post
   */
  async deletePost(postId: string): Promise<void> {
    const post = this.posts.get(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    // Also delete associated comments
    const postComments = Array.from(this.comments.values()).filter(c => c.postId === postId);
    for (const comment of postComments) {
      this.comments.delete(comment.id);
    }

    this.posts.delete(postId);
    logger.info(`Deleted community post ${postId} and ${postComments.length} comments`);
  }

  /**
   * Get community posts with filters
   */
  async getPosts(filters: {
    userId?: string;
    type?: string;
    isPublic?: boolean;
    isFeatured?: boolean;
    moderationStatus?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  } = {}): Promise<{ posts: CommunityPost[]; total: number }> {
    let posts = Array.from(this.posts.values());

    // Apply filters
    if (filters.userId) {
      posts = posts.filter(p => p.userId === filters.userId);
    }

    if (filters.type) {
      posts = posts.filter(p => p.type === filters.type);
    }

    if (filters.isPublic !== undefined) {
      posts = posts.filter(p => p.isPublic === filters.isPublic);
    }

    if (filters.isFeatured !== undefined) {
      posts = posts.filter(p => p.isFeatured === filters.isFeatured);
    }

    if (filters.moderationStatus) {
      posts = posts.filter(p => p.moderationStatus === filters.moderationStatus);
    }

    if (filters.tags && filters.tags.length > 0) {
      posts = posts.filter(p => 
        filters.tags!.some(tag => p.tags.includes(tag))
      );
    }

    const total = posts.length;

    // Sort by creation date (newest first)
    posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 20;
    posts = posts.slice(offset, offset + limit);

    return { posts, total };
  }

  /**
   * Like/unlike a post
   */
  async togglePostLike(postId: string, userId: string): Promise<{ liked: boolean; totalLikes: number }> {
    const post = this.posts.get(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    // In a real implementation, this would track individual user likes
    // For now, we'll just increment/decrement the counter
    const liked = Math.random() > 0.5; // Mock like state
    
    if (liked) {
      post.likes++;
    } else {
      post.likes = Math.max(0, post.likes - 1);
    }

    this.posts.set(postId, post);
    
    logger.info(`User ${userId} ${liked ? 'liked' : 'unliked'} post ${postId}`);
    return { liked, totalLikes: post.likes };
  }

  /**
   * Add comment to post
   */
  async addComment(data: Omit<Comment, 'id' | 'createdAt' | 'likes' | 'moderationStatus'>): Promise<Comment> {
    const post = this.posts.get(data.postId);
    if (!post) {
      throw new Error('Post not found');
    }

    const comment: Comment = {
      ...data,
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      likes: 0,
      createdAt: new Date(),
      moderationStatus: 'pending'
    };

    // Validate user exists
    const user = await User.findById(data.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Auto-approve comments from verified users
    if ((user as any).subscription_tier === 'pro') {
      comment.moderationStatus = 'approved';
    }

    this.comments.set(comment.id, comment);
    
    // Update post comment count
    post.comments++;
    this.posts.set(post.id, post);
    
    logger.info(`Added comment ${comment.id} to post ${data.postId} by user ${data.userId}`);
    return comment;
  }

  /**
   * Get comments for a post
   */
  async getPostComments(postId: string, filters: {
    isPublic?: boolean;
    moderationStatus?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ comments: Comment[]; total: number }> {
    let comments = Array.from(this.comments.values()).filter(c => c.postId === postId);

    // Apply filters
    if (filters.isPublic !== undefined) {
      comments = comments.filter(c => c.isPublic === filters.isPublic);
    }

    if (filters.moderationStatus) {
      comments = comments.filter(c => c.moderationStatus === filters.moderationStatus);
    }

    const total = comments.length;

    // Sort by creation date (oldest first for comments)
    comments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    comments = comments.slice(offset, offset + limit);

    return { comments, total };
  }

  /**
   * Moderate content (admin only)
   */
  async moderateContent(contentType: 'testimonial' | 'post' | 'comment', contentId: string, action: 'approve' | 'reject', notes?: string): Promise<void> {
    let content: any;
    
    switch (contentType) {
      case 'testimonial':
        content = this.testimonials.get(contentId);
        break;
      case 'post':
        content = this.posts.get(contentId);
        break;
      case 'comment':
        content = this.comments.get(contentId);
        break;
    }

    if (!content) {
      throw new Error(`${contentType} not found`);
    }

    content.moderationStatus = action === 'approve' ? 'approved' : 'rejected';
    if (notes) {
      content.moderationNotes = notes;
    }

    // Update the content in the appropriate map
    switch (contentType) {
      case 'testimonial':
        this.testimonials.set(contentId, content);
        break;
      case 'post':
        this.posts.set(contentId, content);
        break;
      case 'comment':
        this.comments.set(contentId, content);
        break;
    }

    logger.info(`Moderated ${contentType} ${contentId}: ${action}`);
  }

  /**
   * Get community statistics
   */
  async getCommunityStats(): Promise<CommunityStats> {
    const testimonials = Array.from(this.testimonials.values());
    const posts = Array.from(this.posts.values());
    const comments = Array.from(this.comments.values());

    const approvedTestimonials = testimonials.filter(t => t.moderationStatus === 'approved');
    const averageRating = approvedTestimonials.length > 0
      ? approvedTestimonials.reduce((sum, t) => sum + t.rating, 0) / approvedTestimonials.length
      : 0;

    const uniqueUsers = new Set([
      ...testimonials.map(t => t.userId),
      ...posts.map(p => p.userId),
      ...comments.map(c => c.userId)
    ]);

    return {
      totalTestimonials: approvedTestimonials.length,
      averageRating: Math.round(averageRating * 10) / 10,
      totalPosts: posts.filter(p => p.moderationStatus === 'approved').length,
      totalComments: comments.filter(c => c.moderationStatus === 'approved').length,
      activeUsers: uniqueUsers.size,
      featuredContent: [
        ...testimonials.filter(t => t.isFeatured),
        ...posts.filter(p => p.isFeatured)
      ].length
    };
  }

  /**
   * Get featured content for homepage
   */
  async getFeaturedContent(): Promise<{
    testimonials: Testimonial[];
    posts: CommunityPost[];
  }> {
    const featuredTestimonials = Array.from(this.testimonials.values())
      .filter(t => t.isFeatured && t.moderationStatus === 'approved' && t.isPublic)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 6);

    const featuredPosts = Array.from(this.posts.values())
      .filter(p => p.isFeatured && p.moderationStatus === 'approved' && p.isPublic)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 4);

    return {
      testimonials: featuredTestimonials,
      posts: featuredPosts
    };
  }
}

export const communityService = new CommunityService();