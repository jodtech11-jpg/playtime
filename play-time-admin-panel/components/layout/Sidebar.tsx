
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar: React.FC = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const isSuperAdmin = user?.role === 'super_admin';
  const isVenueManager = user?.role === 'venue_manager';
  const [usersMenuOpen, setUsersMenuOpen] = useState(
    location.pathname.startsWith('/users') || location.pathname.startsWith('/staff')
  );
  const [venuesMenuOpen, setVenuesMenuOpen] = useState(
    location.pathname.startsWith('/venues') || location.pathname.startsWith('/courts')
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Close submenus when navigating away from their routes
  useEffect(() => {
    const isUsersRoute = location.pathname.startsWith('/users') || location.pathname.startsWith('/staff');
    const isVenuesRoute = location.pathname.startsWith('/venues') || location.pathname.startsWith('/courts');

    // Close users menu if not on users/staff routes
    if (!isUsersRoute) {
      setUsersMenuOpen(false);
    } else {
      // Open users menu if on users/staff routes
      setUsersMenuOpen(true);
    }

    // Close venues menu if not on venues/courts routes
    if (!isVenuesRoute) {
      setVenuesMenuOpen(false);
    } else {
      // Open venues menu if on venues/courts routes
      setVenuesMenuOpen(true);
    }
  }, [location.pathname]);

  // Base menu items available to all authenticated users
  const baseNavItems = [
    { to: '/', icon: 'dashboard', label: 'Dashboard' },
    { to: '/bookings', icon: 'calendar_month', label: 'Bookings' },
    { to: '/memberships', icon: 'groups', label: 'Memberships' },
    { to: '/financials', icon: 'payments', label: 'Financials' },
    { to: '/payments', icon: 'account_balance_wallet', label: 'Payments' },
    { to: '/notifications', icon: 'notifications_active', label: 'Notifications' },
  ];

  // Super Admin only menu items (excluding venues which is now nested)
  const superAdminNavItems = [
    { to: '/activity-log', icon: 'history', label: 'Activity log' },
    { to: '/moderation', icon: 'shield', label: 'Moderation' },
    { to: '/marketing', icon: 'campaign', label: 'Marketing & Offers' },
    { to: '/tournaments', icon: 'emoji_events', label: 'Tournaments' },
    { to: '/quick-matches', icon: 'sports_soccer', label: 'Quick Matches' },
    { to: '/leaderboards', icon: 'leaderboard', label: 'Leaderboards' },
    { to: '/polls', icon: 'poll', label: 'Polls' },
    { to: '/flash-deals', icon: 'local_offer', label: 'Flash Deals' },
    { to: '/marketplace', icon: 'storefront', label: 'Marketplace' },
    { to: '/support', icon: 'support_agent', label: 'Support & Disputes' },
    { to: '/crm', icon: 'people', label: 'CRM & Reports' },
    { to: '/analytics', icon: 'analytics', label: 'Analytics' },
    { to: '/frontend-cms', icon: 'web', label: 'Frontend CMS' },
    { to: '/settings', icon: 'settings', label: 'Settings' },
  ];

  // Venue Manager only menu items (excluding venues which is now nested)
  const venueManagerNavItems = [
    { to: '/support', icon: 'support_agent', label: 'Support & Disputes' },
  ];

  // Combine menu items based on role
  const navItems = isSuperAdmin
    ? [...baseNavItems, ...superAdminNavItems]
    : isVenueManager
      ? [...baseNavItems, ...venueManagerNavItems]
      : baseNavItems;

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-sidebar-dark dark:bg-surface-dark text-white rounded-lg shadow-lg"
        aria-label="Toggle menu"
      >
        <span className="material-symbols-outlined text-2xl">
          {mobileMenuOpen ? 'close' : 'menu'}
        </span>
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="relative flex h-full">
        <aside className={`fixed lg:static inset-y-0 left-0 flex flex-col h-full shrink-0 z-40 lg:z-20 transform transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${collapsed ? 'lg:w-20' : 'w-64 lg:w-64'} ui-sidebar`}>
          <div className={`h-16 flex items-center border-b border-white/5 ${collapsed ? 'px-3 justify-center' : 'px-6'}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-content shrink-0">
                <span className="material-symbols-outlined text-2xl font-bold">sports_tennis</span>
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <h1 className="text-base font-bold leading-none tracking-tight truncate">Play Time</h1>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-medium">Admin Panel</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden ml-auto p-1 hover:bg-white/5 rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1 no-scrollbar">
            {baseNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => {
                  setUsersMenuOpen(false);
                  setVenuesMenuOpen(false);
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${collapsed ? 'justify-center lg:px-3' : ''} ${isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
                title={collapsed ? item.label : undefined}
              >
                <span className="material-symbols-outlined text-[22px] shrink-0 transition-transform duration-200 group-hover:scale-110">{item.icon}</span>
                {!collapsed && <span className="text-sm font-semibold tracking-wide truncate">{item.label}</span>}
              </NavLink>
            ))}

            {/* Users Menu with nested items */}
            <div className="mt-1 relative">
              {collapsed ? (
                <NavLink
                  to="/users"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-center px-2 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-primary text-primary-content' : 'text-gray-400 dark:text-gray-500 hover:text-white hover:bg-white/5'}`
                  }
                  title="Users"
                >
                  <span className="material-symbols-outlined text-[22px]">people</span>
                </NavLink>
              ) : (
                <button
                  onClick={() => {
                    const newState = !usersMenuOpen;
                    setUsersMenuOpen(newState);
                    if (newState) setVenuesMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-colors group ${location.pathname.startsWith('/users') || location.pathname.startsWith('/staff')
                    ? 'bg-primary text-primary-content shadow-sm shadow-primary/20'
                    : 'text-gray-400 dark:text-gray-500 hover:text-white hover:bg-white/5 dark:hover:bg-gray-800'
                    }`}
                  aria-expanded={usersMenuOpen}
                  aria-label="Users menu"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="material-symbols-outlined text-[22px] shrink-0">people</span>
                    <span className="text-sm font-medium truncate">Users</span>
                  </div>
                  <span className={`material-symbols-outlined text-lg transition-transform duration-200 shrink-0 ${usersMenuOpen ? 'rotate-90' : ''}`}>chevron_right</span>
                </button>
              )}
            </div>

            {/* Venues Menu with nested items */}
            {(isSuperAdmin || isVenueManager) && (
              <div className="mt-1 relative">
                {collapsed ? (
                  <NavLink
                    to="/venues"
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-center px-2 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-primary text-primary-content' : 'text-gray-400 dark:text-gray-500 hover:text-white hover:bg-white/5'}`
                    }
                    title="Venues"
                  >
                    <span className="material-symbols-outlined text-[22px]">location_on</span>
                  </NavLink>
                ) : (
                  <button
                    onClick={() => {
                      const newState = !venuesMenuOpen;
                      setVenuesMenuOpen(newState);
                      if (newState) setUsersMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-colors group ${location.pathname.startsWith('/venues') || location.pathname.startsWith('/courts')
                      ? 'bg-primary text-primary-content shadow-sm shadow-primary/20'
                      : 'text-gray-400 dark:text-gray-500 hover:text-white hover:bg-white/5 dark:hover:bg-gray-800'
                      }`}
                    aria-expanded={venuesMenuOpen}
                    aria-label="Venues menu"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="material-symbols-outlined text-[22px] shrink-0">location_on</span>
                      <span className="text-sm font-medium truncate">Venues</span>
                    </div>
                    <span className={`material-symbols-outlined text-lg transition-transform duration-200 shrink-0 ${venuesMenuOpen ? 'rotate-90' : ''}`}>chevron_right</span>
                  </button>
                )}
              </div>
            )}

            {/* Super Admin and Venue Manager specific items */}
            {(isSuperAdmin ? superAdminNavItems : venueManagerNavItems).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => {
                  setUsersMenuOpen(false);
                  setVenuesMenuOpen(false);
                  setMobileMenuOpen(false);
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${collapsed ? 'justify-center lg:px-3' : ''} ${isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
                title={collapsed ? item.label : undefined}
              >
                <span className="material-symbols-outlined text-[22px] shrink-0 transition-transform duration-200 group-hover:scale-110">{item.icon}</span>
                {!collapsed && <span className="text-sm font-semibold tracking-wide truncate">{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-white/5 space-y-2">
            <button
              type="button"
              onClick={() => setCollapsed(c => !c)}
              className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <span className="material-symbols-outlined text-xl">{collapsed ? 'chevron_right' : 'chevron_left'}</span>
              {!collapsed && <span className="text-xs font-medium">Collapse</span>}
            </button>
            <div className={`flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 group hover:border-white/20 transition-colors ${collapsed ? 'justify-center lg:px-2' : ''}`}>
              <NavLink
                to="/profile"
                className="size-10 rounded-xl bg-cover bg-center bg-no-repeat border-2 border-primary shadow-lg cursor-pointer hover:scale-105 transition-transform"
                style={{ backgroundImage: user?.avatar ? `url(${user.avatar})` : "url('https://lh3.googleusercontent.com/aida-public/AB6AXuASHYfqAnVd3whTtsCqXFcHmOJH19Bf99zE4_JaWhro39udXL7Nf2cKm98O0Xy4uBNzgtR4gXloHQPqHflj9xJABF0BW-2qATczeuMxskjdfr2H4QIYVvKvMwozwFe2eRAGc5BLpI0n75uCIoQeOYxTg72lSustcXAg_wyItzNpwAq0qeszvmkzdvRXJKwvLWNFYBn-0afFufcnXdagx6BWODExs_k_OSq0bpzwMyz12vfXdXP2F0nHn14J0Lw940uLDJP32W5ErvRv')" }}
                title="View Profile"
              >
                {!user?.avatar && (
                  <div className="w-full h-full flex items-center justify-center text-white text-xs">
                    <span className="material-symbols-outlined">person</span>
                  </div>
                )}
              </NavLink>
              {!collapsed && (
                <NavLink
                  to="/profile"
                  className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
                >
                  <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                    {user?.role === 'super_admin'
                      ? 'Super Admin'
                      : user?.role === 'venue_manager'
                        ? 'Venue Manager'
                        : 'Player'}
                  </p>
                </NavLink>
              )}
              <button onClick={() => { signOut(); setMobileMenuOpen(false); }} className="text-gray-400 dark:text-gray-500 hover:text-red-400 transition-colors shrink-0" title="Sign Out">
                <span className="material-symbols-outlined text-xl">logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Users Submenu Side Panel */}
        {usersMenuOpen && !collapsed && (
          <aside className="fixed lg:static inset-y-0 left-64 lg:left-auto w-56 bg-sidebar-dark dark:bg-sidebar-dark text-white flex flex-col h-full shrink-0 border-r border-white/10 dark:border-gray-700 z-30 lg:z-10 animate-in slide-in-from-left duration-200">
            <div className="h-16 flex items-center px-6 border-b border-white/10 dark:border-gray-700">
              <button
                onClick={() => setUsersMenuOpen(false)}
                className="mr-2 p-1 hover:bg-white/5 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-xl">arrow_back</span>
              </button>
              <h2 className="text-base font-bold">Users</h2>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
              <NavLink
                to="/users"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                    ? 'bg-primary text-primary-content shadow-sm shadow-primary/20'
                    : 'text-gray-400 dark:text-gray-500 hover:text-white hover:bg-white/5 dark:hover:bg-gray-800'
                  }`
                }
              >
                <span className="material-symbols-outlined text-[22px]">people</span>
                <span className="text-sm font-medium">All Users</span>
              </NavLink>
              <NavLink
                to="/staff"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                    ? 'bg-primary text-primary-content shadow-sm shadow-primary/20'
                    : 'text-gray-400 dark:text-gray-500 hover:text-white hover:bg-white/5 dark:hover:bg-gray-800'
                  }`
                }
              >
                <span className="material-symbols-outlined text-[22px]">badge</span>
                <span className="text-sm font-medium">Staff</span>
              </NavLink>
              {isSuperAdmin && (
                <>
                  <NavLink
                    to="/users/roles"
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                        ? 'bg-primary text-primary-content shadow-sm shadow-primary/20'
                        : 'text-gray-400 dark:text-gray-500 hover:text-white hover:bg-white/5 dark:hover:bg-gray-800'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[22px]">admin_panel_settings</span>
                    <span className="text-sm font-medium">Roles</span>
                  </NavLink>
                  <NavLink
                    to="/users/permissions"
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                        ? 'bg-primary text-primary-content shadow-sm shadow-primary/20'
                        : 'text-gray-400 dark:text-gray-500 hover:text-white hover:bg-white/5 dark:hover:bg-gray-800'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[22px]">lock</span>
                    <span className="text-sm font-medium">Permissions</span>
                  </NavLink>
                </>
              )}
            </nav>
          </aside>
        )}

        {/* Venues Submenu Side Panel */}
        {venuesMenuOpen && (isSuperAdmin || isVenueManager) && !collapsed && (
          <aside className="fixed lg:static inset-y-0 left-64 lg:left-auto w-56 ui-sidebar text-white flex flex-col h-full shrink-0 z-30 lg:z-10 animate-in slide-in-from-left duration-200">
            <div className="h-16 flex items-center px-6 border-b border-white/5">
              <button
                onClick={() => setVenuesMenuOpen(false)}
                className="mr-2 p-1 hover:bg-white/5 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-xl">arrow_back</span>
              </button>
              <h2 className="text-base font-bold">Venues</h2>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
              <NavLink
                to="/venues"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <span className="material-symbols-outlined text-[22px]">location_on</span>
                <span className="text-sm font-semibold tracking-wide">All Venues</span>
              </NavLink>
              <NavLink
                to="/venues/courts"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <span className="material-symbols-outlined text-[22px]">sports_tennis</span>
                <span className="text-sm font-semibold tracking-wide">Court Management</span>
              </NavLink>
            </nav>
          </aside>
        )}
      </div>
    </>
  );
};

export default Sidebar;
