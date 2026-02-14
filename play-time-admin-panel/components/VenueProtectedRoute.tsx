import React, { useState, useEffect } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useVenueTwoStepAuth } from '../contexts/VenueTwoStepAuthContext';
import VenueTwoStepAuthModal from './VenueTwoStepAuthModal';
import ProtectedRoute from './ProtectedRoute';

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
  const isVenueRoute = location.pathname.startsWith('/venues') || location.pathname.startsWith('/courts');

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
        {!show2FAModal && (
          <div className="flex items-center justify-center h-screen bg-background-light">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-gray-600 font-medium">Verifying access...</p>
            </div>
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
};

export default VenueProtectedRoute;

