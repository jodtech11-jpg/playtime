
import React from 'react';
import { Screen } from '../types';

interface BottomNavProps {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeScreen, onNavigate }) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'team-up', label: 'Team Up', icon: 'groups' },
    { id: 'social-feed', label: 'Feed', icon: 'sports_soccer' },
    { id: 'profile', label: 'Profile', icon: 'person' },
  ];

  return (
    <nav className="fixed bottom-0 z-40 w-full max-w-[480px] bg-white/90 dark:bg-background-dark/95 backdrop-blur-lg border-t border-gray-100 dark:border-white/5 pb-6 pt-3 shadow-[0_-1px_10px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-around">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id as Screen)}
            className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${
              activeScreen === item.id ? 'text-primary' : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            <span className={`material-symbols-outlined text-[26px] ${activeScreen === item.id ? 'fill-1' : ''}`}>
              {item.icon}
            </span>
            <span className={`text-[10px] font-bold`}>{item.label}</span>
          </button>
        ))}
      </div>
      
      {/* Central Floating Action Button Style Enhancement */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2">
        <button 
          onClick={() => onNavigate('sport-select')}
          className="flex items-center justify-center size-14 bg-primary text-background-dark rounded-full shadow-[0_4px_20px_rgba(13,242,89,0.4)] hover:scale-105 transition-transform"
        >
          <span className="material-symbols-outlined text-[30px] font-bold">add</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
