import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
  requireVenueManager?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireSuperAdmin = false,
  requireVenueManager = false 
}) => {
  const { isAuthenticated, loading, isSuperAdmin, isVenueManager } = useAuth();

  if (loading === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light">
        <div className="text-center p-8 bg-white rounded-2xl border border-gray-200 shadow-sm max-w-md">
          <span className="material-symbols-outlined text-6xl text-red-500 mb-4">block</span>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (requireVenueManager && !isVenueManager) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light">
        <div className="text-center p-8 bg-white rounded-2xl border border-gray-200 shadow-sm max-w-md">
          <span className="material-symbols-outlined text-6xl text-red-500 mb-4">block</span>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">This page is only accessible to venue managers.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;

