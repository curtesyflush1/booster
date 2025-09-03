import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, Zap, ShoppingCart, TrendingUp, Star, ArrowRight } from 'lucide-react';
import SEOHead from '../components/SEOHead';
import SocialShare from '../components/SocialShare';
import { POKEMON_TCG_KEYWORDS } from '../utils/seo';

/**
 * SEO-optimized landing page for Pokémon TCG alerts
 * Targets keywords: "pokemon tcg alerts", "pokemon card alerts", "pokemon restock alerts"
 */
const PokemonTCGAlertsPage: React.FC = () => {
  const seoConfig = {
    title: 'Pokémon TCG Alerts - Real-Time Restock Notifications',
    description: 'Get instant Pokémon TCG alerts when cards and booster packs restock at Best Buy, Walmart, Costco, and Sam\'s Club. Never miss a drop again with real-time notifications.',
    keywords: [
      ...POKEMON_TCG_KEYWORDS.alerts,
      ...POKEMON_TCG_KEYWORDS.products,
      'pokemon tcg notifications',
      'pokemon card tracker',
      'pokemon inventory alerts'
    ],
    canonical: '/pokemon-tcg-alerts',
    ogImage: '/images/pokemon-tcg-alerts-og.png'
  };

  const alertFeatures = [
    {
      icon: Bell,
      title: 'Instant Notifications',
      description: 'Get alerted within 5 seconds when Pokémon TCG products restock at major retailers.',
      benefits: ['Sub-5 second alerts', 'Multi-channel delivery', 'Smart deduplication']
    },
    {
      icon: ShoppingCart,
      title: 'Direct Cart Links',
      description: 'One-tap add-to-cart links get you to checkout faster than manual searching.',
      benefits: ['Official retailer links', 'Bypass search delays', 'Instant purchasing']
    },
    {
      icon: TrendingUp,
      title: 'Price Tracking',
      description: 'Monitor price changes and get alerts when products drop below your target price.',
      benefits: ['Historical price data', 'Price drop alerts', 'Deal notifications']
    }
  ];

  const supportedProducts = [
    'Booster Packs & Boxes',
    'Elite Trainer Boxes',
    'Collection Boxes',
    'Tins & Bundles',
    'Starter Decks',
    'Premium Collections',
    'Special Sets',
    'Tournament Supplies'
  ];

  const retailers = [
    { name: 'Best Buy', type: 'Official API', speed: '< 5 seconds' },
    { name: 'Walmart', type: 'Affiliate Feed', speed: '< 10 seconds' },
    { name: 'Costco', type: 'Monitor', speed: '< 30 seconds' },
    { name: 'Sam\'s Club', type: 'Monitor', speed: '< 30 seconds' },
    { name: 'Target', type: 'Monitor', speed: '< 30 seconds' },
    { name: 'GameStop', type: 'Monitor', speed: '< 30 seconds' }
  ];

  const faqs = [
    {
      question: 'How fast are Pokémon TCG restock alerts?',
      answer: 'Our alerts are delivered within 5 seconds for retailers with official APIs like Best Buy, and within 30 seconds for monitored retailers like Costco and Sam\'s Club.'
    },
    {
      question: 'Which Pokémon TCG products can I track?',
      answer: 'You can track all Pokémon TCG products including booster packs, Elite Trainer Boxes, collection boxes, tins, bundles, and special releases from major retailers.'
    },
    {
      question: 'Do you provide direct purchase links?',
      answer: 'Yes! We provide official add-to-cart links when available, or direct product page links to help you purchase items as quickly as possible.'
    },
    {
      question: 'Is the service compliant with retailer terms?',
      answer: 'Absolutely. We prioritize official APIs and affiliate feeds, and use respectful monitoring practices that comply with all retailer terms of service.'
    }
  ];

  return (
    <>
      <SEOHead {...seoConfig} faqs={faqs} />
      
      <div className="min-h-screen bg-background-primary">
        {/* Hero Section */}
        <section className="relative py-20 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl lg:text-6xl font-display font-bold text-white mb-6">
                Pokémon TCG{' '}
                <span className="text-gradient-pokemon">
                  Restock Alerts
                </span>
              </h1>
              
              <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto">
                Never miss another Pokémon TCG drop. Get instant alerts when booster packs, 
                Elite Trainer Boxes, and special collections restock at Best Buy, Walmart, 
                Costco, and Sam's Club.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Link
                  to="/register"
                  className="btn btn-pokemon-electric text-lg px-8 py-3"
                >
                  Start Free Alerts
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
                <Link
                  to="/pricing"
                  className="btn btn-outline text-lg px-8 py-3"
                >
                  View Pro Features
                </Link>
              </div>

              {/* Social Proof */}
              <div className="flex items-center justify-center space-x-8 text-gray-500 mb-8">
                <div className="flex items-center space-x-2">
                  <Bell className="w-5 h-5" />
                  <span>1M+ Alerts Sent</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Star className="w-5 h-5" />
                  <span>4.9/5 Rating</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5" />
                  <span>Sub-5s Delivery</span>
                </div>
              </div>

              {/* Social Share */}
              <SocialShare
                title="Pokémon TCG Alerts - Never Miss a Restock"
                description="Get instant notifications when Pokémon cards restock at major retailers"
                className="justify-center"
              />
            </div>
          </div>
        </section>

        {/* Alert Features */}
        <section className="py-20 bg-background-secondary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-display font-bold text-white mb-4">
                Advanced Pokémon TCG Alert System
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Our intelligent alert system is designed specifically for Pokémon TCG collectors 
                who need to act fast on restocks and new releases.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {alertFeatures.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div key={index} className="card-dark p-8">
                    <div className="w-16 h-16 mx-auto mb-6 bg-gradient-pokemon rounded-2xl flex items-center justify-center">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4 text-center">
                      {feature.title}
                    </h3>
                    <p className="text-gray-400 mb-6 text-center">
                      {feature.description}
                    </p>
                    <ul className="space-y-2">
                      {feature.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-center text-gray-300">
                          <span className="text-pokemon-electric mr-3">✓</span>
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Supported Products */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-display font-bold text-white mb-4">
                Track All Pokémon TCG Products
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Monitor every type of Pokémon TCG product from booster packs to premium collections.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {supportedProducts.map((product, index) => (
                <div key={index} className="card-dark p-6 text-center">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {product}
                  </h3>
                  <div className="w-12 h-1 bg-gradient-pokemon mx-auto rounded-full"></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Retailers */}
        <section className="py-20 bg-background-secondary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-display font-bold text-white mb-4">
                Monitor Major Pokémon TCG Retailers
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                We track inventory across all the biggest Pokémon TCG retailers with transparent data sources.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {retailers.map((retailer, index) => (
                <div key={index} className="card-dark p-6 text-center">
                  <h3 className="text-xl font-bold text-white mb-2">
                    {retailer.name}
                  </h3>
                  <div className="mb-3">
                    <span className={`badge ${
                      retailer.type === 'Official API' ? 'badge-success' :
                      retailer.type === 'Affiliate Feed' ? 'badge-info' :
                      'badge-warning'
                    }`}>
                      {retailer.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">
                    Alert Speed: {retailer.speed}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-display font-bold text-white mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-xl text-gray-400">
                Everything you need to know about Pokémon TCG alerts
              </p>
            </div>

            <div className="space-y-6">
              {faqs.map((faq, index) => (
                <div key={index} className="card-dark p-6">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    {faq.question}
                  </h3>
                  <p className="text-gray-400">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-background-secondary">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-4xl font-display font-bold text-white mb-4">
              Start Getting Pokémon TCG Alerts Today
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              Join thousands of collectors who never miss a restock with BoosterBeacon alerts.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="btn btn-pokemon-electric text-lg px-8 py-3"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
              <Link
                to="/pricing"
                className="btn btn-outline text-lg px-8 py-3"
              >
                View Pro Features
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default PokemonTCGAlertsPage;
