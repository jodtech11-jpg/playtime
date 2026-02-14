
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../hooks/useNotifications';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { formatCurrency } from '../utils/formatUtils';

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { onNewEntry, hasHandler } = useHeaderActions();
  const { notifications } = useNotifications(false); // Only fetch count, not full list
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const notificationsRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Use global search hook
  const { results, loading: searchLoading } = useGlobalSearch(debouncedQuery, showSearchDropdown && debouncedQuery.length >= 2);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotificationsDropdown(false);
      }
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendarDropdown(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search input focus
  const handleSearchFocus = () => {
    setShowSearchDropdown(true);
    setShowNotificationsDropdown(false);
    setShowCalendarDropdown(false);
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowSearchDropdown(true);
  };

  // Handle search result click
  const handleSearchResultClick = (url: string, data?: any) => {
    navigate(url);
    setShowSearchDropdown(false);
    setSearchQuery('');
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSearchDropdown(true);
      }
      // Escape to close search
      if (e.key === 'Escape' && showSearchDropdown) {
        setShowSearchDropdown(false);
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSearchDropdown]);

  const getPageTitle = () => {
    const path = location.pathname.split('/')[1];
    if (!path) return 'Overview';
    const titleMap: Record<string, string> = {
      'frontend-cms': 'Frontend CMS',
      'quick-matches': 'Quick Matches',
      'flash-deals': 'Flash Deals',
    };
    return titleMap[path] || path.charAt(0).toUpperCase() + path.slice(1);
  };

  // Get unread notifications count (notifications from last 24 hours)
  const unreadCount = React.useMemo(() => {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    return notifications.filter(n => {
      if (!n.createdAt) return false;
      try {
        const createdDate = n.createdAt?.toDate ? n.createdAt.toDate() :
          (n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000) :
            new Date(n.createdAt));
        return createdDate > oneDayAgo;
      } catch {
        return false;
      }
    }).length;
  }, [notifications]);

  // Recent notifications (last 5)
  const recentNotifications = React.useMemo(() => {
    return notifications
      .sort((a, b) => {
        try {
          const aDate = a.createdAt?.toDate ? a.createdAt.toDate() :
            (a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) :
              new Date(a.createdAt || 0));
          const bDate = b.createdAt?.toDate ? b.createdAt.toDate() :
            (b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) :
              new Date(b.createdAt || 0));
          return bDate.getTime() - aDate.getTime();
        } catch {
          return 0;
        }
      })
      .slice(0, 5);
  }, [notifications]);

  const handleNotificationsClick = () => {
    if (showNotificationsDropdown) {
      setShowNotificationsDropdown(false);
    } else {
      setShowNotificationsDropdown(true);
      setShowCalendarDropdown(false);
    }
  };

  const handleCalendarClick = () => {
    if (showCalendarDropdown) {
      setShowCalendarDropdown(false);
    } else {
      setShowCalendarDropdown(true);
      setShowNotificationsDropdown(false);
    }
  };

  const handleNewEntryClick = () => {
    try {
      if (hasHandler) {
        onNewEntry();
      } else {
        // Fallback: Navigate to appropriate page based on current route
        const path = location.pathname.split('/')[1];
        const fallbackRoutes: Record<string, string> = {
          '': '/bookings',
          'bookings': '/bookings',
          'venues': '/venues',
          'staff': '/staff',
          'tournaments': '/tournaments',
          'marketing': '/marketing',
          'marketplace': '/marketplace',
          'notifications': '/notifications',
          'memberships': '/memberships',
        };
        const fallbackRoute = fallbackRoutes[path] || '/';
        navigate(fallbackRoute);
      }
    } catch (error) {
      console.error('Error calling new entry handler:', error);
      // Still try fallback navigation
      const path = location.pathname.split('/')[1];
      const fallbackRoutes: Record<string, string> = {
        '': '/bookings',
        'bookings': '/bookings',
        'venues': '/venues',
        'staff': '/staff',
        'tournaments': '/tournaments',
        'marketing': '/marketing',
        'marketplace': '/marketplace',
        'notifications': '/notifications',
        'memberships': '/memberships',
      };
      const fallbackRoute = fallbackRoutes[path] || '/';
      navigate(fallbackRoute);
    }
  };

  // Get "New Entry" button text based on current page
  const getNewEntryText = () => {
    const path = location.pathname.split('/')[1];
    const textMap: Record<string, string> = {
      '': 'New Entry',
      'bookings': 'New Booking',
      'venues': 'New Venue',
      'staff': 'New Staff',
      'users': 'Create User',
      'tournaments': 'New Tournament',
      'marketing': 'New Campaign',
      'marketplace': 'New Product',
      'notifications': 'Send Notification',
      'memberships': 'New Membership',
      'frontend-cms': 'Add Page',
    };
    // Handle nested routes like /users/roles
    if (path === 'users') {
      const subPath = location.pathname.split('/')[2];
      if (subPath === 'roles') return 'Create Role';
      if (subPath === 'permissions') return 'Create Permission';
    }
    return textMap[path] || 'New Entry';
  };

  return (
    <header className="h-16 ui-header flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 z-10">
      <div className="flex items-center gap-2 sm:gap-4">
        <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none">{getPageTitle()}</h2>
      </div>

      <div className="flex-1 max-w-lg px-8 hidden md:block" ref={searchRef}>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary">search</span>
          </div>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={handleSearchFocus}
            className="block w-full pl-10 pr-20 py-2 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white dark:focus:bg-slate-700 sm:text-sm transition-all duration-200"
            placeholder="Search anything... (⌘K)"
            type="text"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setShowSearchDropdown(false);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
          {!searchQuery && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <kbd className="px-2 py-1 text-[10px] font-black text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">⌘K</kbd>
            </div>
          )}

          {/* Search Results Dropdown */}
          {showSearchDropdown && debouncedQuery.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 max-h-[70vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              {searchLoading ? (
                <div className="p-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2"></div>
                  <p className="text-sm text-gray-500">Searching...</p>
                </div>
              ) : results.length === 0 ? (
                <div className="p-8 text-center">
                  <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">search_off</span>
                  <p className="text-sm text-gray-500">No results found</p>
                  <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
                </div>
              ) : (
                <>
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest">
                      {results.length} {results.length === 1 ? 'Result' : 'Results'}
                    </p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {results.map((result) => {
                      const getIcon = () => {
                        switch (result.type) {
                          case 'booking':
                            return 'event';
                          case 'user':
                            return 'person';
                          case 'venue':
                            return 'location_on';
                          case 'staff':
                            return 'badge';
                          case 'tournament':
                            return 'emoji_events';
                          case 'product':
                            return 'inventory_2';
                          case 'order':
                            return 'shopping_cart';
                          case 'notification':
                            return 'notifications';
                          default:
                            return 'search';
                        }
                      };

                      const getTypeColor = () => {
                        switch (result.type) {
                          case 'booking':
                            return 'bg-blue-100 text-blue-800';
                          case 'user':
                            return 'bg-purple-100 text-purple-800';
                          case 'venue':
                            return 'bg-green-100 text-green-800';
                          case 'staff':
                            return 'bg-orange-100 text-orange-800';
                          case 'tournament':
                            return 'bg-yellow-100 text-yellow-800';
                          case 'product':
                            return 'bg-pink-100 text-pink-800';
                          case 'order':
                            return 'bg-indigo-100 text-indigo-800';
                          case 'notification':
                            return 'bg-gray-100 text-gray-800';
                          default:
                            return 'bg-gray-100 text-gray-800';
                        }
                      };

                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleSearchResultClick(result.url, result.data)}
                          className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getTypeColor()}`}>
                              <span className="material-symbols-outlined text-lg">{getIcon()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{result.title}</p>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${getTypeColor()}`}>
                                  {result.type}
                                </span>
                              </div>
                              {result.subtitle && (
                                <p className="text-xs text-gray-600 mb-1">{result.subtitle}</p>
                              )}
                              {result.description && (
                                <p className="text-xs text-gray-500 line-clamp-1">{result.description}</p>
                              )}
                            </div>
                            <span className="material-symbols-outlined text-gray-400">arrow_forward</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <span className="material-symbols-outlined">light_mode</span>
          ) : (
            <span className="material-symbols-outlined">dark_mode</span>
          )}
        </button>

        {/* Notifications Button */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={handleNotificationsClick}
            className="relative p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 size-2 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>
          {showNotificationsDropdown && (
            <div className="absolute right-0 mt-3 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 max-h-[70vh] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-black text-gray-900 dark:text-gray-100 text-sm">Notifications</h3>
                <button
                  onClick={() => navigate('/notifications')}
                  className="text-xs text-primary font-bold hover:underline"
                >
                  View All
                </button>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {recentNotifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 mb-2">notifications_off</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">No notifications</p>
                  </div>
                ) : (
                  recentNotifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => {
                        navigate('/notifications');
                        setShowNotificationsDropdown(false);
                      }}
                      className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{notification.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{notification.body}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                            {notification.createdAt && (
                              <span>
                                {(() => {
                                  try {
                                    const date = notification.createdAt?.toDate ? notification.createdAt.toDate() :
                                      (notification.createdAt?.seconds ? new Date(notification.createdAt.seconds * 1000) :
                                        new Date(notification.createdAt));
                                    return date.toLocaleDateString();
                                  } catch {
                                    return '';
                                  }
                                })()}
                              </span>
                            )}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${notification.status === 'Sent' ? 'bg-green-100 text-green-800' :
                          notification.status === 'Failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                          {notification.status}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Calendar Button */}
        <div className="relative" ref={calendarRef}>
          <button
            onClick={handleCalendarClick}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors hidden sm:block"
          >
            <span className="material-symbols-outlined">calendar_today</span>
          </button>
          {showCalendarDropdown && (
            <div className="absolute right-0 mt-3 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-black text-gray-900 dark:text-gray-100 text-sm mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      navigate('/bookings');
                      setShowCalendarDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-3"
                  >
                    <span className="material-symbols-outlined text-gray-600 dark:text-gray-400">event</span>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">View Bookings</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Calendar & Schedule</p>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      navigate('/bookings?view=week');
                      setShowCalendarDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3"
                  >
                    <span className="material-symbols-outlined text-gray-600">calendar_view_week</span>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Week View</p>
                      <p className="text-xs text-gray-500">7-day schedule</p>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      navigate('/bookings?view=month');
                      setShowCalendarDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3"
                  >
                    <span className="material-symbols-outlined text-gray-600">calendar_view_month</span>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Month View</p>
                      <p className="text-xs text-gray-500">Full month calendar</p>
                    </div>
                  </button>
                </div>
              </div>
              <div className="p-4">
                <p className="text-xs text-gray-500 mb-2">Today: {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 mx-1"></div>

        {/* New Entry Button */}
        <button
          onClick={handleNewEntryClick}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl text-sm font-black transition-all duration-200 shadow-lg shadow-primary/25 active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span className="hidden lg:inline">{getNewEntryText()}</span>
        </button>

        {/* Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => {
              setShowProfileDropdown(!showProfileDropdown);
              setShowNotificationsDropdown(false);
              setShowCalendarDropdown(false);
            }}
            className="flex items-center gap-1 sm:gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <div className="size-7 sm:size-8 rounded-full bg-cover bg-center bg-no-repeat border-2 border-primary"
              style={{ backgroundImage: user?.avatar ? `url(${user.avatar})` : 'none', backgroundColor: user?.avatar ? 'transparent' : '#e5e7eb' }}>
              {!user?.avatar && (
                <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs">
                  <span className="material-symbols-outlined">person</span>
                </div>
              )}
            </div>
            <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 text-lg hidden sm:block">arrow_drop_down</span>
          </button>
          {showProfileDropdown && (
            <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-cover bg-center bg-no-repeat border-2 border-primary"
                    style={{ backgroundImage: user?.avatar ? `url(${user.avatar})` : 'none', backgroundColor: user?.avatar ? 'transparent' : '#e5e7eb' }}>
                    {!user?.avatar && (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                        <span className="material-symbols-outlined">person</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-900 dark:text-gray-100 truncate">{user?.name || 'User'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {user?.role === 'super_admin'
                        ? 'Super Admin'
                        : user?.role === 'venue_manager'
                          ? 'Venue Manager'
                          : 'Player'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-2">
                <button
                  onClick={() => {
                    navigate('/profile');
                    setShowProfileDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-gray-600 dark:text-gray-400">account_circle</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">View Profile</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
