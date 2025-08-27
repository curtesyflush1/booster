/**
 * Seed subscription plans
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Clear existing entries
  await knex('subscription_plans').del();

  // Insert default subscription plans
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
        'Up to 5 product watches',
        'Basic email alerts',
        'Web push notifications',
        'Community support'
      ]),
      limits: JSON.stringify({
        max_watches: 5,
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
      name: 'Pro Monthly',
      slug: 'pro-monthly',
      description: 'Unlimited alerts for serious collectors',
      price: 9.99,
      billing_period: 'monthly',
      stripe_price_id: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
      features: JSON.stringify([
        'Unlimited product watches',
        'Priority alerts (5-second delivery)',
        'SMS notifications',
        'Discord integration',
        'Advanced filtering',
        'Price history & analytics',
        'Browser extension access',
        'Priority support'
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
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Pro Yearly',
      slug: 'pro-yearly',
      description: 'Unlimited alerts with 2 months free',
      price: 99.99,
      billing_period: 'yearly',
      stripe_price_id: process.env.STRIPE_PRO_YEARLY_PRICE_ID || 'price_pro_yearly',
      features: JSON.stringify([
        'Unlimited product watches',
        'Priority alerts (5-second delivery)',
        'SMS notifications',
        'Discord integration',
        'Advanced filtering',
        'Price history & analytics',
        'Browser extension access',
        'Priority support',
        '2 months free (17% savings)'
      ]),
      limits: JSON.stringify({
        max_watches: null,
        max_alerts_per_day: null,
        api_rate_limit: null
      }),
      is_active: true,
      trial_days: 14,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);
};