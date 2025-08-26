/**
 * Seed data for product catalog - Pokémon TCG products
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function(knex) {
  // Clear existing data
  await knex('product_availability').del();
  await knex('products').del();
  await knex('product_categories').del();
  await knex('retailers').del();

  // Insert retailers
  const retailers = [
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Best Buy',
      slug: 'best-buy',
      website_url: 'https://www.bestbuy.com',
      api_type: 'official',
      api_config: JSON.stringify({
        api_key: 'placeholder',
        base_url: 'https://api.bestbuy.com/v1'
      }),
      is_active: true,
      rate_limit_per_minute: 60,
      health_score: 95,
      supported_features: JSON.stringify(['cart_links', 'inventory_check', 'price_tracking']),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Walmart',
      slug: 'walmart',
      website_url: 'https://www.walmart.com',
      api_type: 'affiliate',
      api_config: JSON.stringify({
        affiliate_id: 'placeholder',
        api_key: 'placeholder'
      }),
      is_active: true,
      rate_limit_per_minute: 100,
      health_score: 90,
      supported_features: JSON.stringify(['affiliate_links', 'price_tracking']),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Costco',
      slug: 'costco',
      website_url: 'https://www.costco.com',
      api_type: 'scraping',
      api_config: JSON.stringify({
        base_url: 'https://www.costco.com',
        user_agent: 'BoosterBeacon/1.0'
      }),
      is_active: true,
      rate_limit_per_minute: 30,
      health_score: 85,
      supported_features: JSON.stringify(['price_tracking']),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: "Sam's Club",
      slug: 'sams-club',
      website_url: 'https://www.samsclub.com',
      api_type: 'scraping',
      api_config: JSON.stringify({
        base_url: 'https://www.samsclub.com',
        user_agent: 'BoosterBeacon/1.0'
      }),
      is_active: true,
      rate_limit_per_minute: 30,
      health_score: 80,
      supported_features: JSON.stringify(['price_tracking']),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ];

  const insertedRetailers = await knex('retailers').insert(retailers).returning('*');

  // Insert product categories
  const categories = [
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Booster Boxes',
      slug: 'booster-boxes',
      description: 'Complete booster boxes containing multiple booster packs',
      parent_id: null,
      sort_order: 1,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Booster Packs',
      slug: 'booster-packs',
      description: 'Individual booster packs',
      parent_id: null,
      sort_order: 2,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Elite Trainer Boxes',
      slug: 'elite-trainer-boxes',
      description: 'Elite Trainer Boxes with booster packs and accessories',
      parent_id: null,
      sort_order: 3,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Collection Boxes',
      slug: 'collection-boxes',
      description: 'Special collection boxes and premium products',
      parent_id: null,
      sort_order: 4,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Starter Decks',
      slug: 'starter-decks',
      description: 'Theme decks and starter products',
      parent_id: null,
      sort_order: 5,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ];

  const insertedCategories = await knex('product_categories').insert(categories).returning('*');

  // Get category IDs for reference
  const boosterBoxCategory = insertedCategories.find(c => c.slug === 'booster-boxes');
  const boosterPackCategory = insertedCategories.find(c => c.slug === 'booster-packs');
  const etbCategory = insertedCategories.find(c => c.slug === 'elite-trainer-boxes');
  const collectionCategory = insertedCategories.find(c => c.slug === 'collection-boxes');

  // Insert products
  const products = [
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Pokémon Scarlet & Violet Base Set Booster Box',
      slug: 'pokemon-scarlet-violet-base-booster-box',
      sku: 'SV01-BB-EN',
      upc: '820650850011',
      category_id: boosterBoxCategory.id,
      set_name: 'Scarlet & Violet Base Set',
      series: 'Scarlet & Violet',
      release_date: '2023-03-31',
      msrp: 143.64,
      image_url: 'https://images.pokemontcg.io/sv1/logo.png',
      description: 'Scarlet & Violet Base Set Booster Box containing 36 booster packs',
      metadata: JSON.stringify({
        pack_count: 36,
        cards_per_pack: 11,
        set_code: 'SV01',
        language: 'English',
        rarity_distribution: {
          common: 7,
          uncommon: 3,
          rare_or_higher: 1
        }
      }),
      is_active: true,
      popularity_score: 95,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Pokémon Paldea Evolved Booster Box',
      slug: 'pokemon-paldea-evolved-booster-box',
      sku: 'SV02-BB-EN',
      upc: '820650850028',
      category_id: boosterBoxCategory.id,
      set_name: 'Paldea Evolved',
      series: 'Scarlet & Violet',
      release_date: '2023-06-09',
      msrp: 143.64,
      image_url: 'https://images.pokemontcg.io/sv2/logo.png',
      description: 'Paldea Evolved Booster Box containing 36 booster packs',
      metadata: JSON.stringify({
        pack_count: 36,
        cards_per_pack: 11,
        set_code: 'SV02',
        language: 'English'
      }),
      is_active: true,
      popularity_score: 88,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Pokémon 151 Elite Trainer Box',
      slug: 'pokemon-151-elite-trainer-box',
      sku: 'SV3.5-ETB-EN',
      upc: '820650851001',
      category_id: etbCategory.id,
      set_name: 'Pokémon 151',
      series: 'Scarlet & Violet',
      release_date: '2023-09-22',
      msrp: 49.99,
      image_url: 'https://images.pokemontcg.io/sv3pt5/logo.png',
      description: 'Pokémon 151 Elite Trainer Box with 9 booster packs and accessories',
      metadata: JSON.stringify({
        pack_count: 9,
        cards_per_pack: 11,
        set_code: 'SV3.5',
        language: 'English',
        includes: [
          '9 Pokémon 151 booster packs',
          '65 card sleeves',
          '45 Energy cards',
          'Player\'s guide',
          '6 damage-counter dice',
          '1 competition-legal coin-flip die',
          '2 condition markers',
          'Collector\'s box'
        ]
      }),
      is_active: true,
      popularity_score: 100,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Charizard ex Super Premium Collection',
      slug: 'charizard-ex-super-premium-collection',
      sku: 'SV-CHAR-SPC',
      upc: '820650852001',
      category_id: collectionCategory.id,
      set_name: 'Special Collection',
      series: 'Scarlet & Violet',
      release_date: '2023-12-01',
      msrp: 119.99,
      image_url: 'https://images.pokemontcg.io/sv-promo/charizard-ex.png',
      description: 'Charizard ex Super Premium Collection with exclusive cards and accessories',
      metadata: JSON.stringify({
        pack_count: 16,
        set_code: 'SV-PROMO',
        language: 'English',
        includes: [
          '1 foil promo card featuring Charizard ex',
          '1 foil promo card featuring Charmander',
          '1 foil promo card featuring Charmeleon',
          '16 Pokémon TCG booster packs',
          '1 playmat featuring Charizard ex',
          '65 card sleeves featuring Charizard ex',
          '1 metal coin featuring Charizard ex',
          '6 damage-counter dice',
          '1 competition-legal coin-flip die',
          '2 condition markers',
          '1 collector\'s box'
        ]
      }),
      is_active: true,
      popularity_score: 92,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Pokémon Scarlet & Violet Booster Pack',
      slug: 'pokemon-scarlet-violet-booster-pack',
      sku: 'SV01-BP-EN',
      upc: '820650850035',
      category_id: boosterPackCategory.id,
      set_name: 'Scarlet & Violet Base Set',
      series: 'Scarlet & Violet',
      release_date: '2023-03-31',
      msrp: 3.99,
      image_url: 'https://images.pokemontcg.io/sv1/pack.png',
      description: 'Single Scarlet & Violet Base Set booster pack',
      metadata: JSON.stringify({
        cards_per_pack: 11,
        set_code: 'SV01',
        language: 'English'
      }),
      is_active: true,
      popularity_score: 75,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ];

  const insertedProducts = await knex('products').insert(products).returning('*');

  // Insert product availability data
  const availability = [];
  
  for (const product of insertedProducts) {
    for (const retailer of insertedRetailers) {
      // Generate realistic availability data
      const inStock = Math.random() > 0.3; // 70% chance of being in stock
      const basePrice = product.msrp;
      const priceVariation = (Math.random() - 0.5) * 0.2; // ±10% price variation
      const price = Math.round((basePrice * (1 + priceVariation)) * 100) / 100;
      
      availability.push({
        id: knex.raw('gen_random_uuid()'),
        product_id: product.id,
        retailer_id: retailer.id,
        in_stock: inStock,
        price: inStock ? price : null,
        original_price: basePrice,
        availability_status: inStock ? 
          (Math.random() > 0.8 ? 'low_stock' : 'in_stock') : 
          'out_of_stock',
        product_url: `${retailer.website_url}/products/${product.slug}`,
        cart_url: inStock && retailer.api_type === 'official' ? 
          `${retailer.website_url}/cart/add/${product.sku}` : null,
        stock_level: inStock ? Math.floor(Math.random() * 50) + 1 : 0,
        store_locations: JSON.stringify([]),
        last_checked: knex.fn.now(),
        last_in_stock: inStock ? knex.fn.now() : null,
        last_price_change: knex.fn.now(),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
    }
  }

  await knex('product_availability').insert(availability);

  // Insert some price history data
  const priceHistory = [];
  const now = new Date();
  
  for (const product of insertedProducts.slice(0, 3)) { // Only for first 3 products
    for (const retailer of insertedRetailers.slice(0, 2)) { // Only for first 2 retailers
      // Generate 30 days of price history
      for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        const basePrice = product.msrp;
        const priceVariation = (Math.random() - 0.5) * 0.15; // ±7.5% variation
        const price = Math.round((basePrice * (1 + priceVariation)) * 100) / 100;
        const inStock = Math.random() > 0.2; // 80% chance of being in stock historically
        
        priceHistory.push({
          id: knex.raw('gen_random_uuid()'),
          product_id: product.id,
          retailer_id: retailer.id,
          price: price,
          original_price: basePrice,
          in_stock: inStock,
          availability_status: inStock ? 'in_stock' : 'out_of_stock',
          recorded_at: date
        });
      }
    }
  }

  await knex('price_history').insert(priceHistory);

  console.log('✅ Product catalog seed data inserted successfully');
  console.log(`   - ${retailers.length} retailers`);
  console.log(`   - ${categories.length} categories`);
  console.log(`   - ${products.length} products`);
  console.log(`   - ${availability.length} availability records`);
  console.log(`   - ${priceHistory.length} price history records`);
};