import { Router } from 'express';
import { DiscordController } from '../controllers/discordController';
import { authenticate } from '../middleware/auth';
import { generalRateLimit } from '../middleware/rateLimiter';
import { sanitizeParameters } from '../middleware/parameterSanitization';

const router = Router();

// Apply authentication to all Discord routes
router.use(authenticate);

// Apply rate limiting
router.use(generalRateLimit);

/**
 * @route POST /api/discord/servers
 * @desc Add Discord server configuration
 * @access Private
 */
router.post('/servers', DiscordController.validateServerConfig, DiscordController.addServerConfig);

/**
 * @route GET /api/discord/servers
 * @desc List all Discord server configurations for user
 * @access Private
 */
router.get('/servers', DiscordController.listServerConfigs);

/**
 * @route GET /api/discord/servers/:serverId
 * @desc Get Discord server configuration
 * @access Private
 */
router.get('/servers/:serverId', sanitizeParameters, DiscordController.validateServerId, DiscordController.getServerConfig);

/**
 * @route PUT /api/discord/servers/:serverId
 * @desc Update Discord server configuration
 * @access Private
 */
router.put('/servers/:serverId', sanitizeParameters, DiscordController.validateServerId, DiscordController.updateServerConfig);

/**
 * @route DELETE /api/discord/servers/:serverId
 * @desc Remove Discord server configuration
 * @access Private
 */
router.delete('/servers/:serverId', sanitizeParameters, DiscordController.validateServerId, DiscordController.removeServerConfig);

/**
 * @route POST /api/discord/servers/:serverId/test
 * @desc Test Discord connection
 * @access Private
 */
router.post('/servers/:serverId/test', sanitizeParameters, DiscordController.validateServerId, DiscordController.testConnection);

/**
 * @route GET /api/discord/servers/:serverId/stats
 * @desc Get Discord server statistics
 * @access Private
 */
router.get('/servers/:serverId/stats', sanitizeParameters, DiscordController.validateServerId, DiscordController.getServerStats);

/**
 * @route POST /api/discord/servers/:serverId/test-alert
 * @desc Send test alert to Discord server
 * @access Private
 */
router.post('/servers/:serverId/test-alert', sanitizeParameters, DiscordController.validateServerId, DiscordController.sendTestAlert);

export default router;