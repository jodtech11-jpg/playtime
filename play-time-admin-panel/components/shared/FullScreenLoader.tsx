import React from 'react';

interface FullScreenLoaderProps {
  message?: string;
}

const FullScreenLoader: React.FC<FullScreenLoaderProps> = ({
  message = 'Loading...',
}) => (
  <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
      <p className="text-gray-600 dark:text-gray-400 font-medium">{message}</p>
    </div>
  </div>
);

export default FullScreenLoader;
