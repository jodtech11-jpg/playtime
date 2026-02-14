
import React, { useState, useMemo, useEffect } from 'react';
import { Booking } from '../types';

interface VenueDetailProps {
  onBack: () => void;
}

const VenueDetail: React.FC<VenueDetailProps> = ({ onBack }) => {
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);

  // Generate next 7 days
  const dates = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      result.push({
        dayName: days[d.getDay()],
        dateNum: d.getDate(),
        month: months[d.getMonth()],
        fullDate: `${d.getDate()} ${months[d.getMonth()]}, ${d.getFullYear()}`
      });
    }
    return result;
  }, []);

  const timeSlots = [
    { id: 't1', time: '06:00 AM', available: true },
    { id: 't2', time: '07:00 AM', available: true },
    { id: 't3', time: '08:00 AM', available: false },
    { id: 't4', time: '05:00 PM', available: true },
    { id: 't5', time: '06:00 PM', available: true },
    { id: 't6', time: '07:00 PM', available: true },
    { id: 't7', time: '08:00 PM', available: false },
    { id: 't8', time: '09:00 PM', available: true },
    { id: 't9', time: '10:00 PM', available: true },
  ];

  const handleBookSlot = async () => {
    setShowConfirmDialog(false);
    setIsBooking(true);
    
    // Simulate API delay
    setTimeout(() => {
      const selectedSlot = timeSlots.find(s => s.id === selectedSlotId);
      const selectedDate = dates[selectedDateIndex];
      
      const newBooking: Booking = {
        id: `booking_${Date.now()}`,
        venueName: 'Super Kick Turf - Chennai',
        venueImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBpcXgLNE4FR6g931PXXxOZHGryUCy63m4L0DlmGrXXll6X88njfCmAKlek9AmavlqPEDk1oTKyspOVsOUU4ideXmnG0uYUn1RIxVelyFrUZhQE7GgzJcjXkKtUSIjE8p-CeiTtlniUkb0M-2TeuMHXBE0jgHff33kPOG1fLK0f3bVD8Y-AgpJ9GNPNl_MzxaAe7jfbxTolyfw1j7ZJsSlrDC7AIF9zN43nqokBwPaMYGY6hvPdg6Njdl2CKIP3qTcYQuY9lwPpa-H3',
        date: selectedDate.fullDate,
        time: selectedSlot?.time || '',
        amount: 800,
        sport: 'Football',
        status: 'Upcoming'
      };

      // Store in local storage
      const existingBookings = JSON.parse(localStorage.getItem('playtime_bookings') || '[]');
      localStorage.setItem('playtime_bookings', JSON.stringify([...existingBookings, newBooking]));
      
      setIsBooking(false);
      setBookingSuccess(true);
    }, 1500);
  };

  useEffect(() => {
    let interval: any;
    if (isHolding && agreedToTerms) {
      interval = setInterval(() => {
        setHoldProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            handleBookSlot();
            return 100;
          }
          return prev + 5;
        });
      }, 50);
    } else {
      setHoldProgress(0);
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isHolding, agreedToTerms]);

  const selectedSlot = timeSlots.find(s => s.id === selectedSlotId);

  if (bookingSuccess) {
    return (
      <div className="flex flex-col h-full bg-background-dark items-center justify-center p-6 text-center animate-in fade-in duration-500">
        <div className="size-24 rounded-full bg-primary/20 flex items-center justify-center mb-6 border border-primary/30 shadow-glow">
          <span className="material-symbols-outlined text-primary text-5xl font-black">check_circle</span>
        </div>
        <h2 className="text-white text-3xl font-black font-display mb-2">Booking Confirmed!</h2>
        <p className="text-secondary-text mb-8">Your slot at Super Kick Turf is secured. Get ready to play!</p>
        
        <div className="w-full bg-surface-dark rounded-3xl p-6 border border-white/5 mb-10 text-left">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Venue</span>
            <span className="text-white font-bold text-sm">Super Kick Turf</span>
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Date</span>
            <span className="text-white font-bold text-sm">{dates[selectedDateIndex].fullDate}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Time</span>
            <span className="text-white font-bold text-sm">{selectedSlot?.time}</span>
          </div>
        </div>

        <button 
          onClick={onBack}
          className="w-full bg-primary text-background-dark font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-glow active:scale-95 transition-all"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background-dark overflow-hidden">
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="relative w-full h-[320px] shrink-0">
          <div className="absolute top-0 left-0 w-full z-20 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between">
            <button onClick={onBack} className="flex items-center justify-center size-10 rounded-full bg-black/20 backdrop-blur-sm text-white transition-transform active:scale-90">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex gap-3">
              <button className="flex items-center justify-center size-10 rounded-full bg-black/20 backdrop-blur-sm text-white transition-transform active:scale-90">
                <span className="material-symbols-outlined">share</span>
              </button>
              <button className="flex items-center justify-center size-10 rounded-full bg-black/20 backdrop-blur-sm text-white transition-transform active:scale-90">
                <span className="material-symbols-outlined">favorite</span>
              </button>
            </div>
          </div>
          <div className="w-full h-full relative">
            <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBpcXgLNE4FR6g931PXXxOZHGryUCy63m4L0DlmGrXXll6X88njfCmAKlek9AmavlqPEDk1oTKyspOVsOUU4ideXmnG0uYUn1RIxVelyFrUZhQE7GgzJcjXkKtUSIjE8p-CeiTtlniUkb0M-2TeuMHXBE0jgHff33kPOG1fLK0f3bVD8Y-AgpJ9GNPNl_MzxaAe7jfbxTolyfw1j7ZJsSlrDC7AIF9zN43nqokBwPaMYGY6hvPdg6Njdl2CKIP3qTcYQuY9lwPpa-H3" alt="Venue" />
            <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-transparent to-transparent"></div>
          </div>
        </div>

        <div className="relative -mt-6 rounded-t-3xl bg-background-dark px-0 pt-6">
          <div className="px-5 mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-white text-2xl font-bold font-display tracking-tight">Super Kick Turf - Chennai</h1>
                <p className="text-secondary-text text-sm mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[18px]">location_on</span>
                  T. Nagar, Chennai • 2.5 km away
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1 bg-surface-dark border border-white/5 px-2 py-1 rounded-lg">
                  <span className="text-white font-bold text-sm">4.8</span>
                  <span className="material-symbols-outlined text-primary text-[16px] fill-1">star</span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-6 space-y-10">
            <section>
              <h3 className="text-white text-lg font-bold mb-3 font-display">About Venue</h3>
              <p className="text-gray-300 text-sm leading-relaxed">Experience world-class sports facilities at Super Kick Turf. Perfect for corporate events, friendly matches, and regular training.</p>
            </section>

            <section className="animate-in slide-in-from-right duration-500">
              <h3 className="text-white text-lg font-black font-display tracking-tight mb-5">Select Date & Time</h3>
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 mb-8">
                {dates.map((d, i) => (
                  <button key={i} onClick={() => setSelectedDateIndex(i)} className={`flex flex-col items-center justify-center min-w-[70px] h-[90px] rounded-2xl border transition-all ${selectedDateIndex === i ? 'bg-primary border-primary shadow-glow' : 'bg-surface-dark border-white/5'}`}>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${selectedDateIndex === i ? 'text-background-dark' : 'text-gray-500'}`}>{d.dayName}</span>
                    <span className={`text-2xl font-black mt-1 ${selectedDateIndex === i ? 'text-background-dark' : 'text-white'}`}>{d.dateNum}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-5 mb-6 px-1">
                <div className="flex items-center gap-2"><div className="size-2 rounded-full bg-primary/40"></div><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Available</span></div>
                <div className="flex items-center gap-2"><div className="size-2 rounded-full bg-primary shadow-glow"></div><span className="text-[9px] font-black text-primary uppercase tracking-widest">Selected</span></div>
                <div className="flex items-center gap-2"><div className="size-2 rounded-full bg-gray-700"></div><span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Booked</span></div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {timeSlots.map((slot) => {
                  const isSelected = selectedSlotId === slot.id;
                  const isAvailable = slot.available;
                  return (
                    <button key={slot.id} disabled={!isAvailable} onClick={() => setSelectedSlotId(slot.id)} className={`relative h-14 flex items-center justify-center rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all ${!isAvailable ? 'bg-black/40 border-white/5 text-gray-700 cursor-not-allowed' : isSelected ? 'bg-primary border-primary text-background-dark shadow-glow scale-[1.02]' : 'bg-primary/5 border-primary/20 text-primary/80'}`}>
                      {slot.time}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="animate-in fade-in duration-700">
              <h3 className="text-white text-lg font-black font-display tracking-tight mb-5">Premium Amenities</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: 'directions_car', label: 'Valet Parking', color: 'text-blue-400', bg: 'bg-blue-400/10' },
                  { icon: 'water_drop', label: 'Mineral Water', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
                  { icon: 'checkroom', label: 'Pro Changing', color: 'text-purple-400', bg: 'bg-purple-400/10' },
                  { icon: 'wb_incandescent', label: 'Night Lights', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
                  { icon: 'wifi', label: 'High-Speed Wi-Fi', color: 'text-green-400', bg: 'bg-green-400/10' },
                  { icon: 'first_aid_kit', label: 'Medical Kit', color: 'text-red-400', bg: 'bg-red-400/10' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-4 bg-surface-dark border border-white/5 p-4 rounded-2xl group transition-all hover:bg-white/5 hover:border-white/10">
                    <div className={`size-12 shrink-0 rounded-2xl ${item.bg} flex items-center justify-center ${item.color} shadow-inner transition-transform group-hover:scale-110`}>
                      <span className="material-symbols-outlined text-2xl font-black">{item.icon}</span>
                    </div>
                    <span className="text-xs text-white font-black uppercase tracking-widest">{item.label}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="pb-10">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-white text-lg font-bold mb-3 font-display">Location</h3>
                <a className="text-primary text-sm font-bold" href="#">Get Directions</a>
              </div>
              <div className="w-full h-44 rounded-2xl overflow-hidden relative shadow-inner">
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAbT6HyWI5vs_23opT0GVTpaTlB7-ohOUgzA7YREP47jQgwLGv9Lxtv4HpkBhGZ-YJk6py7MUR829v0x8hopE7EzQr_HoByPjmcgktktdtiJksjXLygLZ_cchpYM40GAeuvWqtdWINBwW7GZrZwjh0Kwopy4rCc4twrKbsBKJCzTo-E4aqW_teAmDUCz48QAK1b_fyb3l9RZzCc668juQwHNCsJF9I0PVTfULXl2h5ZUh7GbftDvlPiUwzDdVgLzRHlvweZoDYxnOaw" className="w-full h-full object-cover grayscale opacity-60" alt="Map" />
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="bg-background-dark/95 backdrop-blur-2xl border-t border-white/5 p-5 pb-10 z-50">
        <div className="flex items-center justify-between gap-6 max-w-[480px] mx-auto">
          <div className="flex flex-col">
            <span className="text-[10px] text-secondary-text font-bold uppercase tracking-widest">Total Price</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white">₹800</span>
              <span className="text-sm text-secondary-text">/hour</span>
            </div>
          </div>
          <button 
            disabled={!selectedSlotId || isBooking} 
            onClick={() => setShowConfirmDialog(true)} 
            className={`flex-1 h-15 rounded-2xl flex items-center justify-center gap-2 text-background-dark font-black text-lg transition-all active:scale-95 shadow-glow ${!selectedSlotId || isBooking ? 'bg-gray-600 opacity-50 shadow-none' : 'bg-primary'}`}
          >
            {isBooking ? <div className="size-6 border-4 border-background-dark border-t-transparent rounded-full animate-spin"></div> : 'Book Slot'}
          </button>
        </div>
      </div>

      {showConfirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          <div className="w-full max-sm bg-surface-dark rounded-3xl border border-white/10 shadow-glow overflow-hidden">
            <div className="p-6 text-center">
              <h3 className="text-white text-xl font-black font-display mb-6">Final Confirmation</h3>
              <div className="bg-black/20 rounded-2xl p-4 mb-6 text-left space-y-2 border border-white/5">
                <div className="flex justify-between"><span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Date</span><span className="text-white text-xs font-bold">{dates[selectedDateIndex].fullDate}</span></div>
                <div className="flex justify-between"><span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Time</span><span className="text-white text-xs font-bold">{selectedSlot?.time}</span></div>
              </div>
              <div className="flex flex-col gap-4">
                <label className="flex items-center gap-3 cursor-pointer group px-1">
                  <div onClick={() => setAgreedToTerms(!agreedToTerms)} className={`size-6 rounded-lg border flex items-center justify-center transition-all ${agreedToTerms ? 'bg-primary border-primary' : 'bg-white/5 border-white/10'}`}>{agreedToTerms && <span className="material-symbols-outlined text-background-dark text-sm font-black">check</span>}</div>
                  <span className="text-[11px] text-gray-400 text-left font-medium leading-snug">I agree to the Cancellation Policy & Terms.</span>
                </label>
                <div className="flex gap-4 mt-2">
                  <button onClick={() => setShowConfirmDialog(false)} className="flex-1 py-4 rounded-2xl border border-white/5 text-white font-black text-xs uppercase tracking-widest transition-colors active:bg-white/5">Back</button>
                  <button 
                    onMouseDown={() => agreedToTerms && setIsHolding(true)} 
                    onMouseUp={() => setIsHolding(false)} 
                    onMouseLeave={() => setIsHolding(false)}
                    className={`relative flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest overflow-hidden transition-all ${!agreedToTerms ? 'bg-gray-600 text-gray-400' : 'bg-white/5 text-primary border border-primary/20 shadow-glow'}`}
                  >
                    <div className="absolute left-0 top-0 h-full bg-primary/20 transition-all duration-75" style={{ width: `${holdProgress}%` }}></div>
                    <span className="relative z-10">{holdProgress > 0 ? `Holding...` : 'Hold to Confirm'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VenueDetail;
