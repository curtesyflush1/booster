import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Bell, 
  ShoppingCart, 
  Shield, 
  Star, 
  ArrowRight,
  Crown,
  Users,
  TrendingUp
} from 'lucide-react';
import SEOHead from '../components/SEOHead';
import SocialLinks from '../components/SocialLinks';
import { generateWebsiteStructuredData } from '../utils/seo';

const HomePage: React.FC = () => {
  const seoConfig = {
    title: 'Never Miss a Pokémon TCG Drop Again',
    description: 'Get instant alerts when Pokémon TCG products restock at major retailers. Real-time notifications with one-tap cart links for collectors.',
    keywords: [
      'pokemon tcg',
      'pokemon cards',
      'restock alerts',
      'collector alerts',
      'booster packs',
      'pokemon drops',
      'tcg monitoring',
      'card alerts',
      'pokemon notifications'
    ],
    structuredData: generateWebsiteStructuredData()
  };
  const features = [
    {
      icon: Bell,
      title: 'Real-time Alerts',
      description: 'Get notified within 5 seconds when your watched Pokémon TCG products restock at major retailers.',
      color: 'text-pokemon-electric'
    },
    {
      icon: ShoppingCart,
      title: 'One-tap Cart Links',
      description: 'Official add-to-cart deep links get you to checkout faster than anyone else.',
      color: 'text-pokemon-fire'
    },
    {
      icon: Shield,
      title: 'Retailer Compliant',
      description: 'We prioritize official APIs and respectful monitoring practices to keep you safe.',
      color: 'text-pokemon-water'
    },
    {
      icon: TrendingUp,
      title: 'Price Predictions',
      description: 'ML-powered insights help you make informed purchasing decisions with ROI estimates.',
      color: 'text-pokemon-psychic'
    }
  ];

  const retailers = [
    { name: 'Best Buy', status: 'API' },
    { name: 'Walmart', status: 'Affiliate' },
    { name: 'Costco', status: 'Monitor' },
    { name: "Sam's Club", status: 'Monitor' },
    { name: 'Target', status: 'Monitor' },
    { name: 'GameStop', status: 'Monitor' }
  ];

  const testimonials = [
    {
      name: 'Alex Chen',
      role: 'TCG Collector',
      content: 'Finally caught the Charizard UPC restock thanks to BoosterBeacon! The alerts are lightning fast.',
      rating: 5
    },
    {
      name: 'Sarah Martinez',
      role: 'Store Owner',
      content: 'The Pro features help me track inventory trends and make better purchasing decisions for my shop.',
      rating: 5
    },
    {
      name: 'Mike Johnson',
      role: 'Competitive Player',
      content: 'Never missed a tournament-legal set release since using BoosterBeacon. Game changer!',
      rating: 5
    }
  ];

  return (
    <>
      <SEOHead {...seoConfig} />
      <div className="min-h-screen bg-background-primary">
      {/* Navigation */}
      <nav className="bg-background-secondary border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <img src="/images/brand/boosterbeacon-icon.svg" alt="BoosterBeacon" className="h-8 w-8 animate-glow" />
              <span className="text-xl font-display font-bold text-white">
                BoosterBeacon
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link
                to="/pricing"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Pricing
              </Link>
              <Link
                to="/login"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="btn btn-pokemon-electric"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl lg:6xl font-display font-bold text-white mb-6">
              Never Miss a{' '}
              <span className="text-gradient-pokemon">
                Pokémon TCG Drop
              </span>{' '}
              Again
            </h1>
            
            <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto">
              Get instant alerts when Pokémon TCG products restock at major retailers. 
              Real-time notifications with one-tap cart links for serious collectors.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
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
                View Pricing
              </Link>
            </div>

            {/* Social Proof */}
            <div className="flex items-center justify-center space-x-8 text-gray-500">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>10,000+ Collectors</span>
              </div>
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span>1M+ Alerts Sent</span>
              </div>
              <div className="flex items-center space-x-2">
                <Star className="w-5 h-5" />
                <span>4.9/5 Rating</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-display font-bold text-white mb-4">
              Built for Serious Collectors
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Every feature designed to give you the competitive edge in the fast-paced world of Pokémon TCG collecting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="card-dark p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-4 bg-background-primary rounded-lg flex items-center justify-center">
                    <Icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Retailers Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-display font-bold text-white mb-4">
              Monitor All Major Retailers
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              We track inventory across the biggest Pokémon TCG retailers with transparent data sources.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {retailers.map((retailer, index) => (
              <div key={index} className="card-dark p-6 text-center">
                <h3 className="text-lg font-semibold text-white mb-2">
                  {retailer.name}
                </h3>
                <span className={`badge ${
                  retailer.status === 'API' ? 'badge-success' :
                  retailer.status === 'Affiliate' ? 'badge-info' :
                  'badge-warning'
                }`}>
                  {retailer.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-background-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-display font-bold text-white mb-4">
              Loved by Collectors
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Join thousands of collectors who never miss a drop.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="card-dark p-6">
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-pokemon-electric fill-current" />
                  ))}
                </div>
                <p className="text-gray-300 mb-4">
                  "{testimonial.content}"
                </p>
                <div>
                  <div className="font-semibold text-white">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-gray-400">
                    {testimonial.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-display font-bold text-white mb-4">
            Ready to Catch 'Em All?
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Start your free trial today and never miss another Pokémon TCG drop.
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
              <Crown className="w-5 h-5 mr-2" />
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background-secondary border-t border-gray-700 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <img src="/images/brand/boosterbeacon-icon.svg" alt="BoosterBeacon" className="h-8 w-8" />
              <span className="text-xl font-display font-bold text-white">BoosterBeacon</span>
            </div>
            
            <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
              <div className="flex items-center space-x-6 text-gray-400">
                <Link to="/privacy" className="hover:text-white transition-colors">
                  Privacy
                </Link>
                <Link to="/terms" className="hover:text-white transition-colors">
                  Terms
                </Link>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Contact
                </Link>
              </div>
              
              {/* Social Media Links */}
              <SocialLinks size="sm" />
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-700 text-center text-gray-500">
            <p>&copy; 2024 BoosterBeacon. All rights reserved.</p>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
};

export default HomePage;
