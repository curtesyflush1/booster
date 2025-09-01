import React from 'react';

const TermsPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-display font-bold text-white mb-4">Terms of Service</h1>
      <p className="text-gray-300 mb-4">Last updated: {new Date().toISOString().split('T')[0]}</p>
      <div className="prose prose-invert">
        <p>
          These Terms govern your use of BoosterBeacon. By accessing the site, you agree to these terms.
        </p>
        <ul>
          <li>Use BoosterBeacon responsibly and comply with applicable laws.</li>
          <li>Do not attempt to misuse the service or infringe on third-party rights.</li>
          <li>Subscriptions renew according to Stripe’s terms; cancel anytime via your account.</li>
        </ul>
      </div>
    </div>
  );
};

export default TermsPage;

