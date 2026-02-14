
import React, { useState, useEffect, useRef } from 'react';
import { Booking } from '../types';

interface ProfileProps {
  onVenueClick: () => void;
}

const Profile: React.FC<ProfileProps> = ({ onVenueClick }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profileImage, setProfileImage] = useState<string>("https://lh3.googleusercontent.com/aida-public/AB6AXuCiKBX1n5QmFNWe88dAbOaF52LVf3XkM-8iG_7CC22pn3TQ__kIZ416-aqz2WccqXI4HuR0UHT0N1de7EZx0r1dK6LSMq3GoPiYxDK5S_k7wMXJ0XTBHOv2UTcWm0kD1xoNrqQHR7yBltNNGEFhnsUk4zRvKx9JnPvW2TqA7BX1FV6SUa74FY4rglkTH4jnYbZOtYF6Io5wmTsmOLeugxVXJYDJhuwJ_x197dCHsEx4qDR8uAj167tbvBqXN2RwdsmCjPnPlDzXEPG0");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Load local user settings
    const savedUser = localStorage.getItem('playtime_user');
    if (savedUser) {
        const userData = JSON.parse(savedUser);
        if (userData.photoURL) setProfileImage(userData.photoURL);
    }

    // Load local bookings
    const savedBookings = JSON.parse(localStorage.getItem('playtime_bookings') || '[]');
    setBookings(savedBookings.sort((a: any, b: any) => b.id.localeCompare(a.id)));
  }, []);

  const latestUpcomingBooking = bookings.find(b => b.status === 'Upcoming');

  const handleCancelBooking = (id: string) => {
    if (window.confirm('Are you sure you want to cancel this booking?')) {
        const updatedBookings = bookings.map(b => b.id === id ? { ...b, status: 'Cancelled' as const } : b);
        setBookings(updatedBookings);
        localStorage.setItem('playtime_bookings', JSON.stringify(updatedBookings));
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera. Please check permissions.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      const size = Math.min(video.videoWidth, video.videoHeight);
      canvas.width = size;
      canvas.height = size;
      if (context) {
        const startX = (video.videoWidth - size) / 2;
        const startY = (video.videoHeight - size) / 2;
        context.drawImage(video, startX, startY, size, size, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
      }
    }
  };

  const saveProfileImage = () => {
    if (capturedImage) {
      setProfileImage(capturedImage);
      // Update local storage user data
      const savedUser = JSON.parse(localStorage.getItem('playtime_user') || '{}');
      localStorage.setItem('playtime_user', JSON.stringify({ ...savedUser, photoURL: capturedImage }));
      stopCamera();
    }
  };

  const getStatusConfig = (status: Booking['status']) => {
    switch (status) {
      case 'Upcoming':
        return { icon: 'schedule', classes: 'bg-primary/10 border-primary/30 text-primary animate-pulse' };
      case 'Completed':
        return { icon: 'check_circle', classes: 'bg-green-500/5 border-green-500/20 text-green-400 opacity-80' };
      case 'Cancelled':
        return { icon: 'cancel', classes: 'bg-red-500/10 border-red-500/20 text-red-400' };
      default:
        return { icon: 'help', classes: 'bg-gray-500/10 border-gray-500/20 text-gray-400' };
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('playtime_user');
    window.location.reload();
  };

  return (
    <div className="flex flex-col h-full bg-background-dark overflow-y-auto no-scrollbar pb-32 relative">
      <header className="sticky top-0 z-40 flex items-center p-4 bg-background-dark/95 backdrop-blur-md justify-between border-b border-white/5">
        <button className="flex size-10 items-center justify-center rounded-full bg-surface-dark border border-white/5 transition-transform active:scale-90">
          <span className="material-symbols-outlined text-white">arrow_back</span>
        </button>
        <h2 className="text-white text-lg font-black font-display tracking-tight flex-1 text-center pr-10">Profile & Settings</h2>
        <button className="absolute right-4 text-primary font-black uppercase text-sm tracking-widest">Edit</button>
      </header>

      <div className="flex flex-col items-center pt-8 pb-8 px-4">
        <div className="relative group">
          <div className="relative size-36 rounded-full p-1 bg-gradient-to-tr from-primary to-blue-500 shadow-2xl overflow-hidden">
            <div 
              className="size-full rounded-full bg-cover bg-center border-4 border-background-dark transition-transform group-hover:scale-105 duration-500" 
              style={{ backgroundImage: `url("${profileImage}")` }}
            ></div>
          </div>
          <button 
            onClick={startCamera}
            className="absolute bottom-2 right-2 bg-primary text-background-dark p-2 rounded-full border-4 border-background-dark flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110 active:scale-95 z-10"
          >
            <span className="material-symbols-outlined text-sm font-black">photo_camera</span>
          </button>
        </div>
        
        <div className="flex flex-col items-center mt-5 gap-1.5">
          <h1 className="text-2xl font-black tracking-tight text-white font-display">
            Arjun Kumar
          </h1>
          <div className="flex items-center gap-1.5 text-secondary-text">
            <span className="material-symbols-outlined text-[18px]">location_on</span>
            <span className="text-xs font-bold uppercase tracking-wider">Chennai, Tamil Nadu</span>
          </div>
          <div className="mt-3 px-4 py-1.5 bg-primary/10 border border-primary/30 rounded-full shadow-sm">
            <p className="text-primary text-[10px] font-black uppercase tracking-widest">Pro Member</p>
          </div>
        </div>
      </div>

      <div className="px-6 mb-10">
        <div className="flex gap-4">
          <div className="flex flex-1 flex-col items-center justify-center py-5 px-4 rounded-3xl bg-surface-dark border border-white/5 shadow-2xl transition-all active:scale-95">
            <span className="text-3xl font-black text-white tracking-tighter">{bookings.filter(b => b.status === 'Completed').length}</span>
            <span className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Matches</span>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center py-5 px-4 rounded-3xl bg-surface-dark border border-white/5 shadow-2xl transition-all active:scale-95">
            <span className="text-3xl font-black text-white tracking-tighter">₹450</span>
            <span className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Wallet</span>
          </div>
        </div>
      </div>

      <div className="space-y-10 px-6 mb-12">
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Booking History</h3>
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{bookings.length} Total</span>
          </div>
          <div className="flex flex-col gap-4">
            {bookings.length > 0 ? (
              bookings.map((booking) => {
                const statusCfg = getStatusConfig(booking.status);
                return (
                  <div key={booking.id} className="flex flex-col bg-surface-dark rounded-3xl border border-white/5 shadow-xl overflow-hidden transition-all hover:border-white/10">
                    <div className="relative h-24 w-full overflow-hidden">
                      {booking.venueImage && (
                        <img src={booking.venueImage} className="size-full object-cover opacity-40 grayscale" alt="" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-surface-dark to-transparent"></div>
                      <div className="absolute top-4 right-4">
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest backdrop-blur-md ${statusCfg.classes}`}>
                          <span className="material-symbols-outlined text-[14px]">{statusCfg.icon}</span>
                          {booking.status}
                        </div>
                      </div>
                    </div>
                    <div className="p-5 -mt-8 relative z-10">
                      <h4 className="text-white font-bold text-base font-display">{booking.venueName}</h4>
                      <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-0.5">{booking.sport}</p>
                      <div className="flex flex-col gap-2 border-t border-white/5 pt-4 mt-4">
                        <div className="flex items-center gap-2 text-gray-400">
                          <span className="material-symbols-outlined text-[18px]">event</span>
                          <span className="text-xs font-medium">{booking.date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <span className="material-symbols-outlined text-[18px]">schedule</span>
                          <span className="text-xs font-medium">{booking.time}</span>
                        </div>
                      </div>
                      <div className="mt-5 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Paid</span>
                          <span className="text-lg font-black text-white tracking-tight">₹{booking.amount}</span>
                        </div>
                        <div className="flex gap-3">
                          {booking.status === 'Upcoming' && (
                            <button onClick={() => handleCancelBooking(booking.id)} className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95">Cancel</button>
                          )}
                          <button onClick={onVenueClick} className="flex items-center justify-center size-10 rounded-xl bg-white/5 border border-white/5 text-primary hover:bg-primary hover:text-background-dark transition-all active:scale-95">
                            <span className="material-symbols-outlined text-xl">chevron_right</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
                <div className="text-center py-10 opacity-30">No bookings synced yet.</div>
            )}
          </div>
        </section>

        {latestUpcomingBooking && (
          <section className="animate-in slide-in-from-bottom duration-700 delay-200">
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Next Active Match</h3>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary animate-pulse"></span>
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">Upcoming</span>
              </div>
            </div>
            
            <div className="relative overflow-hidden rounded-[32px] bg-surface-dark border border-primary/20 shadow-[0_20px_40px_rgba(0,0,0,0.4),0_0_20px_rgba(13,242,89,0.05)] p-6 group">
              <div className="absolute top-0 right-0 size-32 bg-primary/10 blur-[60px] -mr-16 -mt-16 pointer-events-none"></div>
              
              <div className="flex items-start justify-between relative z-10 mb-6">
                <div className="space-y-1.5">
                  <h4 className="text-white text-2xl font-black font-display tracking-tight leading-tight">
                    {latestUpcomingBooking.venueName}
                  </h4>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-lg bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/30">
                      {latestUpcomingBooking.sport}
                    </span>
                    <span className="text-secondary-text text-[10px] font-bold uppercase tracking-widest">Player Pass Confirmed</span>
                  </div>
                </div>
                <div className="size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md shadow-inner text-primary">
                  <span className="material-symbols-outlined text-3xl">
                    {latestUpcomingBooking.sport === 'Football' ? 'sports_soccer' : 
                     latestUpcomingBooking.sport === 'Cricket' ? 'sports_cricket' : 'sports_tennis'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
                <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1.5">Scheduled Date</p>
                  <p className="text-white font-bold text-sm">{latestUpcomingBooking.date}</p>
                </div>
                <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1.5">Game Time</p>
                  <p className="text-white font-bold text-sm">{latestUpcomingBooking.time}</p>
                </div>
              </div>

              <button 
                onClick={onVenueClick}
                className="w-full h-15 bg-primary text-background-dark font-black rounded-2xl text-sm uppercase tracking-widest shadow-glow flex items-center justify-center gap-3 transition-all active:scale-[0.98] group-hover:bg-green-400 relative z-10"
              >
                <span>View Detail Pass</span>
                <span className="material-symbols-outlined text-xl">qr_code_2</span>
              </button>
            </div>
          </section>
        )}
        
        <button 
            onClick={handleLogout}
            className="w-full py-5 rounded-3xl border border-red-500/20 text-red-500 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 active:bg-red-500/5 transition-all mb-8"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
          Log Out
        </button>
      </div>

      {/* Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
            <h3 className="text-white text-lg font-black font-display tracking-tight">Update Profile Photo</h3>
            <button onClick={stopCamera} className="size-10 flex items-center justify-center rounded-full bg-white/10 text-white active:scale-90 transition-transform">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="relative w-full max-w-[400px] aspect-square bg-surface-dark overflow-hidden rounded-full border-4 border-primary/30 shadow-glow mx-4">
            {!capturedImage ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            ) : (
              <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
            )}
            {!capturedImage && <div className="absolute inset-0 pointer-events-none border-[60px] border-black/40 rounded-full"></div>}
          </div>
          <div className="mt-12 w-full px-8 flex flex-col items-center gap-6">
            {!capturedImage ? (
              <button onClick={capturePhoto} className="size-20 rounded-full border-4 border-white flex items-center justify-center bg-primary shadow-glow transition-transform active:scale-90">
                <span className="size-14 rounded-full border-4 border-background-dark bg-transparent"></span>
              </button>
            ) : (
              <div className="flex gap-4 w-full max-w-[320px]">
                <button onClick={() => setCapturedImage(null)} className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest transition-colors active:bg-white/5">Retake</button>
                <button onClick={saveProfileImage} className="flex-1 py-4 rounded-2xl bg-primary text-background-dark font-black text-xs uppercase tracking-widest shadow-glow transition-all active:scale-95">Save Photo</button>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
    </div>
  );
};

export default Profile;
