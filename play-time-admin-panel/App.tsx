import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { HeaderActionsProvider } from './contexts/HeaderActionsContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useFCMToken } from './hooks/useFCMToken';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';
import Venues from './pages/Venues';
import VenueDetail from './pages/VenueDetail';
import CourtManagement from './pages/CourtManagement';
import Memberships from './pages/Memberships';
import Financials from './pages/Financials';
import Staff from './pages/Staff';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import Profile from './pages/Profile';
import RoleManagement from './pages/RoleManagement';
import PermissionManagement from './pages/PermissionManagement';
import Moderation from './pages/Moderation';
import Tournaments from './pages/Tournaments';
import QuickMatches from './pages/QuickMatches';
import Leaderboards from './pages/Leaderboards';
import Polls from './pages/Polls';
import FlashDeals from './pages/FlashDeals';
import Marketplace from './pages/Marketplace';
import CRM from './pages/CRM';
import Analytics from './pages/Analytics';
import Marketing from './pages/Marketing';
import Support from './pages/Support';
import Settings from './pages/Settings';
import FrontendCms from './pages/FrontendCms';
import CmsPageView from './pages/CmsPageView';
import Notifications from './pages/Notifications';
import Payments from './pages/Payments';
import ActivityLog from './pages/ActivityLog';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import ProtectedRoute from './components/layout/ProtectedRoute';
import VenueProtectedRoute from './components/layout/VenueProtectedRoute';
import ErrorBoundary from './components/layout/ErrorBoundary';
import ToastContainer from './components/layout/ToastContainer';
import { VenueTwoStepAuthProvider } from './contexts/VenueTwoStepAuthContext';

const AppRoutes: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  // Register FCM token when authenticated
  useFCMToken();

  if (loading === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/page/:slug" element={<CmsPageView />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <VenueTwoStepAuthProvider>
      <HeaderActionsProvider>
        <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden lg:ml-0">
            <Header />
            <main className="flex-1 overflow-y-auto pt-16 lg:pt-0 bg-background-light dark:bg-background-dark">
              <Routes>
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
                <Route path="/venues" element={<VenueProtectedRoute><Venues /></VenueProtectedRoute>} />
                <Route path="/venues/:venueId" element={<VenueProtectedRoute><VenueDetail /></VenueProtectedRoute>} />
                <Route path="/venues/courts" element={<VenueProtectedRoute><CourtManagement /></VenueProtectedRoute>} />
              <Route path="/memberships" element={<ProtectedRoute><Memberships /></ProtectedRoute>} />
              <Route path="/financials" element={<ProtectedRoute><Financials /></ProtectedRoute>} />
              <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
              <Route path="/users/:userId" element={<ProtectedRoute><UserDetail /></ProtectedRoute>} />
              <Route path="/users/roles" element={<ProtectedRoute requireSuperAdmin><RoleManagement /></ProtectedRoute>} />
              <Route path="/users/permissions" element={<ProtectedRoute requireSuperAdmin><PermissionManagement /></ProtectedRoute>} />
              <Route path="/activity-log" element={<ProtectedRoute requireSuperAdmin><ActivityLog /></ProtectedRoute>} />
              <Route path="/moderation" element={<ProtectedRoute requireSuperAdmin><Moderation /></ProtectedRoute>} />
              <Route path="/tournaments" element={<ProtectedRoute requireSuperAdmin><Tournaments /></ProtectedRoute>} />
              <Route path="/quick-matches" element={<ProtectedRoute><QuickMatches /></ProtectedRoute>} />
              <Route path="/leaderboards" element={<ProtectedRoute requireSuperAdmin><Leaderboards /></ProtectedRoute>} />
              <Route path="/polls" element={<ProtectedRoute requireSuperAdmin><Polls /></ProtectedRoute>} />
              <Route path="/flash-deals" element={<ProtectedRoute><FlashDeals /></ProtectedRoute>} />
              <Route path="/marketplace" element={<ProtectedRoute requireSuperAdmin><Marketplace /></ProtectedRoute>} />
              <Route path="/marketing" element={<ProtectedRoute requireSuperAdmin><Marketing /></ProtectedRoute>} />
              <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
              <Route path="/crm" element={<ProtectedRoute requireSuperAdmin><CRM /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute requireSuperAdmin><Analytics /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute requireSuperAdmin><Settings /></ProtectedRoute>} />
              <Route path="/frontend-cms" element={<ProtectedRoute requireSuperAdmin><FrontendCms /></ProtectedRoute>} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </HeaderActionsProvider>
    </VenueTwoStepAuthProvider>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <HashRouter>
              <AppRoutes />
              <ToastContainer />
            </HashRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
