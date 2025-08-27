/**
 * Add machine learning and prediction system tables
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // Create availability_snapshots table for trend analysis
    .createTable('availability_snapshots', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
      table.uuid('retailer_id').notNullable().references('id').inTable('retailers').onDelete('CASCADE');
      table.boolean('in_stock').notNullable();
      table.string('availability_status');
      table.integer('stock_level');
      table.timestamp('last_checked');
      table.timestamp('snapshot_time').defaultTo(knex.fn.now());
      
      table.index(['product_id', 'snapshot_time']);
      table.index(['retailer_id', 'snapshot_time']);
      table.index('snapshot_time');
    })
    
    // Create trend_analysis table for storing ML trend calculations
    .createTable('trend_analysis', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
      table.decimal('price_trend', 10, 6); // Slope of price trend
      table.decimal('availability_trend', 10, 6); // Slope of availability trend
      table.decimal('demand_score', 5, 2); // 0-100 demand score
      table.decimal('volatility_score', 5, 2); // Price volatility coefficient
      table.timestamp('analyzed_at').defaultTo(knex.fn.now());
      
      table.index('product_id');
      table.index('analyzed_at');
      table.index(['product_id', 'analyzed_at']);
    })
    
    // Create ml_predictions table for caching prediction results
    .createTable('ml_predictions', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
      table.enu('prediction_type', ['price', 'sellout', 'roi', 'hype']).notNullable();
      table.jsonb('prediction_data').notNullable(); // Stores the prediction result
      table.integer('timeframe_days'); // For price and ROI predictions
      table.decimal('input_price', 10, 2); // For ROI predictions
      table.decimal('confidence_score', 5, 2); // 0-100 confidence
      table.timestamp('expires_at').notNullable(); // Cache expiration
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.index(['product_id', 'prediction_type']);
      table.index('expires_at');
      table.index(['product_id', 'prediction_type', 'timeframe_days']);
    })
    
    // Create ml_model_metrics table for tracking model performance
    .createTable('ml_model_metrics', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('model_name').notNullable();
      table.string('model_version').notNullable();
      table.enu('prediction_type', ['price', 'sellout', 'roi', 'hype']).notNullable();
      table.decimal('accuracy', 5, 4); // 0-1 accuracy score
      table.decimal('precision', 5, 4); // 0-1 precision score
      table.decimal('recall', 5, 4); // 0-1 recall score
      table.decimal('f1_score', 5, 4); // 0-1 F1 score
      table.decimal('mean_absolute_error', 10, 4);
      table.decimal('root_mean_square_error', 10, 4);
      table.integer('training_data_size');
      table.integer('prediction_count').defaultTo(0);
      table.decimal('avg_processing_time', 8, 2); // milliseconds
      table.timestamp('last_trained_at');
      table.timestamp('last_evaluated_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.index(['model_name', 'model_version']);
      table.index('prediction_type');
      table.index('last_evaluated_at');
    })
    
    // Create engagement_metrics table for hype calculation
    .createTable('engagement_metrics', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
      table.integer('watch_count').defaultTo(0);
      table.integer('alert_count').defaultTo(0);
      table.integer('click_count').defaultTo(0);
      table.decimal('click_through_rate', 5, 2).defaultTo(0); // percentage
      table.integer('search_volume').defaultTo(0);
      table.integer('social_mentions').defaultTo(0);
      table.decimal('engagement_score', 5, 2).defaultTo(0); // 0-100
      table.enu('trend_direction', ['rising', 'falling', 'stable']).defaultTo('stable');
      table.date('metrics_date').notNullable(); // Daily metrics
      table.timestamp('calculated_at').defaultTo(knex.fn.now());
      
      table.unique(['product_id', 'metrics_date']);
      table.index('product_id');
      table.index('metrics_date');
      table.index(['product_id', 'metrics_date']);
    })
    
    // Create seasonal_patterns table for seasonal trend analysis
    .createTable('seasonal_patterns', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('product_id').references('id').inTable('products').onDelete('CASCADE');
      table.uuid('category_id').references('id').inTable('product_categories').onDelete('CASCADE');
      table.string('pattern_type').notNullable(); // 'quarterly', 'monthly', 'holiday', etc.
      table.string('pattern_name').notNullable(); // 'Q1', 'December', 'Black Friday', etc.
      table.decimal('avg_price_change', 5, 2); // percentage change
      table.decimal('availability_change', 5, 2); // percentage change
      table.decimal('demand_multiplier', 4, 2).defaultTo(1.0);
      table.integer('historical_occurrences').defaultTo(1);
      table.decimal('confidence', 5, 2); // 0-100 confidence in pattern
      table.timestamp('last_updated').defaultTo(knex.fn.now());
      
      table.index(['product_id', 'pattern_type']);
      table.index(['category_id', 'pattern_type']);
      table.index('pattern_name');
    })
    
    // Create data_quality_metrics table for monitoring data quality
    .createTable('data_quality_metrics', function (table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('product_id').references('id').inTable('products').onDelete('CASCADE');
      table.string('data_source').notNullable(); // 'price_history', 'availability', 'engagement'
      table.decimal('completeness_score', 5, 2); // 0-100 percentage
      table.decimal('freshness_hours', 8, 2); // Hours since last update
      table.decimal('accuracy_score', 5, 2); // 0-100 percentage
      table.jsonb('missing_fields').defaultTo(JSON.stringify([]));
      table.decimal('overall_quality_score', 5, 2); // 0-100 composite score
      table.jsonb('recommendations').defaultTo(JSON.stringify([]));
      table.timestamp('assessed_at').defaultTo(knex.fn.now());
      
      table.index(['product_id', 'data_source']);
      table.index('assessed_at');
      table.index('overall_quality_score');
    });
};

/**
 * Rollback ML tables
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('data_quality_metrics')
    .dropTableIfExists('seasonal_patterns')
    .dropTableIfExists('engagement_metrics')
    .dropTableIfExists('ml_model_metrics')
    .dropTableIfExists('ml_predictions')
    .dropTableIfExists('trend_analysis')
    .dropTableIfExists('availability_snapshots');
};