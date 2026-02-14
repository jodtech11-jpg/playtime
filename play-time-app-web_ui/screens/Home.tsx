
import React, { useState, useMemo } from 'react';
import { VENUES } from '../constants';
import { Venue } from '../types';

interface HomeProps {
  onVenueClick: () => void;
  onMapClick: () => void;
  onNotificationsClick: () => void;
}

const Home: React.FC<HomeProps> = ({ onVenueClick, onMapClick, onNotificationsClick }) => {
  const [activeCategory, setActiveCategory] = useState<string>('Cricket');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number>(1500);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [voted, setVoted] = useState(false);
  const [selectedPollOption, setSelectedPollOption] = useState<string | null>(null);

  const categories = [
    { name: 'Cricket', icon: 'sports_cricket' },
    { name: 'Football', icon: 'sports_soccer' },
    { name: 'Badminton', icon: 'sports_tennis' },
    { name: 'Swimming', icon: 'pool' },
  ];

  const flashDeals = [
    { id: 'fd1', title: 'Last Minute: 40% OFF', venue: 'Marina Turf', time: 'Starting in 45m', color: 'from-orange-500 to-red-600' },
    { id: 'fd2', title: 'Happy Hour: ₹300/hr', venue: 'Blue Court', time: '2 PM - 4 PM', color: 'from-blue-500 to-indigo-600' },
  ];

  const topPlayers = [
    { rank: 1, name: 'Vikram S.', points: 2840, avatar: 'https://i.pravatar.cc/150?u=1', medal: 'gold' },
    { rank: 2, name: 'Sanya R.', points: 2610, avatar: 'https://i.pravatar.cc/150?u=2', medal: 'silver' },
    { rank: 3, name: 'Arjun K.', points: 2450, avatar: 'https://i.pravatar.cc/150?u=3', medal: 'bronze' },
  ];

  const trendingEvents = [
    { id: 'e1', title: 'Midnight League', sport: 'Football', image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=400', date: 'Starts 25 Oct', players: 120 },
    { id: 'e2', title: 'Smash Masters', sport: 'Badminton', image: 'https://images.unsplash.com/photo-1626225967045-2c897f473371?auto=format&fit=crop&q=80&w=400', date: 'Registration Open', players: 45 },
  ];

  const quickMatches = [
    { id: 'qm1', venue: 'Super Strikers', time: '18:00', playersNeeded: 2, icon: '⚽' },
    { id: 'qm2', venue: 'Marina Turf', time: '20:30', playersNeeded: 1, icon: '🏏' },
    { id: 'qm3', venue: 'Blue Court', time: '07:00', playersNeeded: 1, icon: '🏸' },
  ];

  const amenitiesOptions = ['Parking', 'Water', 'Changing Room', 'Floodlights'];

  const filteredVenues = useMemo(() => {
    return VENUES.filter((venue: Venue) => {
      const matchesCategory = venue.categories.includes(activeCategory);
      const matchesSearch = venue.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPrice = venue.price <= maxPrice;
      const matchesAmenities = selectedAmenities.length === 0 || 
        selectedAmenities.every(amenity => venue.amenities?.includes(amenity));
      
      return matchesCategory && matchesSearch && matchesPrice && matchesAmenities;
    });
  }, [activeCategory, searchQuery, maxPrice, selectedAmenities]);

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
  };

  return (
    <div className="flex flex-col h-full bg-background-dark overflow-hidden relative">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background-dark/95 backdrop-blur-md px-4 pt-6 pb-2 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-primary border border-white/5 transition-all group-hover:bg-primary/10">
              <span className="material-symbols-outlined text-xl">location_on</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-secondary-text uppercase tracking-[0.15em]">Play at</span>
              <div className="flex items-center gap-1">
                <h2 className="text-sm font-black text-white font-display">Chennai, TN</h2>
                <span className="material-symbols-outlined text-sm text-primary">expand_more</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onNotificationsClick}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white transition-all active:scale-90 border border-white/5 hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-primary border-2 border-background-dark shadow-glow"></span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Welcome Section & Stats */}
        <div className="px-4 py-6 space-y-4">
          <h1 className="text-3xl font-black font-display leading-tight text-white tracking-tight">
            Ready to Play, <br />
            <span className="text-primary">Arjun?</span>
          </h1>
          
          {/* Progress Bar Module */}
          <div className="bg-surface-dark border border-white/5 rounded-3xl p-4 flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <span className="material-symbols-outlined text-primary">military_tech</span>
              </div>
              <div>
                <p className="text-white text-xs font-black uppercase tracking-widest">Level 12</p>
                <div className="w-24 h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-primary w-3/4 rounded-full"></div>
                </div>
              </div>
            </div>
            <div className="h-8 w-px bg-white/5 mx-2"></div>
            <div className="flex flex-col items-center">
               <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-orange-500 text-base animate-pulse">local_fire_department</span>
                  <span className="text-white font-black text-sm">4 Day Streak</span>
               </div>
               <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">+20 XP Tomorrow</p>
            </div>
          </div>
        </div>

        {/* Search & Categories */}
        <div className="px-4 space-y-6">
          <div className="flex w-full items-center gap-3">
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <span className="material-symbols-outlined text-gray-500 text-xl transition-colors group-focus-within:text-primary">search</span>
              </div>
              <input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full h-14 rounded-2xl border-none bg-surface-dark py-4 pl-12 pr-4 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-primary/50 shadow-inner transition-all" 
                placeholder="Search turfs or tournaments..." 
                type="text" 
              />
            </div>
            <button 
              onClick={() => setIsFilterOpen(true)}
              className={`flex size-14 flex-none items-center justify-center rounded-2xl shadow-xl transition-all active:scale-95 ${
                isFilterOpen || selectedAmenities.length > 0 || maxPrice < 1500 
                  ? 'bg-primary text-background-dark shadow-glow' 
                  : 'bg-surface-dark text-gray-500 border border-white/5'
              }`}
            >
              <span className="material-symbols-outlined font-black">tune</span>
            </button>
          </div>

          <div className="w-full overflow-x-auto no-scrollbar -mx-4">
            <div className="flex gap-3 px-4">
              {categories.map((cat) => (
                <button 
                  key={cat.name}
                  onClick={() => setActiveCategory(cat.name)}
                  className={`flex items-center gap-2 rounded-2xl px-6 py-3 transition-all active:scale-95 whitespace-nowrap border ${
                    activeCategory === cat.name 
                      ? 'bg-primary border-primary text-background-dark font-black shadow-glow' 
                      : 'bg-surface-dark border-white/5 text-white/80 font-bold'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[20px] ${activeCategory === cat.name ? 'fill-1' : ''}`}>{cat.icon}</span>
                  <span className="text-xs uppercase tracking-widest">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section: Flash Deals */}
        <section className="mt-8 px-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black font-display text-white tracking-tight italic uppercase">Flash Deals ⚡️</h2>
            <div className="flex gap-1.5 items-center">
              <span className="size-1.5 rounded-full bg-red-500 animate-ping"></span>
              <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Ending Soon</span>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {flashDeals.map((deal) => (
              <div key={deal.id} className={`min-w-[240px] p-5 rounded-[32px] bg-gradient-to-br ${deal.color} shadow-2xl relative overflow-hidden group cursor-pointer active:scale-95 transition-all`}>
                <div className="absolute top-0 right-0 size-24 bg-white/10 -mr-8 -mt-8 rounded-full blur-2xl"></div>
                <h3 className="text-white font-black text-sm tracking-tight mb-1">{deal.title}</h3>
                <p className="text-white/80 text-[10px] font-black uppercase tracking-widest">{deal.venue}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="bg-black/20 backdrop-blur-md px-2.5 py-1 rounded-lg text-white text-[9px] font-black">{deal.time}</span>
                  <span className="material-symbols-outlined text-white">bolt</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section: Trending Tournaments */}
        <section className="mt-10">
          <div className="flex items-center justify-between px-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">local_fire_department</span>
              <h2 className="text-lg font-black font-display text-white tracking-tight">Hot & Trending</h2>
            </div>
            <button className="text-[10px] font-black text-primary uppercase tracking-[0.2em] px-2 py-1 bg-primary/10 rounded-lg">View All</button>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 pb-2">
            {trendingEvents.map((event) => (
              <div key={event.id} className="relative min-w-[280px] h-[160px] rounded-3xl overflow-hidden border border-white/5 shadow-2xl group cursor-pointer">
                <img src={event.image} className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/20 to-transparent"></div>
                <div className="absolute top-3 left-3 bg-primary/20 backdrop-blur-md border border-primary/30 px-3 py-1 rounded-xl">
                  <span className="text-[9px] font-black text-primary uppercase tracking-widest">{event.sport}</span>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-white text-lg font-black font-display leading-tight">{event.title}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-gray-300 text-[10px] font-bold">{event.date}</span>
                    <span className="text-primary text-[10px] font-black">{event.players}+ Joining</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section: Community Leaderboard Snippet */}
        <section className="mt-10 px-4">
           <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black font-display text-white tracking-tight">Local Legends</h2>
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Anna Nagar Div</span>
          </div>
          <div className="bg-surface-dark rounded-[32px] border border-white/5 p-2 overflow-hidden shadow-2xl">
            {topPlayers.map((player, idx) => (
              <div key={player.rank} className={`flex items-center justify-between p-4 rounded-2xl ${idx !== topPlayers.length - 1 ? 'border-b border-white/5' : ''} transition-all hover:bg-white/5 cursor-pointer`}>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img src={player.avatar} className="size-10 rounded-full border border-white/10" alt="" />
                    <span className={`absolute -top-1 -right-1 size-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-surface-dark ${
                      player.medal === 'gold' ? 'bg-yellow-500 text-yellow-950' : 
                      player.medal === 'silver' ? 'bg-gray-300 text-gray-800' : 
                      'bg-amber-600 text-amber-950'
                    }`}>
                      {player.rank}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-white text-sm font-black">{player.name}</h4>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{player.points} Play Points</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-gray-600 text-sm">chevron_right</span>
              </div>
            ))}
          </div>
        </section>

        {/* Section: Join a Quick Match */}
        <section className="mt-10">
          <div className="flex items-center justify-between px-4 mb-4">
            <h2 className="text-lg font-black font-display text-white tracking-tight">Join a Quick Match</h2>
            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Players nearby</p>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar px-4">
            {quickMatches.map((match) => (
              <div key={match.id} className="min-w-[160px] bg-surface-dark border border-white/5 rounded-[32px] p-5 flex flex-col items-center text-center shadow-xl transition-all hover:border-primary/30 group">
                <div className="size-14 rounded-2xl bg-white/5 flex items-center justify-center text-3xl mb-3 shadow-inner group-hover:scale-110 transition-transform">
                  {match.icon}
                </div>
                <h4 className="text-white text-xs font-black truncate w-full mb-1">{match.venue}</h4>
                <p className="text-gray-500 text-[9px] font-bold mb-4 uppercase tracking-widest">{match.time} • Today</p>
                <button className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-background-dark transition-all">
                  Join ({match.playersNeeded})
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Section: Poll of the Day */}
        <section className="mt-10 px-4">
          <div className="bg-primary/5 border border-primary/20 rounded-[32px] p-6 shadow-2xl">
            <h3 className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-3">Daily Face-Off</h3>
            <p className="text-white text-base font-black font-display mb-6">Best surface for Football?</p>
            <div className="space-y-3">
              {[
                { label: 'Natural Grass', votes: '42%' },
                { label: 'Artificial Turf', votes: '58%' }
              ].map((opt) => {
                const isSelected = selectedPollOption === opt.label;
                return (
                  <button 
                    key={opt.label}
                    onClick={() => {
                      if (!voted) {
                        setSelectedPollOption(opt.label);
                        setVoted(true);
                      }
                    }}
                    className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all ${
                      voted && isSelected 
                        ? 'bg-primary/10 border-primary/30' 
                        : voted 
                        ? 'bg-surface-dark border-white/5' 
                        : 'bg-surface-dark border-white/5 active:bg-white/10'
                    }`}
                  >
                    <span className={`text-xs font-bold ${voted && isSelected ? 'text-white' : 'text-white'}`}>{opt.label}</span>
                    {voted && <span className="text-primary text-[10px] font-black">{opt.votes}</span>}
                  </button>
                );
              })}
            </div>
            {voted && <p className="text-center text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-4">2.4k community members voted</p>}
          </div>
        </section>

        {/* Section: Nearby Venues */}
        <section className="mt-12 px-4 pb-32">
          <div className="flex items-center justify-between py-2 mb-6">
            <h2 className="text-2xl font-black font-display text-white tracking-tight">
              Nearby Arenas
            </h2>
            <div className="flex items-center gap-1.5 text-gray-500 text-[10px] font-black uppercase tracking-widest">
              <span>Sort: Best Rated</span>
              <span className="material-symbols-outlined text-[14px]">expand_more</span>
            </div>
          </div>

          <div className="space-y-8">
            {filteredVenues.map((venue) => (
              <div 
                key={venue.id}
                onClick={onVenueClick}
                className="group relative flex w-full flex-col overflow-hidden rounded-[32px] bg-surface-dark border border-white/5 transition-all active:scale-[0.98] cursor-pointer shadow-2xl"
              >
                <div className="relative h-56 w-full overflow-hidden">
                  <img 
                    src={venue.image} 
                    alt={venue.name} 
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background-dark/80 via-transparent to-transparent"></div>
                  
                  {/* Status Badges */}
                  <div className="absolute right-4 top-4 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 rounded-xl bg-black/60 px-3 py-1.5 backdrop-blur-md border border-white/10 shadow-xl">
                      <span className="material-symbols-outlined text-[16px] text-yellow-400 fill-1">star</span>
                      <span className="text-xs font-black text-white">{venue.rating}</span>
                    </div>
                    {venue.price < 600 && (
                      <div className="bg-primary/20 backdrop-blur-md border border-primary/40 px-3 py-1.5 rounded-xl">
                        <span className="text-[9px] font-black text-primary uppercase tracking-widest italic">Budget Choice</span>
                      </div>
                    )}
                  </div>

                  <div className="absolute left-4 bottom-4 flex gap-2">
                    {venue.amenities?.slice(0, 2).map(amenity => (
                      <span key={amenity} className="bg-white/10 backdrop-blur-md text-[9px] text-white px-3 py-1.5 rounded-xl border border-white/10 uppercase tracking-widest font-black">
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-black text-white font-display tracking-tight leading-none mb-2">{venue.name}</h3>
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <span className="material-symbols-outlined text-[18px] text-primary">location_on</span>
                        <p className="text-[11px] font-bold uppercase tracking-wider">{venue.location} • {venue.distance} away</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Starting at</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-primary tracking-tighter">₹{venue.price}</span>
                        <span className="text-[10px] font-black text-gray-600 uppercase">/hr</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex gap-3">
                    <button className="flex-1 h-12 rounded-2xl bg-primary text-background-dark text-xs font-black uppercase tracking-widest shadow-glow active:scale-95 transition-all">
                      Book Pass
                    </button>
                    <button className="size-12 rounded-2xl bg-white/5 border border-white/5 text-white flex items-center justify-center transition-all hover:bg-white/10">
                      <span className="material-symbols-outlined">favorite</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredVenues.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="size-20 rounded-full bg-surface-dark border border-white/5 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-4xl text-gray-600">sports_kabaddi</span>
              </div>
              <p className="text-white font-black font-display text-lg">No turfs found</p>
              <p className="text-gray-500 text-sm mt-1">Try adjusting your filters or category.</p>
            </div>
          )}
        </section>
      </div>

      {/* Filter Modal */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-[480px] bg-surface-dark rounded-[40px] overflow-hidden shadow-2xl border border-white/10 animate-in slide-in-from-bottom duration-500">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black font-display text-white tracking-tight">Filters</h3>
                <button 
                  onClick={() => setIsFilterOpen(false)}
                  className="size-12 flex items-center justify-center rounded-full bg-white/5 text-gray-400 border border-white/5 transition-transform active:scale-90"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-10">
                {/* Price Range */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Max Hourly Price</label>
                    <span className="text-primary font-black text-xl tracking-tighter">₹{maxPrice}</span>
                  </div>
                  <div className="px-2">
                    <input 
                      type="range" 
                      min="200" 
                      max="1500" 
                      step="50"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(parseInt(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                  <div className="flex justify-between mt-3 text-[10px] text-gray-600 font-black uppercase tracking-widest">
                    <span>₹200</span>
                    <span>₹1500</span>
                  </div>
                </div>

                {/* Amenities */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-gray-500 mb-6">Must-Have Amenities</label>
                  <div className="grid grid-cols-2 gap-4">
                    {amenitiesOptions.map((amenity) => (
                      <button
                        key={amenity}
                        onClick={() => toggleAmenity(amenity)}
                        className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                          selectedAmenities.includes(amenity)
                            ? 'bg-primary/10 border-primary text-primary shadow-glow'
                            : 'bg-white/5 border-white/5 text-gray-500'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[22px] font-black">
                          {selectedAmenities.includes(amenity) ? 'check_circle' : 'circle'}
                        </span>
                        <span className="text-xs font-black uppercase tracking-widest">{amenity}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-12 flex gap-4">
                <button 
                  onClick={() => {
                    setMaxPrice(1500);
                    setSelectedAmenities([]);
                  }}
                  className="flex-1 py-4 rounded-2xl border border-white/5 text-gray-500 font-black text-xs uppercase tracking-widest transition-all active:bg-white/5"
                >
                  Reset
                </button>
                <button 
                  onClick={() => setIsFilterOpen(false)}
                  className="flex-[2] py-4 rounded-2xl bg-primary text-background-dark font-black text-xs uppercase tracking-widest shadow-glow active:scale-[0.98] transition-all"
                >
                  Apply Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button for Map */}
      <div className="fixed bottom-28 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <button 
          onClick={onMapClick}
          className="pointer-events-auto flex items-center gap-3 rounded-full bg-white text-background-dark px-8 py-4 shadow-2xl hover:scale-105 transition-all active:scale-95 shadow-[0_15px_35px_rgba(0,0,0,0.4)]"
        >
          <span className="material-symbols-outlined text-[22px] font-black">map</span>
          <span className="text-xs font-black uppercase tracking-[0.2em]">Explore Map</span>
        </button>
      </div>
    </div>
  );
};

export default Home;
