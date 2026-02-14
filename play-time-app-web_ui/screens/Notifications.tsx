
import React, { useState } from 'react';

interface NotificationItem {
  id: string;
  type: 'match' | 'offer' | 'invite' | 'system';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  actionLabel?: string;
}

interface NotificationsProps {
  onBack: () => void;
}

const Notifications: React.FC<NotificationsProps> = ({ onBack }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      type: 'match',
      title: 'Match Tomorrow!',
      message: 'Your slot at Super Kick Turf starts at 7:00 PM. Don\'t be late!',
      time: '2h ago',
      isRead: false,
      actionLabel: 'View Ticket'
    },
    {
      id: '2',
      type: 'invite',
      title: 'Team Invitation',
      message: 'Vijay has invited you to join "Marina Mavericks" for Saturday League.',
      time: '5h ago',
      isRead: false,
      actionLabel: 'Accept'
    },
    {
      id: '3',
      type: 'offer',
      title: 'Flash Sale! ⚡',
      message: 'Get 25% off on all badminton court bookings for the next 2 hours.',
      time: 'Yesterday',
      isRead: true
    },
    {
      id: '4',
      type: 'system',
      title: 'Wallet Updated',
      message: '₹200 cashback has been credited to your Play Time wallet.',
      time: 'Yesterday',
      isRead: true
    }
  ]);

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'match': return { name: 'sports_soccer', color: 'text-primary', bg: 'bg-primary/10' };
      case 'offer': return { name: 'local_offer', color: 'text-yellow-400', bg: 'bg-yellow-400/10' };
      case 'invite': return { name: 'group_add', color: 'text-blue-400', bg: 'bg-blue-400/10' };
      default: return { name: 'settings_suggest', color: 'text-gray-400', bg: 'bg-white/5' };
    }
  };

  return (
    <div className="flex flex-col h-full bg-background-dark overflow-y-auto no-scrollbar pb-32">
      <header className="sticky top-0 z-40 bg-background-dark/95 backdrop-blur-md border-b border-white/5 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="flex size-10 items-center justify-center rounded-full bg-surface-dark border border-white/5 text-white active:scale-90 transition-transform"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 className="text-white text-xl font-black font-display tracking-tight">Notifications</h2>
        </div>
        <button 
          onClick={markAllRead}
          className="text-[10px] font-black text-primary uppercase tracking-widest active:scale-95 transition-all"
        >
          Mark all read
        </button>
      </header>

      <div className="p-4 space-y-8 mt-4">
        {/* Today Section */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Today</h3>
          <div className="flex flex-col gap-3">
            {notifications.filter(n => n.time.includes('ago')).map((notif) => {
              const icon = getIcon(notif.type);
              return (
                <div 
                  key={notif.id} 
                  className={`relative p-5 rounded-[28px] border transition-all active:scale-[0.98] ${
                    notif.isRead ? 'bg-surface-dark/50 border-white/5' : 'bg-surface-dark border-primary/20 shadow-glow'
                  }`}
                >
                  {!notif.isRead && (
                    <div className="absolute top-5 right-5 size-2 bg-primary rounded-full"></div>
                  )}
                  <div className="flex gap-4">
                    <div className={`size-12 shrink-0 rounded-2xl ${icon.bg} flex items-center justify-center ${icon.color} border border-white/5`}>
                      <span className="material-symbols-outlined font-black">{icon.name}</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-start">
                        <h4 className="text-white text-sm font-black font-display tracking-tight">{notif.title}</h4>
                        <span className="text-[10px] font-bold text-gray-600">{notif.time}</span>
                      </div>
                      <p className="text-gray-400 text-xs font-medium leading-relaxed">{notif.message}</p>
                      {notif.actionLabel && (
                        <button className="mt-4 px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-background-dark transition-all">
                          {notif.actionLabel}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Earlier Section */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Earlier</h3>
          <div className="flex flex-col gap-3">
            {notifications.filter(n => n.time === 'Yesterday').map((notif) => {
              const icon = getIcon(notif.type);
              return (
                <div 
                  key={notif.id} 
                  className="p-5 rounded-[28px] bg-surface-dark/50 border border-white/5 opacity-80"
                >
                  <div className="flex gap-4">
                    <div className={`size-12 shrink-0 rounded-2xl ${icon.bg} flex items-center justify-center ${icon.color} border border-white/5 grayscale`}>
                      <span className="material-symbols-outlined font-black">{icon.name}</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-start">
                        <h4 className="text-white text-sm font-black font-display tracking-tight">{notif.title}</h4>
                        <span className="text-[10px] font-bold text-gray-600">{notif.time}</span>
                      </div>
                      <p className="text-gray-400 text-xs font-medium leading-relaxed">{notif.message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
            <span className="material-symbols-outlined text-6xl mb-4">notifications_off</span>
            <p className="text-white text-sm font-bold">Nothing here yet</p>
            <p className="text-gray-500 text-[10px] uppercase tracking-widest mt-1">We'll alert you when there's news</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
