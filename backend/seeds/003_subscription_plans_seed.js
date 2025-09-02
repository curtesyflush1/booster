/**
 * Seed subscription plans
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Clear existing entries
  await knex('subscription_plans').del();

  // Insert default subscription plans (Free, Pro Monthly, Premium Monthly)
  await knex('subscription_plans').insert([
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Free',
      slug: 'free',
      description: 'Basic alerts for casual collectors',
      price: 0.00,
      billing_period: 'monthly',
      stripe_price_id: null,
      features: JSON.stringify([
        'Up to 2 product watches',
        'Basic email alerts',
        'Web push notifications',
        'Community support'
      ]),
      limits: JSON.stringify({
        max_watches: 2,
        max_alerts_per_day: 50,
        api_rate_limit: 1000
      }),
      is_active: true,
      trial_days: 0,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Pro',
      slug: 'pro-monthly',
      description: 'Advanced features with limited auto-purchase and ML insights',
      price: 40.00,
      billing_period: 'monthly',
      stripe_price_id: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
      features: JSON.stringify([
        'Up to 10 product watches',
        'Higher alert priority',
        'SMS & Discord notifications',
        'Auto-purchase (limited capacity)',
        'ML insights (limited: basic price trend + risk)',
        'Extended price history (12 months)',
        'Advanced filtering',
        'Browser extension access'
      ]),
      limits: JSON.stringify({
        max_watches: 10,
        max_alerts_per_day: null,
        api_rate_limit: null
      }),
      is_active: true,
      trial_days: 7,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Premium',
      slug: 'premium-monthly',
      description: 'Full auto-purchase, full ML, and highest queue priority',
      price: 100.00,
      billing_period: 'monthly',
      stripe_price_id: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || 'price_premium_monthly',
      features: JSON.stringify([
        'Unlimited product watches',
        'Fastest alert delivery and queue priority',
        'SMS & Discord notifications',
        'Auto-purchase (full capacity & priority)',
        'Full ML: price predictions, sellout risk, ROI',
        'Full price history access',
        'Advanced filtering',
        'Browser extension access',
        'Premium support',
        'One-time $300 setup fee'
      ]),
      limits: JSON.stringify({
        max_watches: null,
        max_alerts_per_day: null,
        api_rate_limit: null
      }),
      is_active: true,
      trial_days: 7,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);
};
