import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="mt-16 border-t border-gray-700 bg-background-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="text-gray-400 text-sm">
            © {new Date().getFullYear()} BoosterBeacon. All rights reserved.
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <Link className="text-gray-300 hover:text-white" to="/pricing">Pricing</Link>
            <Link className="text-gray-300 hover:text-white" to="/contact">Contact</Link>
            <Link className="text-gray-300 hover:text-white" to="/terms">Terms</Link>
            <Link className="text-gray-300 hover:text-white" to="/privacy">Privacy</Link>
            <Link className="text-gray-300 hover:text-white" to="/sitemap">Sitemap</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

