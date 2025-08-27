import React from 'react';

interface PricingHeaderProps {
  title: string;
  subtitle: string;
  className?: string;
}

const PricingHeader: React.FC<PricingHeaderProps> = ({ 
  title, 
  subtitle, 
  className = '' 
}) => {
  return (
    <div className={`text-center mb-12 ${className}`}>
      <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4 animate-fade-in">
        {title}
      </h1>
      <p className="text-xl text-gray-400 max-w-2xl mx-auto animate-fade-in animation-delay-200">
        {subtitle}
      </p>
    </div>
  );
};

export default PricingHeader;