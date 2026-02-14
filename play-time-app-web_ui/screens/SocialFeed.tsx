
import React, { useState, useEffect } from 'react';
import { FEED_ITEMS } from '../constants';
import { Booking } from '../types';

interface SocialFeedProps {
  onBack: () => void;
}

const SocialFeed: React.FC<SocialFeedProps> = ({ onBack }) => {
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('playtime_bookings');
    if (saved) {
      const allBookings: Booking[] = JSON.parse(saved);
      const upcoming = allBookings.filter(b => b.status === 'Upcoming');
      setUpcomingBookings(upcoming);
    }
  }, []);

  const getSportIcon = (sport: string) => {
    switch (sport.toLowerCase()) {
      case 'football': return 'sports_soccer';
      case 'cricket': return 'sports_cricket';
      case 'badminton': return 'sports_tennis';
      default: return 'sports_basketball';
    }
  };

  return (
    <div className="flex flex-col h-full bg-background-dark overflow-y-auto no-scrollbar pb-32">
      <header className="sticky top-0 z-40 bg-background-dark/95 backdrop-blur-md px-4 pt-6 pb-2 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={onBack}
            className="flex items-center justify-center size-10 rounded-full bg-white/5 text-white active:scale-90 transition-transform"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-3">
             <button className="h-9 px-5 rounded-full border border-primary/30 text-primary text-xs font-black uppercase tracking-widest hover:bg-primary/10 transition-colors">
                Following
             </button>
             <button className="flex size-10 items-center justify-center rounded-full bg-white/5 text-white">
                <span className="material-symbols-outlined">more_vert</span>
             </button>
          </div>
        </div>
        
        <div className="flex items-end justify-between mt-2">
          <div>
            <h1 className="text-3xl font-black font-display leading-tight tracking-tight text-white">Chennai City Turf</h1>
            <div className="flex items-center gap-1.5 mt-1 text-secondary-text">
              <span className="material-symbols-outlined text-[18px]">location_on</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">Anna Nagar, Chennai</span>
            </div>
          </div>
          <div className="relative size-14 rounded-full overflow-hidden border-2 border-primary shadow-glow">
            <img 
              className="size-full object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD-P3Js0dIBdVa3ToEfeQ__OJb5fHOjx78139xk3gFCLWM0-euPpAYJiC0tIrNromY14Cbnntorvxtm_28vr-hGHAltmIrV_PuF1_B9OJ3wLvY1I4ub8Oo0Y7au1zEVsuerutIaFDmjBUfdjPHY12lJfXkOH6j_tflXVBMOodjA8n1oyGwpxRxCGAzdUKTYgb0iCMIHMZuZtFhejZT2RJQDzZIfsN3FReNt6Kri9EQ7rGbIAYFpgGzyc5qtLf0_6J7c8gRpaUqGoWqV" 
              alt="Logo"
            />
          </div>
        </div>
      </header>

      <div className="px-4 py-6">
        <div className="flex gap-3">
          {[
            { label: 'Rating', val: '4.8', icon: 'star', color: 'text-primary' },
            { label: 'Players', val: '1.2k' },
            { label: 'Matches', val: '250' }
          ].map((stat) => (
            <div key={stat.label} className="flex-1 flex flex-col gap-1 rounded-2xl bg-surface-dark border border-white/5 p-4 items-center text-center shadow-xl">
              <div className={`flex items-center gap-1 ${stat.color || 'text-white'}`}>
                <span className="text-2xl font-black leading-tight tracking-tighter">{stat.val}</span>
                {stat.icon && <span className="material-symbols-outlined text-[18px] fill-1">{stat.icon}</span>}
              </div>
              <p className="text-gray-500 text-[9px] font-black uppercase tracking-[0.15em]">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 px-4 pb-6 overflow-x-auto no-scrollbar">
        {['Recent Matches', 'Top Highlights', 'Upcoming'].map((chip, i) => (
          <button 
            key={chip}
            className={`shrink-0 h-9 px-6 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${
              i === 0 ? 'bg-primary text-background-dark shadow-glow' : 'bg-surface-dark text-gray-400 border border-white/5'
            }`}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-10 px-4">
        {FEED_ITEMS.map((item) => (
          <div key={item.id} className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-gradient-to-br from-primary/80 to-blue-500/80 p-[2px]">
                  <div className="size-full rounded-full border-2 border-background-dark overflow-hidden bg-gray-700 flex items-center justify-center">
                    <span className="text-lg">⚽</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-black text-sm tracking-tight">{item.title}</span>
                  <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">{item.time}</span>
                </div>
              </div>
              <button className="text-gray-600"><span className="material-symbols-outlined">more_horiz</span></button>
            </div>

            {item.type === 'live' ? (
              <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden bg-surface-dark shadow-2xl border border-white/5">
                <div className="absolute inset-0 flex">
                  <div className="w-1/2 h-full relative border-r border-white/10">
                    <img src={item.teamA.logo} className="size-full object-cover opacity-60" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                    <div className="absolute bottom-4 left-4">
                      <p className="text-white font-black text-lg leading-tight uppercase tracking-tighter drop-shadow-lg">{item.teamA.name.replace(' ', '\n')}</p>
                    </div>
                  </div>
                  <div className="w-1/2 h-full relative">
                    <img src={item.teamB.logo} className="size-full object-cover opacity-60" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                    <div className="absolute bottom-4 right-4 text-right">
                      <p className="text-white font-black text-lg leading-tight uppercase tracking-tighter drop-shadow-lg">{item.teamB.name.replace(' ', '\n')}</p>
                    </div>
                  </div>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <div className="size-14 rounded-full bg-primary flex items-center justify-center shadow-glow border-[4px] border-background-dark transition-transform hover:scale-110">
                    <span className="font-black text-background-dark text-xl italic pr-0.5">VS</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden bg-surface-dark shadow-2xl border border-white/5">
                <img className="size-full object-cover opacity-30 blur-sm" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDt4QbaMgaB9tKIIRII3R86jshjF3qCn3thaI2JJJz6rBaJPL-9vDNwL3WkFPn0AA7fhRCBTXH-sEN3uPkHmj69_FHqn4OQKHlb6HMjpvUP8IJ7O3IKsbN4vLaVsUUC_9v0rPbNyd8lgUjEG98XFbTRpj-bmveKl7fLoyT6EzbrvFubwQuYd-5YZrZuFcyx9D8xcaDj7OoFv8hcNS_0o66WxVS34jYJdWI-IlmaQ0ab-C9zXB2nq_1SayDWNc0SE6CjysLsMTQQL9_r" alt="" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6">
                   <div className="flex items-center w-full justify-around">
                      <div className="flex flex-col items-center gap-2">
                        <div className="size-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md shadow-inner">
                          <span className="text-3xl">{item.teamA.icon}</span>
                        </div>
                        <span className="text-white font-black text-xs uppercase tracking-widest">{item.teamA.name}</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className="bg-black/60 rounded-2xl px-6 py-3 border border-white/10 backdrop-blur-md shadow-2xl">
                          <span className="text-4xl font-black text-primary tracking-tighter">{item.teamA.score} - {item.teamB.score}</span>
                        </div>
                        <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em] bg-white/5 px-3 py-1 rounded-full">Full Time</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className="size-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md shadow-inner">
                          <span className="text-3xl">{item.teamB.icon}</span>
                        </div>
                        <span className="text-white font-black text-xs uppercase tracking-widest">{item.teamB.name}</span>
                      </div>
                   </div>
                </div>
                <div className="absolute top-4 right-4">
                  <div className="bg-primary text-background-dark text-[9px] font-black px-3 py-1.5 rounded-xl shadow-2xl flex items-center gap-1 uppercase tracking-widest">
                    <span className="material-symbols-outlined text-[14px] font-black">emoji_events</span>
                    {item.teamA.name} Won
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 px-1">
              <p className="text-gray-300 text-sm leading-relaxed font-medium">{item.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex gap-6">
                  <button className="flex items-center gap-2 text-primary group transition-all">
                    <span className="material-symbols-outlined fill-1 transition-transform group-active:scale-90">favorite</span>
                    <span className="text-sm font-black">{item.likes}</span>
                  </button>
                  <button className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors">
                    <span className="material-symbols-outlined">chat_bubble</span>
                    <span className="text-sm font-bold">{item.comments}</span>
                  </button>
                </div>
                <button className="flex items-center gap-2 bg-white/5 border border-white/10 py-2 px-5 rounded-2xl shadow-xl transition-all active:scale-95">
                   <span className="material-symbols-outlined text-primary text-[20px]">ios_share</span>
                   <span className="text-[10px] font-black text-white uppercase tracking-widest">Share</span>
                </button>
              </div>
            </div>

            {/* User's Upcoming Bookings Nudge Section */}
            {upcomingBookings.length > 0 && (
              <div className="mt-2 bg-surface-dark border border-primary/20 rounded-[28px] overflow-hidden shadow-glow transition-all hover:border-primary/40 group">
                <div className="bg-primary/5 px-5 py-3 border-b border-primary/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-sm animate-pulse">event_upcoming</span>
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Your Upcoming Schedule</span>
                  </div>
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Player Pass</span>
                </div>
                
                <div className="p-5 flex flex-col gap-4">
                  {upcomingBookings.slice(0, 1).map((booking) => (
                    <div key={booking.id} className="flex items-center gap-4">
                      <div className="size-14 shrink-0 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center text-primary group-hover:scale-105 transition-transform duration-300">
                        <span className="material-symbols-outlined text-3xl">{getSportIcon(booking.sport)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white text-base font-black font-display truncate leading-tight">{booking.venueName}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                            <span className="text-xs font-bold tracking-tight">{booking.date}</span>
                          </div>
                          <div className="size-1 rounded-full bg-gray-700"></div>
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <span className="material-symbols-outlined text-[16px]">schedule</span>
                            <span className="text-xs font-bold tracking-tight">{booking.time}</span>
                          </div>
                        </div>
                      </div>
                      <button className="size-10 flex items-center justify-center rounded-xl bg-primary text-background-dark shadow-glow active:scale-90 transition-transform">
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    </div>
                  ))}
                </div>
                
                {upcomingBookings.length > 1 && (
                  <div className="px-5 pb-4">
                    <button className="w-full py-2 bg-white/5 border border-white/5 rounded-xl text-[9px] font-black text-gray-400 uppercase tracking-widest hover:bg-white/10 transition-colors">
                      + {upcomingBookings.length - 1} more bookings
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <div className="h-px w-full bg-white/5 mt-4"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SocialFeed;
