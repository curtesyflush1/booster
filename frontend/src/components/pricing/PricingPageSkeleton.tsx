import React from 'react';

const PricingPageSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen bg-background-primary py-12">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header Skeleton */}
                <div className="text-center mb-12">
                    <div className="h-12 bg-gray-700 rounded-lg w-96 mx-auto mb-4 animate-pulse"></div>
                    <div className="h-6 bg-gray-700 rounded-lg w-80 mx-auto animate-pulse"></div>
                </div>

                {/* Cards Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {[1, 2].map((index) => (
                        <div key={index} className="card-dark p-8 animate-pulse">
                            <div className="text-center mb-6">
                                <div className="h-8 bg-gray-700 rounded w-24 mx-auto mb-2"></div>
                                <div className="h-12 bg-gray-700 rounded w-32 mx-auto mb-2"></div>
                                <div className="h-4 bg-gray-700 rounded w-48 mx-auto"></div>
                            </div>
                            
                            <div className="space-y-3 mb-8">
                                {[1, 2, 3, 4].map((featureIndex) => (
                                    <div key={featureIndex} className="flex items-center space-x-3">
                                        <div className="w-5 h-5 bg-gray-700 rounded-full"></div>
                                        <div className="h-4 bg-gray-700 rounded flex-1"></div>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="h-12 bg-gray-700 rounded-lg"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PricingPageSkeleton;