import React from 'react';
import { Link } from 'react-router-dom';

const SiteMapPage: React.FC = () => {
  const links = [
    { to: '/', label: 'Home' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/products', label: 'Products' },
    { to: '/watches', label: 'My Watches' },
    { to: '/alerts', label: 'Alerts' },
    { to: '/pricing', label: 'Pricing' },
    { to: '/subscription', label: 'Subscription' },
    { to: '/contact', label: 'Contact' },
    { to: '/terms', label: 'Terms of Service' },
    { to: '/privacy', label: 'Privacy Policy' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-display font-bold text-white mb-6">Sitemap</h1>
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.to}>
            <Link className="text-pokemon-electric" to={l.to}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SiteMapPage;

