/**
 * Expand core schema with user profile fields and core business entities
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // Expand users table with additional profile fields
    .alterTable('users', function (table) {
      table.boolean('email_verified').defaultTo(false);
      table.string('verification_token', 255);
      table.string('reset_token', 255);
      table.timestamp('reset_token_expires');
      table.integer('failed_login_attempts').defaultTo(0).checkBetween([0, 10]);
      table.timestamp('locked_until');
      table.timestamp('last_login');
      table.jsonb('shipping_addresses').defaultTo(JSON.stringify([]));
      table.jsonb('payment_methods').defaultTo(JSON.stringify([]));
      table.jsonb('retailer_credentials').defaultTo(JSON.stringify({}));
      table.jsonb('notification_settings').defaultTo(JSON.stringify({
        web_push: true,
        email: true,
        sms: false,
        discord: false
      }));
      table.jsonb('quiet_hours').defaultTo(JSON.stringify({
        enabled: false,
        start_time: '22:00',
        end_time: '08:00',
        timezone: 'UTC',
        days: []
      }));
      table.string('timezone').defaultTo('UTC');
      table.string('zip_code');
      
      table.index('verification_token');
      table.index('reset_token');
    })
    
    // Create retailers table
    .createTable('retailers', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.string('slug').notNullable().unique();
      table.string('website_url').notNullable();
      table.enu('api_type', ['official', 'affiliate', 'scraping']).notNullable();
      table.jsonb('api_config').defaultTo(JSON.stringify({}));
      table.boolean('is_active').defaultTo(true);
      table.integer('rate_limit_per_minute').defaultTo(60).checkBetween([1, 10000]);
      table.integer('health_score').defaultTo(100).checkBetween([0, 100]);
      table.timestamp('last_health_check');
      table.jsonb('supported_features').defaultTo(JSON.stringify([]));
      table.timestamps(true, true);
      
      table.index('slug');
      table.index('is_active');
    })
    
    // Create product_categories table
    .createTable('product_categories', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.string('slug').notNullable().unique();
      table.text('description');
      table.uuid('parent_id').references('id').inTable('product_categories').onDelete('SET NULL');
      table.integer('sort_order').defaultTo(0);
      table.timestamps(true, true);
      
      table.index('slug');
      table.index('parent_id');
    })
    
    // Create products table
    .createTable('products', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.string('slug').notNullable().unique();
      table.string('sku');
      table.string('upc').unique();
      table.uuid('category_id').references('id').inTable('product_categories').onDelete('SET NULL');
      table.string('set_name');
      table.string('series');
      table.date('release_date');
      table.decimal('msrp', 10, 2);
      table.string('image_url');
      table.text('description');
      table.jsonb('metadata').defaultTo(JSON.stringify({})); // Additional product-specific data
      table.boolean('is_active').defaultTo(true);
      table.integer('popularity_score').defaultTo(0).checkBetween([0, 1000]);
      table.timestamps(true, true);
      
      table.index('slug');
      table.index('upc');
      table.index('category_id');
      table.index('set_name');
      table.index('is_active');
      table.index('release_date');
    })
    
    // Create product_availability table
    .createTable('product_availability', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
      table.uuid('retailer_id').notNullable().references('id').inTable('retailers').onDelete('CASCADE');
      table.boolean('in_stock').defaultTo(false);
      table.decimal('price', 10, 2);
      table.decimal('original_price', 10, 2);
      table.enu('availability_status', ['in_stock', 'low_stock', 'out_of_stock', 'pre_order']);
      table.string('product_url').notNullable();
      table.string('cart_url');
      table.integer('stock_level');
      table.jsonb('store_locations').defaultTo(JSON.stringify([])); // For in-store availability
      table.timestamp('last_checked').defaultTo(knex.fn.now());
      table.timestamp('last_in_stock');
      table.timestamp('last_price_change');
      table.timestamps(true, true);
      
      table.unique(['product_id', 'retailer_id']);
      table.index('product_id');
      table.index('retailer_id');
      table.index('in_stock');
      table.index('last_checked');
    })
    
    // Create watches table
    .createTable('watches', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
      table.jsonb('retailer_ids').defaultTo(JSON.stringify([])); // Array of retailer IDs to monitor
      table.decimal('max_price', 10, 2);
      table.enu('availability_type', ['online', 'in_store', 'both']).defaultTo('both');
      table.string('zip_code'); // For location-based filtering
      table.integer('radius_miles'); // Search radius for in-store
      table.boolean('is_active').defaultTo(true);
      table.jsonb('alert_preferences').defaultTo(JSON.stringify({}));
      table.timestamp('last_alerted');
      table.integer('alert_count').defaultTo(0);
      table.timestamps(true, true);
      
      table.unique(['user_id', 'product_id']);
      table.index('user_id');
      table.index('product_id');
      table.index('is_active');
      table.index(['user_id', 'is_active']); // Common query pattern
    })
    
    // Create watch_packs table
    .createTable('watch_packs', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.string('slug').notNullable().unique();
      table.text('description');
      table.jsonb('product_ids').notNullable(); // Array of product IDs
      table.boolean('is_active').defaultTo(true);
      table.boolean('auto_update').defaultTo(true); // Auto-add new products to pack
      table.string('update_criteria'); // Criteria for auto-updates
      table.integer('subscriber_count').defaultTo(0);
      table.timestamps(true, true);
      
      table.index('slug');
      table.index('is_active');
    })
    
    // Create user_watch_packs table (many-to-many)
    .createTable('user_watch_packs', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.uuid('watch_pack_id').notNullable().references('id').inTable('watch_packs').onDelete('CASCADE');
      table.jsonb('customizations').defaultTo(JSON.stringify({})); // User-specific pack customizations
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      
      table.unique(['user_id', 'watch_pack_id']);
      table.index('user_id');
      table.index('watch_pack_id');
    })
    
    // Create alerts table
    .createTable('alerts', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
      table.uuid('retailer_id').notNullable().references('id').inTable('retailers').onDelete('CASCADE');
      table.uuid('watch_id').references('id').inTable('watches').onDelete('SET NULL');
      table.enu('type', ['restock', 'price_drop', 'low_stock', 'pre_order']).notNullable();
      table.enu('priority', ['low', 'medium', 'high', 'urgent']).notNullable().defaultTo('medium');
      table.jsonb('data').notNullable(); // Alert-specific data (price, availability, etc.)
      table.enu('status', ['pending', 'sent', 'failed', 'read']).defaultTo('pending');
      table.jsonb('delivery_channels').defaultTo(JSON.stringify([])); // Channels used for delivery
      table.timestamp('scheduled_for');
      table.timestamp('sent_at');
      table.timestamp('read_at');
      table.timestamp('clicked_at');
      table.string('failure_reason');
      table.integer('retry_count').defaultTo(0);
      table.timestamps(true, true);
      
      table.index('user_id');
      table.index('product_id');
      table.index('retailer_id');
      table.index('watch_id');
      table.index('status');
      table.index('type');
      table.index('priority');
      table.index('scheduled_for');
      table.index('created_at');
      table.index(['user_id', 'status']); // User alert queries
      table.index(['status', 'priority', 'created_at']); // Alert processing queue
    })
    
    // Create alert_deliveries table
    .createTable('alert_deliveries', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('alert_id').notNullable().references('id').inTable('alerts').onDelete('CASCADE');
      table.enu('channel', ['web_push', 'email', 'sms', 'discord']).notNullable();
      table.enu('status', ['pending', 'sent', 'delivered', 'failed', 'bounced']).defaultTo('pending');
      table.string('external_id'); // ID from external service (SES message ID, etc.)
      table.jsonb('metadata').defaultTo(JSON.stringify({})); // Channel-specific metadata
      table.timestamp('sent_at');
      table.timestamp('delivered_at');
      table.string('failure_reason');
      table.integer('retry_count').defaultTo(0);
      table.timestamps(true, true);
      
      table.index('alert_id');
      table.index('channel');
      table.index('status');
      table.index('sent_at');
    })
    
    // Create price_history table
    .createTable('price_history', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
      table.uuid('retailer_id').notNullable().references('id').inTable('retailers').onDelete('CASCADE');
      table.decimal('price', 10, 2).notNullable();
      table.decimal('original_price', 10, 2);
      table.boolean('in_stock').notNullable();
      table.string('availability_status');
      table.timestamp('recorded_at').defaultTo(knex.fn.now());
      
      table.index('product_id');
      table.index('retailer_id');
      table.index('recorded_at');
      table.index(['product_id', 'retailer_id', 'recorded_at']);
    })
    
    // Create user_sessions table
    .createTable('user_sessions', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('refresh_token').notNullable().unique();
      table.string('device_info');
      table.string('ip_address');
      table.string('user_agent');
      table.timestamp('expires_at').notNullable();
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      
      table.index('user_id');
      table.index('refresh_token');
      table.index('expires_at');
      table.index('is_active');
    })
    
    // Create system_health table
    .createTable('system_health', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('service_name').notNullable();
      table.enu('status', ['healthy', 'degraded', 'down']).notNullable();
      table.jsonb('metrics').defaultTo(JSON.stringify({}));
      table.text('message');
      table.timestamp('checked_at').defaultTo(knex.fn.now());
      
      table.index('service_name');
      table.index('status');
      table.index('checked_at');
    });
};

/**
 * Rollback core schema expansion
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    // Drop tables in reverse dependency order
    .dropTableIfExists('system_health')
    .dropTableIfExists('user_sessions')
    .dropTableIfExists('price_history')
    .dropTableIfExists('alert_deliveries')
    .dropTableIfExists('alerts')
    .dropTableIfExists('user_watch_packs')
    .dropTableIfExists('watch_packs')
    .dropTableIfExists('watches')
    .dropTableIfExists('product_availability')
    .dropTableIfExists('products')
    .dropTableIfExists('product_categories')
    .dropTableIfExists('retailers')
    // Revert users table changes
    .alterTable('users', function (table) {
      // Drop indexes first
      table.dropIndex('verification_token');
      table.dropIndex('reset_token');
      
      // Drop columns
      table.dropColumn('email_verified');
      table.dropColumn('verification_token');
      table.dropColumn('reset_token');
      table.dropColumn('reset_token_expires');
      table.dropColumn('failed_login_attempts');
      table.dropColumn('locked_until');
      table.dropColumn('last_login');
      table.dropColumn('shipping_addresses');
      table.dropColumn('payment_methods');
      table.dropColumn('retailer_credentials');
      table.dropColumn('notification_settings');
      table.dropColumn('quiet_hours');
      table.dropColumn('timezone');
      table.dropColumn('zip_code');
    });
};
