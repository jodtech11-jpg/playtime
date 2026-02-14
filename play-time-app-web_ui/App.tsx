
import React, { useState, useEffect } from 'react';
import { Screen } from './types';
import Login from './screens/Login';
import Home from './screens/Home';
import VenueDetail from './screens/VenueDetail';
import TeamUp from './screens/TeamUp';
import Marketplace from './screens/Marketplace';
import Profile from './screens/Profile';
import Membership from './screens/Membership';
import SportSelect from './screens/SportSelect';
import SocialFeed from './screens/SocialFeed';
import MapView from './screens/MapView';
import Notifications from './screens/Notifications';
import BottomNav from './components/BottomNav';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock authentication check using local storage
    const savedUser = localStorage.getItem('playtime_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      if (currentScreen === 'login') setCurrentScreen('home');
    } else {
      setCurrentScreen('login');
    }
    setLoading(false);
  }, [currentScreen]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background-dark">
        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const handleLoginSuccess = () => {
    const dummyUser = { uid: 'user_123', displayName: 'Arjun Kumar', photoURL: null };
    localStorage.setItem('playtime_user', JSON.stringify(dummyUser));
    setUser(dummyUser);
    setCurrentScreen('home');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login': return <Login onLogin={handleLoginSuccess} />;
      case 'home': return (
        <Home 
          onVenueClick={() => setCurrentScreen('venue-detail')} 
          onMapClick={() => setCurrentScreen('map-view')}
          onNotificationsClick={() => setCurrentScreen('notifications')}
        />
      );
      case 'map-view': return <MapView onBack={() => setCurrentScreen('home')} onVenueClick={() => setCurrentScreen('venue-detail')} />;
      case 'notifications': return <Notifications onBack={() => setCurrentScreen('home')} />;
      case 'venue-detail': return <VenueDetail onBack={() => setCurrentScreen('home')} />;
      case 'team-up': return <TeamUp />;
      case 'marketplace': return <Marketplace onBack={() => setCurrentScreen('home')} />;
      case 'profile': return <Profile onVenueClick={() => setCurrentScreen('venue-detail')} />;
      case 'membership': return <Membership onBack={() => setCurrentScreen('profile')} />;
      case 'sport-select': return <SportSelect onBack={() => setCurrentScreen('home')} onSportClick={() => setCurrentScreen('home')} />;
      case 'social-feed': return <SocialFeed onBack={() => setCurrentScreen('home')} />;
      default: return <Home onVenueClick={() => setCurrentScreen('venue-detail')} />;
    }
  };

  return (
    <div className="mx-auto flex h-full min-h-screen w-full max-w-[480px] flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-body shadow-2xl relative">
      {renderScreen()}
      {currentScreen !== 'login' && currentScreen !== 'map-view' && (
        <BottomNav activeScreen={currentScreen} onNavigate={setCurrentScreen} />
      )}
    </div>
  );
};

export default App;
