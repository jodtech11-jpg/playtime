
import React, { useState } from 'react';
import { VENUES } from '../constants';
import { Venue } from '../types';

interface MapViewProps {
  onBack: () => void;
  onVenueClick: () => void;
}

const MapView: React.FC<MapViewProps> = ({ onBack, onVenueClick }) => {
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(VENUES[0]);

  return (
    <div className="flex flex-col h-full bg-background-dark overflow-hidden relative">
      {/* Header Overlay */}
      <header className="absolute top-0 left-0 right-0 z-30 p-4">
        <div className="flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex size-12 items-center justify-center rounded-2xl bg-surface-dark/80 backdrop-blur-xl border border-white/10 text-white transition-transform active:scale-90"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          
          <div className="flex items-center gap-2 bg-surface-dark/80 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl shadow-2xl">
            <span className="material-symbols-outlined text-primary text-sm font-black">my_location</span>
            <span className="text-white text-xs font-black uppercase tracking-widest">Chennai Hub</span>
          </div>

          <button className="flex size-12 items-center justify-center rounded-2xl bg-surface-dark/80 backdrop-blur-xl border border-white/10 text-white transition-transform active:scale-90">
            <span className="material-symbols-outlined">layers</span>
          </button>
        </div>
      </header>

      {/* Stylized Mock Map */}
      <div className="relative w-full h-full bg-[#0a1a10] overflow-hidden">
        {/* Background Grid/Texture for map look */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #0df259 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        
        {/* Abstract "Roads" and "Parks" using CSS shapes */}
        <div className="absolute top-[20%] left-[-10%] w-[120%] h-4 bg-white/5 rotate-12"></div>
        <div className="absolute top-[50%] left-[-10%] w-[120%] h-8 bg-white/5 -rotate-6"></div>
        <div className="absolute left-[30%] top-[-10%] w-6 h-[120%] bg-white/5 rotate-3"></div>
        <div className="absolute right-[20%] bottom-0 w-[40%] h-[30%] bg-primary/5 rounded-full blur-3xl"></div>

        {/* Venue Markers */}
        {VENUES.map((venue, idx) => (
          <button
            key={venue.id}
            onClick={() => setSelectedVenue(venue)}
            className={`absolute transition-all duration-500 transform ${
              selectedVenue?.id === venue.id ? 'scale-125 z-20' : 'z-10 hover:scale-110'
            }`}
            style={{ 
              top: `${25 + idx * 15}%`, 
              left: `${20 + idx * 25}%` 
            }}
          >
            <div className="relative flex flex-col items-center">
              <div className={`p-1.5 rounded-full border-2 shadow-glow animate-in zoom-in duration-500 delay-${idx * 100} ${
                selectedVenue?.id === venue.id ? 'bg-primary border-background-dark scale-110' : 'bg-surface-dark border-primary/40'
              }`}>
                <span className={`material-symbols-outlined text-[20px] font-black ${
                  selectedVenue?.id === venue.id ? 'text-background-dark' : 'text-primary'
                }`}>
                  {venue.categories[0] === 'Cricket' ? 'sports_cricket' : 'sports_soccer'}
                </span>
              </div>
              <div className={`mt-1 px-3 py-1 rounded-lg backdrop-blur-md border text-[9px] font-black uppercase tracking-widest transition-all ${
                selectedVenue?.id === venue.id ? 'bg-primary text-background-dark border-primary shadow-glow' : 'bg-surface-dark/60 text-white border-white/10'
              }`}>
                {venue.name.split(' ')[0]}
              </div>
              {/* Radar Ping Effect for active */}
              {selectedVenue?.id === venue.id && (
                <div className="absolute -top-1 -left-1 -right-1 -bottom-1 rounded-full border-2 border-primary animate-ping opacity-50"></div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Floating UI Elements */}
      <div className="absolute bottom-[180px] right-5 flex flex-col gap-3">
        <button className="flex size-12 items-center justify-center rounded-2xl bg-surface-dark/80 backdrop-blur-xl border border-white/10 text-white shadow-2xl active:scale-90 transition-transform">
          <span className="material-symbols-outlined">center_focus_strong</span>
        </button>
        <button className="flex size-12 items-center justify-center rounded-2xl bg-primary text-background-dark shadow-glow active:scale-90 transition-transform">
          <span className="material-symbols-outlined font-black text-2xl">add</span>
        </button>
      </div>

      {/* Bottom Preview Card */}
      <div className="fixed bottom-28 left-0 right-0 px-4 animate-in slide-in-from-bottom duration-500">
        {selectedVenue && (
          <div 
            onClick={onVenueClick}
            className="w-full max-w-[440px] mx-auto bg-surface-dark/90 backdrop-blur-2xl border border-white/10 rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex gap-4 p-4 group cursor-pointer active:scale-[0.98] transition-all"
          >
            <div className="relative size-28 shrink-0 rounded-2xl overflow-hidden">
              <img src={selectedVenue.image} className="size-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-lg border border-white/10 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px] text-yellow-400 fill-1">star</span>
                <span className="text-[10px] text-white font-black">{selectedVenue.rating}</span>
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-between py-1">
              <div className="space-y-1">
                <h3 className="text-white text-lg font-black font-display tracking-tight leading-tight">{selectedVenue.name}</h3>
                <div className="flex items-center gap-1.5 text-gray-400">
                  <span className="material-symbols-outlined text-[16px]">location_on</span>
                  <span className="text-[11px] font-bold">{selectedVenue.location} • {selectedVenue.distance}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-2">
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Starting</span>
                  <p className="text-primary text-lg font-black leading-none">₹{selectedVenue.price}<span className="text-[10px] text-gray-500 ml-1">/hr</span></p>
                </div>
                <button className="bg-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase text-background-dark tracking-widest shadow-glow">
                  Book
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map/List Switcher Button */}
      <div className="fixed bottom-8 left-0 right-0 flex justify-center z-50">
        <button 
          onClick={onBack}
          className="bg-white text-background-dark px-8 py-3 rounded-full flex items-center gap-3 shadow-2xl active:scale-95 transition-all font-black text-xs uppercase tracking-[0.2em]"
        >
          <span className="material-symbols-outlined text-[18px]">list</span>
          List View
        </button>
      </div>
    </div>
  );
};

export default MapView;
