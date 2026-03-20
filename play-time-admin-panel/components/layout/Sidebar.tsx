
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

function getInitials(name: string | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const Sidebar: React.FC = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const isSuperAdmin = user?.role === 'super_admin';
  const isVenueManager = user?.role === 'venue_manager';
  const [usersMenuOpen, setUsersMenuOpen] = useState(
    location.pathname.startsWith('/users') || location.pathname.startsWith('/staff')
  );
  const [venuesMenuOpen, setVenuesMenuOpen] = useState(location.pathname.startsWith('/venues'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedFlyout, setCollapsedFlyout] = useState<null | 'users' | 'venues'>(null);
  const usersFlyoutRef = useRef<HTMLDivElement>(null);
  const venuesFlyoutRef = useRef<HTMLDivElement>(null);

  const closeCollapsedFlyout = () => setCollapsedFlyout(null);

  useEffect(() => {
    if (!collapsedFlyout) return;
    const handlePointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (usersFlyoutRef.current?.contains(t)) return;
      if (venuesFlyoutRef.current?.contains(t)) return;
      setCollapsedFlyout(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [collapsedFlyout]);

  useEffect(() => {
    setCollapsedFlyout(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!collapsed) setCollapsedFlyout(null);
  }, [collapsed]);

  // Close submenus when navigating away from their routes
  useEffect(() => {
    const isUsersRoute = location.pathname.startsWith('/users') || location.pathname.startsWith('/staff');
    const isVenuesRoute = location.pathname.startsWith('/venues');

    if (!isUsersRoute) {
      setUsersMenuOpen(false);
    } else {
      setUsersMenuOpen(true);
    }

    if (!isVenuesRoute) {
      setVenuesMenuOpen(false);
    } else {
      setVenuesMenuOpen(true);
    }
  }, [location.pathname]);

  const usersSectionActive =
    location.pathname.startsWith('/users') || location.pathname.startsWith('/staff');
  const venuesSectionActive = location.pathname.startsWith('/venues');

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

  const flyoutClass =
    'absolute left-full top-0 ml-2 z-[70] min-w-[14rem] py-2 rounded-xl bg-sidebar-dark dark:bg-slate-900 border border-white/10 shadow-2xl flex flex-col gap-0.5';

  const flyoutLinkClass = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2 mx-1 rounded-lg transition-colors text-left ${
      isActive
        ? 'bg-primary text-primary-content shadow-sm shadow-primary/20'
        : 'text-gray-300 hover:text-white hover:bg-white/10'
    }`;

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        type="button"
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
          aria-hidden
        />
      )}

      <div className="relative flex h-full">
        <aside
          className={`fixed lg:static inset-y-0 left-0 flex flex-col h-full shrink-0 z-40 lg:z-20 transform transition-all duration-300 ease-in-out ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } ${collapsed ? 'lg:w-20' : 'w-64 lg:w-64'} ui-sidebar`}
        >
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
              type="button"
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
                  closeCollapsedFlyout();
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${collapsed ? 'justify-center lg:px-3' : ''} ${
                    isActive
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
                title={collapsed ? item.label : undefined}
              >
                <span className="material-symbols-outlined text-[22px] shrink-0 transition-transform duration-200 group-hover:scale-110">
                  {item.icon}
                </span>
                {!collapsed && <span className="text-sm font-semibold tracking-wide truncate">{item.label}</span>}
              </NavLink>
            ))}

            {/* Users Menu with vertical submenu */}
            <div className="mt-1">
              {collapsed ? (
                <div ref={usersFlyoutRef} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setCollapsedFlyout((f) => (f === 'users' ? null : 'users'));
                      if (collapsedFlyout !== 'users') setVenuesMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-center px-2 py-2.5 rounded-lg transition-colors ${
                      usersSectionActive
                        ? 'bg-primary text-primary-content'
                        : 'text-gray-400 dark:text-gray-500 hover:text-white hover:bg-white/5'
                    }`}
                    title="Users"
                    aria-expanded={collapsedFlyout === 'users'}
                    aria-haspopup="true"
                    aria-label="Users menu"
                  >
                    <span className="material-symbols-outlined text-[22px]">people</span>
                  </button>
                  {collapsedFlyout === 'users' && (
                    <div className={flyoutClass} role="menu">
                      <NavLink
                        to="/users"
                        role="menuitem"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          closeCollapsedFlyout();
                        }}
                        className={({ isActive }) => flyoutLinkClass(isActive)}
                      >
                        <span className="material-symbols-outlined text-[18px]">people</span>
                        <span className="text-sm font-medium">All Users</span>
                      </NavLink>
                      <NavLink
                        to="/staff"
                        role="menuitem"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          closeCollapsedFlyout();
                        }}
                        className={({ isActive }) => flyoutLinkClass(isActive)}
                      >
                        <span className="material-symbols-outlined text-[18px]">badge</span>
                        <span className="text-sm font-medium">Staff</span>
                      </NavLink>
                      {isSuperAdmin && (
                        <>
                          <NavLink
                            to="/users/roles"
                            role="menuitem"
                            onClick={() => {
                              setMobileMenuOpen(false);
                              closeCollapsedFlyout();
                            }}
                            className={({ isActive }) => flyoutLinkClass(isActive)}
                          >
                            <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                            <span className="text-sm font-medium">Roles</span>
                          </NavLink>
                          <NavLink
                            to="/users/permissions"
                            role="menuitem"
                            onClick={() => {
                              setMobileMenuOpen(false);
                              closeCollapsedFlyout();
                            }}
                            className={({ isActive }) => flyoutLinkClass(isActive)}
                          >
                            <span className="material-symbols-outlined text-[18px]">lock</span>
                            <span className="text-sm font-medium">Permissions</span>
                          </NavLink>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const newState = !usersMenuOpen;
                      setUsersMenuOpen(newState);
                      if (newState) setVenuesMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-colors group ${
                      usersSectionActive
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
                    <span
                      className={`material-symbols-outlined text-lg transition-transform duration-200 shrink-0 ${
                        usersMenuOpen ? 'rotate-180' : ''
                      }`}
                    >
                      expand_more
                    </span>
                  </button>
                  {usersMenuOpen && (
                    <div className="ml-4 mt-1 pl-2 border-l border-white/10 dark:border-gray-700 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                      <NavLink
                        to="/users"
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            isActive
                              ? 'bg-primary text-primary-content shadow-sm shadow-primary/20'
                              : 'text-gray-400 dark:text-gray-500 hover:text-white hover:bg-white/5 dark:hover:bg-gray-800'
                          }`
                        }
                      >
                        <span className="material-symbols-outlined text-[18px]">people</span>
                        <span className="text-sm font-medium">All Users</span>
                      </NavLink>
                      <NavLink
                        to="/staff"
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            isActive
                              ? 'bg-primary text-primary-content shadow-sm shadow-primary/20'
                              : 'text-gray-400 dark:text-gray-500 hover:text-white hover:bg-white/5 dark:hover:bg-gray-800'
                          }`
                        }
                      >
                        <span className="material-symbols-outlined text-[18px]">badge</span>
                        <span className="text-sm font-medium">Staff</span>
                      </NavLink>
                      {isSuperAdmin && (
                        <>
                          <NavLink
                            to="/users/roles"
                            onClick={() => setMobileMenuOpen(false)}
                            className={({ isActive }) =>
                              `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                                isActive
                                  ? 'bg-primary text-primary-content shadow-sm shadow-primary/20'
                                  : 'text-gray-400 dark:text-gray-500 hover:text-white hover:bg-white/5 dark:hover:bg-gray-800'
                              }`
                            }
                          >
                            <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                            <span className="text-sm font-medium">Roles</span>
                          </NavLink>
                          <NavLink
                            to="/users/permissions"
                            onClick={() => setMobileMenuOpen(false)}
                            className={({ isActive }) =>
                              `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                                isActive
                                  ? 'bg-primary text-primary-content shadow-sm shadow-primary/20'
                                  : 'text-gray-400 dark:text-gray-500 hover:text-white hover:bg-white/5 dark:hover:bg-gray-800'
                              }`
                            }
                          >
                            <span className="material-symbols-outlined text-[18px]">lock</span>
                            <span className="text-sm font-medium">Permissions</span>
                          </NavLink>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Venues Menu with vertical submenu */}
            {(isSuperAdmin || isVenueManager) && (
              <div className="mt-1">
                {collapsed ? (
                  <div ref={venuesFlyoutRef} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setCollapsedFlyout((f) => (f === 'venues' ? null : 'venues'));
                        if (collapsedFlyout !== 'venues') setUsersMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-center px-2 py-2.5 rounded-lg transition-colors ${
                        venuesSectionActive
                          ? 'bg-primary text-primary-content'
                          : 'text-gray-400 dark:text-gray-500 hover:text-white hover:bg-white/5'
                      }`}
                      title="Venues"
                      aria-expanded={collapsedFlyout === 'venues'}
                      aria-haspopup="true"
                      aria-label="Venues menu"
                    >
                      <span className="material-symbols-outlined text-[22px]">location_on</span>
                    </button>
                    {collapsedFlyout === 'venues' && (
                      <div className={flyoutClass} role="menu">
                        <NavLink
                          to="/venues"
                          role="menuitem"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            closeCollapsedFlyout();
                          }}
                          className={({ isActive }) => flyoutLinkClass(isActive)}
                        >
                          <span className="material-symbols-outlined text-[18px]">location_on</span>
                          <span className="text-sm font-medium">All Venues</span>
                        </NavLink>
                        <NavLink
                          to="/venues/courts"
                          role="menuitem"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            closeCollapsedFlyout();
                          }}
                          className={({ isActive }) => flyoutLinkClass(isActive)}
                        >
                          <span className="material-symbols-outlined text-[18px]">sports_tennis</span>
                          <span className="text-sm font-medium">Court Management</span>
                        </NavLink>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const newState = !venuesMenuOpen;
                        setVenuesMenuOpen(newState);
                        if (newState) setUsersMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-colors group ${
                        venuesSectionActive
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
                      <span
                        className={`material-symbols-outlined text-lg transition-transform duration-200 shrink-0 ${
                          venuesMenuOpen ? 'rotate-180' : ''
                        }`}
                      >
                        expand_more
                      </span>
                    </button>
                    {venuesMenuOpen && (
                      <div className="ml-4 mt-1 pl-2 border-l border-white/10 dark:border-gray-700 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        <NavLink
                          to="/venues"
                          onClick={() => setMobileMenuOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                              isActive
                                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                : 'text-gray-400 dark:text-gray-500 hover:text-white hover:bg-white/5 dark:hover:bg-gray-800'
                            }`
                          }
                        >
                          <span className="material-symbols-outlined text-[18px]">location_on</span>
                          <span className="text-sm font-medium">All Venues</span>
                        </NavLink>
                        <NavLink
                          to="/venues/courts"
                          onClick={() => setMobileMenuOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                              isActive
                                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                : 'text-gray-400 dark:text-gray-500 hover:text-white hover:bg-white/5 dark:hover:bg-gray-800'
                            }`
                          }
                        >
                          <span className="material-symbols-outlined text-[18px]">sports_tennis</span>
                          <span className="text-sm font-medium">Court Management</span>
                        </NavLink>
                      </div>
                    )}
                  </>
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
                  closeCollapsedFlyout();
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${collapsed ? 'justify-center lg:px-3' : ''} ${
                    isActive
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
                title={collapsed ? item.label : undefined}
              >
                <span className="material-symbols-outlined text-[22px] shrink-0 transition-transform duration-200 group-hover:scale-110">
                  {item.icon}
                </span>
                {!collapsed && <span className="text-sm font-semibold tracking-wide truncate">{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-white/5 space-y-2">
            <button
              type="button"
              onClick={() => {
                setCollapsed((c) => !c);
                closeCollapsedFlyout();
              }}
              className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <span className="material-symbols-outlined text-xl">{collapsed ? 'chevron_right' : 'chevron_left'}</span>
              {!collapsed && <span className="text-xs font-medium">Collapse</span>}
            </button>
            <div
              className={`flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 group hover:border-white/20 transition-colors ${
                collapsed ? 'justify-center lg:px-2' : ''
              }`}
            >
              <NavLink
                to="/profile"
                className={`size-10 rounded-xl shrink-0 border-2 border-primary shadow-lg cursor-pointer hover:scale-105 transition-transform flex items-center justify-center overflow-hidden ${
                  user?.avatar ? 'bg-cover bg-center bg-no-repeat' : 'bg-gradient-to-br from-primary to-primary/70'
                }`}
                style={user?.avatar ? { backgroundImage: `url(${user.avatar})` } : undefined}
                title="View Profile"
              >
                {!user?.avatar && (
                  <span className="text-white text-xs font-black tracking-tight">{getInitials(user?.name)}</span>
                )}
              </NavLink>
              {!collapsed && (
                <NavLink to="/profile" className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
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
              <button
                type="button"
                onClick={() => {
                  signOut();
                  setMobileMenuOpen(false);
                  closeCollapsedFlyout();
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-red-400 transition-colors shrink-0"
                title="Sign Out"
                aria-label="Sign out"
              >
                <span className="material-symbols-outlined text-xl">logout</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
};

export default Sidebar;
