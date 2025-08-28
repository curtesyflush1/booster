const bcrypt = require('bcrypt');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Check if admin user already exists
  const existingAdmin = await knex('users').where('email', 'admin@boosterbeacon.com').first();
  
  if (!existingAdmin) {
    // Hash password for admin user
    const hashedPassword = await bcrypt.hash('admin123!@#', 12);
    
    // Insert admin user
    await knex('users').insert({
      id: knex.raw('gen_random_uuid()'),
      email: 'admin@boosterbeacon.com',
      password_hash: hashedPassword,
      role: 'super_admin',
      subscription_tier: 'pro',
      first_name: 'Admin',
      last_name: 'User',
      email_verified: true,
      admin_permissions: JSON.stringify([
        'user_management',
        'user_suspend',
        'user_delete',
        'ml_model_training',
        'ml_data_review',
        'system_monitoring',
        'analytics_view',
        'audit_log_view'
      ]),
      shipping_addresses: JSON.stringify([]),
      payment_methods: JSON.stringify([]),
      retailer_credentials: JSON.stringify({}),
      notification_settings: JSON.stringify({
        web_push: true,
        email: true,
        sms: true,
        discord: true
      }),
      quiet_hours: JSON.stringify({
        enabled: false,
        start_time: '22:00',
        end_time: '08:00',
        timezone: 'UTC',
        days: []
      }),
      timezone: 'UTC',
      preferences: JSON.stringify({}),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    });

    console.log('Admin user created: admin@boosterbeacon.com / admin123!@#');
  } else {
    console.log('Admin user already exists');
  }

  // Insert some sample ML models for testing
  const existingModel = await knex('ml_models').where('name', 'price_prediction').first();
  
  if (!existingModel) {
    await knex('ml_models').insert([
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'price_prediction',
        version: 'v1.0',
        status: 'active',
        config: JSON.stringify({
          algorithm: 'ARIMA',
          lookback_days: 30,
          forecast_days: 7
        }),
        metrics: JSON.stringify({
          accuracy: 0.85,
          mae: 2.34,
          rmse: 3.12
        }),
        training_started_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        training_completed_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        deployed_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'sellout_risk',
        version: 'v1.2',
        status: 'active',
        config: JSON.stringify({
          algorithm: 'Random Forest',
          features: ['price_history', 'availability_patterns', 'user_engagement']
        }),
        metrics: JSON.stringify({
          accuracy: 0.92,
          precision: 0.89,
          recall: 0.94
        }),
        training_started_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        training_completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        deployed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'roi_estimation',
        version: 'v0.8',
        status: 'training',
        config: JSON.stringify({
          algorithm: 'LSTM',
          sequence_length: 14,
          hidden_units: 128
        }),
        metrics: JSON.stringify({}),
        training_started_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      }
    ]);

    console.log('Sample ML models created');
  }

  // Insert some sample training data
  const existingTrainingData = await knex('ml_training_data').first();
  
  if (!existingTrainingData) {
    await knex('ml_training_data').insert([
      {
        id: knex.raw('gen_random_uuid()'),
        dataset_name: 'pokemon_tcg_prices_q4_2024',
        data_type: 'price_history',
        data: JSON.stringify({
          products: ['charizard_151', 'pikachu_promo'],
          price_points: 1250,
          date_range: '2024-10-01 to 2024-12-31'
        }),
        status: 'pending',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
      {
        id: knex.raw('gen_random_uuid()'),
        dataset_name: 'availability_patterns_holiday_2024',
        data_type: 'availability_patterns',
        data: JSON.stringify({
          retailers: ['best_buy', 'walmart', 'costco'],
          pattern_count: 890,
          seasonal_factor: 'holiday_rush'
        }),
        status: 'approved',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      }
    ]);

    console.log('Sample training data created');
  }

  // Insert some system health records
  const existingHealth = await knex('system_health').first();
  
  if (!existingHealth) {
    await knex('system_health').insert([
      {
        id: knex.raw('gen_random_uuid()'),
        service_name: 'api_server',
        status: 'healthy',
        metrics: JSON.stringify({
          response_time: 45,
          error_rate: 0.02,
          uptime_percentage: 99.8
        }),
        checked_at: knex.fn.now()
      },
      {
        id: knex.raw('gen_random_uuid()'),
        service_name: 'database',
        status: 'healthy',
        metrics: JSON.stringify({
          connection_pool: 8,
          query_time: 12,
          uptime_percentage: 99.9
        }),
        checked_at: knex.fn.now()
      },
      {
        id: knex.raw('gen_random_uuid()'),
        service_name: 'retailer_monitoring',
        status: 'healthy',
        metrics: JSON.stringify({
          active_monitors: 4,
          success_rate: 98.5,
          avg_check_time: 2.3
        }),
        checked_at: knex.fn.now()
      }
    ]);

    console.log('Sample system health records created');
  }
};