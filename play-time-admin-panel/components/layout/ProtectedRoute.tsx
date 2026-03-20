import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import FullScreenLoader from '../shared/FullScreenLoader';

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
  const { isAuthenticated, loading, isSuperAdmin, isVenueManager, error: authError } = useAuth();

  if (loading === 'loading') {
    return <FullScreenLoader />;
  }

  if (loading === 'error') {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark">
        <div className="text-center p-4 sm:p-8 max-w-md">
          <span className="material-symbols-outlined text-5xl text-amber-500 mb-4">error</span>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Something went wrong</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{authError || 'Failed to load your account.'}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-content px-6 py-3 font-semibold hover:opacity-90"
            >
              Go to login
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 px-6 py-3 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark">
        <div className="text-center p-4 sm:p-8 bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm max-w-md">
          <span className="material-symbols-outlined text-6xl text-red-500 mb-4">block</span>
          <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">You don&apos;t have permission to access this page.</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-content px-6 py-3 font-semibold hover:opacity-90"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (requireVenueManager && !isVenueManager && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark">
        <div className="text-center p-4 sm:p-8 bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm max-w-md">
          <span className="material-symbols-outlined text-6xl text-red-500 mb-4">block</span>
          <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">You don&apos;t have permission to access this page.</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-content px-6 py-3 font-semibold hover:opacity-90"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;

