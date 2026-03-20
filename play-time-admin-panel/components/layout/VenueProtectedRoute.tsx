import React, { useState, useEffect } from 'react';
import { useLocation, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useVenueTwoStepAuth } from '../../contexts/VenueTwoStepAuthContext';
import VenueTwoStepAuthModal from '../modals/VenueTwoStepAuthModal';
import ProtectedRoute from './ProtectedRoute';
import FullScreenLoader from '../shared/FullScreenLoader';

interface VenueProtectedRouteProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
  requireVenueManager?: boolean;
}

const VenueProtectedRoute: React.FC<VenueProtectedRouteProps> = ({
  children,
  requireSuperAdmin = false,
  requireVenueManager = false
}) => {
  const { isAuthenticated, loading, isSuperAdmin, isVenueManager } = useAuth();
  const { isVerified } = useVenueTwoStepAuth();
  const location = useLocation();
  const [show2FAModal, setShow2FAModal] = useState(false);

  // Venue-related routes that require 2FA
  const isVenueRoute = location.pathname.startsWith('/venues');

  useEffect(() => {
    // Check if user is on a venue route and needs verification
    if (isAuthenticated && isVenueRoute && !isVerified && loading === 'loaded') {
      setShow2FAModal(true);
    } else if (isVerified) {
      setShow2FAModal(false);
    }
  }, [isAuthenticated, isVenueRoute, isVerified, loading]);

  // First check basic authentication and role requirements
  if (loading === 'loading') {
    return <FullScreenLoader />;
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

  if (requireVenueManager && !isVenueManager) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark">
        <div className="text-center p-4 sm:p-8 bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm max-w-md">
          <span className="material-symbols-outlined text-6xl text-red-500 mb-4">block</span>
          <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">This page is only accessible to venue managers.</p>
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

  // Show 2FA modal if on venue route and not verified
  if (isVenueRoute && !isVerified) {
    return (
      <>
        <VenueTwoStepAuthModal
          isOpen={show2FAModal}
          onClose={() => {
            setShow2FAModal(false);
          }}
          onVerified={() => {
            setShow2FAModal(false);
          }}
          requiredFor="accessing venue management features"
        />
        {!show2FAModal && <FullScreenLoader message="Verifying access..." />}
      </>
    );
  }

  return <>{children}</>;
};

export default VenueProtectedRoute;

