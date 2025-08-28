import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Store, Bell, Clock, ArrowRight } from 'lucide-react';
import SEOHead from '../components/SEOHead';
import { generateLocationKeywords, generateLocalBusinessStructuredData } from '../utils/seo';

interface LocationData {
  city: string;
  state: string;
  stateCode: string;
  zipCodes: string[];
  majorStores: Array<{
    name: string;
    address: string;
    phone?: string;
    hours?: string;
  }>;
}

/**
 * Location-based landing page for local SEO
 * Targets location-specific Pokémon TCG searches
 */
const LocationBasedPage: React.FC = () => {
  const { city, state } = useParams<{ city: string; state: string }>();
  const [locationData, setLocationData] = useState<LocationData | null>(null);

  // Mock location data - in production, this would come from an API
  useEffect(() => {
    if (city && state) {
      // Simulate API call for location data
      const mockLocationData: LocationData = {
        city: city.replace('-', ' '),
        state: state.replace('-', ' '),
        stateCode: state.toUpperCase().substring(0, 2),
        zipCodes: ['12345', '12346', '12347'], // Mock zip codes
        majorStores: [
          {
            name: 'Best Buy',
            address: `123 Main St, ${city.replace('-', ' ')}, ${state.toUpperCase()} 12345`,
            phone: '(555) 123-4567',
            hours: 'Mon-Sat: 10AM-9PM, Sun: 11AM-7PM'
          },
          {
            name: 'Walmart Supercenter',
            address: `456 Shopping Blvd, ${city.replace('-', ' ')}, ${state.toUpperCase()} 12346`,
            phone: '(555) 234-5678',
            hours: '24 Hours'
          },
          {
            name: 'Target',
            address: `789 Retail Way, ${city.replace('-', ' ')}, ${state.toUpperCase()} 12347`,
            phone: '(555) 345-6789',
            hours: 'Mon-Sun: 8AM-10PM'
          }
        ]
      };
      setLocationData(mockLocationData);
    }
  }, [city, state]);

  if (!locationData || !city || !state) {
    return <div>Loading...</div>;
  }

  const seoConfig = {
    title: `Pokémon TCG Alerts in ${locationData.city}, ${locationData.stateCode}`,
    description: `Get instant Pokémon TCG restock alerts for stores in ${locationData.city}, ${locationData.state}. Track Best Buy, Walmart, Target, and local game stores for the latest Pokémon card drops.`,
    keywords: [
      ...generateLocationKeywords(locationData.city, locationData.state),
      `pokemon tcg ${locationData.city}`,
      `pokemon cards ${locationData.city} ${locationData.stateCode}`,
      `pokemon store ${locationData.city}`,
      `tcg alerts ${locationData.city}`
    ],
    canonical: `/locations/${city}/${state}`,
    ogImage: `/images/locations/${city}-${state}-og.png`
  };

  // Generate structured data for local businesses
  const localBusinessData = locationData.majorStores.map(store =>
    generateLocalBusinessStructuredData({
      name: `${store.name} - ${locationData.city}`,
      address: store.address.split(',')[0],
      city: locationData.city,
      state: locationData.stateCode,
      zipCode: store.address.match(/\d{5}/)?.[0] || '00000',
      phone: store.phone
    })
  );

  return (
    <>
      <SEOHead 
        {...seoConfig} 
        structuredData={localBusinessData[0]} // Use first store for main structured data
      />
      
      <div className="min-h-screen bg-background-primary">
        {/* Hero Section */}
        <section className="relative py-20 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="flex items-center justify-center mb-6">
                <MapPin className="w-8 h-8 text-pokemon-electric mr-3" />
                <span className="text-lg text-gray-400">
                  {locationData.city}, {locationData.stateCode}
                </span>
              </div>
              
              <h1 className="text-4xl lg:text-6xl font-display font-bold text-white mb-6">
                Pokémon TCG Alerts in{' '}
                <span className="text-gradient-pokemon">
                  {locationData.city}
                </span>
              </h1>
              
              <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto">
                Never miss a Pokémon TCG restock in {locationData.city}, {locationData.state}. 
                Get instant alerts when your local Best Buy, Walmart, Target, and game stores 
                get new Pokémon cards in stock.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Link
                  to="/register"
                  className="btn btn-pokemon-electric text-lg px-8 py-3"
                >
                  Start Local Alerts
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
                <Link
                  to="/pricing"
                  className="btn btn-outline text-lg px-8 py-3"
                >
                  View Pro Features
                </Link>
              </div>

              {/* Local Stats */}
              <div className="flex items-center justify-center space-x-8 text-gray-500">
                <div className="flex items-center space-x-2">
                  <Store className="w-5 h-5" />
                  <span>{locationData.majorStores.length}+ Stores Monitored</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Bell className="w-5 h-5" />
                  <span>Real-time Alerts</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span>24/7 Monitoring</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Local Stores */}
        <section className="py-20 bg-background-secondary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-display font-bold text-white mb-4">
                Pokémon TCG Stores in {locationData.city}
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                We monitor these major retailers in {locationData.city} for Pokémon TCG restocks and new releases.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {locationData.majorStores.map((store, index) => (
                <div key={index} className="card-dark p-6">
                  <div className="flex items-center mb-4">
                    <Store className="w-6 h-6 text-pokemon-electric mr-3" />
                    <h3 className="text-xl font-bold text-white">
                      {store.name}
                    </h3>
                  </div>
                  
                  <div className="space-y-3 text-gray-400">
                    <div className="flex items-start">
                      <MapPin className="w-4 h-4 mt-1 mr-2 text-gray-500 flex-shrink-0" />
                      <span className="text-sm">{store.address}</span>
                    </div>
                    
                    {store.phone && (
                      <div className="flex items-center">
                        <span className="w-4 h-4 mr-2 text-gray-500">📞</span>
                        <span className="text-sm">{store.phone}</span>
                      </div>
                    )}
                    
                    {store.hours && (
                      <div className="flex items-start">
                        <Clock className="w-4 h-4 mt-1 mr-2 text-gray-500 flex-shrink-0" />
                        <span className="text-sm">{store.hours}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pokemon-electric text-background-primary">
                      Monitored 24/7
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Local Benefits */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-display font-bold text-white mb-4">
                Why {locationData.city} Collectors Choose BoosterBeacon
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Local advantages for Pokémon TCG collectors in {locationData.city}, {locationData.state}.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="card-dark p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 bg-pokemon-electric rounded-lg flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-background-primary" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Local Store Focus
                </h3>
                <p className="text-gray-400 text-sm">
                  Specifically monitor stores in {locationData.city} and surrounding areas for the most relevant alerts.
                </p>
              </div>

              <div className="card-dark p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 bg-pokemon-water rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Store Hours Aware
                </h3>
                <p className="text-gray-400 text-sm">
                  Alerts are timed based on local store hours and {locationData.stateCode} time zone for optimal shopping.
                </p>
              </div>

              <div className="card-dark p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 bg-pokemon-grass rounded-lg flex items-center justify-center">
                  <Store className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  In-Store Pickup
                </h3>
                <p className="text-gray-400 text-sm">
                  Get alerts for in-store pickup availability at {locationData.city} locations to avoid shipping delays.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Coverage Area */}
        <section className="py-20 bg-background-secondary">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-4xl font-display font-bold text-white mb-4">
              Coverage Area
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              We monitor Pokémon TCG inventory across {locationData.city} and surrounding areas.
            </p>
            
            <div className="bg-background-primary rounded-2xl p-8 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">
                Zip Codes Covered
              </h3>
              <div className="flex flex-wrap justify-center gap-3">
                {locationData.zipCodes.map((zip, index) => (
                  <span key={index} className="badge badge-info">
                    {zip}
                  </span>
                ))}
                <span className="badge badge-outline">
                  + Surrounding Areas
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-4xl font-display font-bold text-white mb-4">
              Start Getting Local Pokémon TCG Alerts
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              Join {locationData.city} collectors who never miss a restock at their local stores.
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

export default LocationBasedPage;