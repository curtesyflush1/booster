import React from 'react';

const PrivacyPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-display font-bold text-white mb-4">Privacy Policy</h1>
      <p className="text-gray-300 mb-4">Last updated: {new Date().toISOString().split('T')[0]}</p>
      <div className="prose prose-invert">
        <p>
          We respect your privacy. We collect only necessary information to operate BoosterBeacon and do not sell your data.
        </p>
        <ul>
          <li>Authentication and subscription data are processed securely.</li>
          <li>We use cookies/local storage for session management.</li>
          <li>Contact us at support@boosterbeacon.com for data requests.</li>
        </ul>
      </div>
    </div>
  );
};

export default PrivacyPage;

