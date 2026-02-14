
import React from 'react';

interface SportSelectProps {
  onBack: () => void;
  onSportClick: () => void;
}

const SportSelect: React.FC<SportSelectProps> = ({ onBack, onSportClick }) => {
  const sports = [
    { name: 'Box Cricket', count: '5 Venues', desc: 'Nets & Open Grounds', active: true, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAffH6TVxW8ET3Q3ejPCefuxdWw0r5D7QCf6lZ5-r4ApaOeeuo8LEoIYmCNT9v8w-ZyGkXWnmnNg72FQt_gCEvbntxCPeLSiJY11k_3zaS4f-8MZ-E321TkBvRYlIHxmJqegZs_X_pZr47OvGcY9qgKHKIws17cTlrTP5Wt-fJw1BcWfnnZA9J_asCvlMddmuJquFjccOPCf6n1ZDAWzOCoetlMhyegeclogcECyHHyvkVek7tGj1dMAZYBznWB1ae9p3pDyI4N39Il' },
    { name: 'Football', count: '3 Venues', desc: '5v5 & 7v7 Turfs', active: false, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbQjFQx7XNtJUEBmPilgh6v8CoguAF5sr1bl3apM3gBbED-gAzdm4YMzmuWjCVL1zPjHRSoc37jRkvoQ41rTu71id06a2KeZ0YPudYFF0pYVPhorODIZK2A39aTV3hWIpCB0SWjZGs1QHTC6yTbdW_13z8NqWkJPqwv1GONOZ52_mwUbVAnxz3TYQQkfeTX7FArh_ttGclT4WElMWoqw2EbbCumSk7l1jz61lns1NhRz-nChP9j1xOWHX5nuIrz1PdT42J8JBukHjE' },
    { name: 'Badminton', count: '8 Venues', desc: 'Wooden & Synthetic', active: true, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD_fXAUb7jqoZJZ0giK09ssFG1GS1Li8u_hfG188eueGtALA6oZg7l4AXV6AYgttz2FNMoFLT2xOI6FgqnnfkaiWM5te3YLAyzhnTdKSIqut5QUFDseyEA1wj8EcfM8pQrcrk-NtxcPLU9smbJdVpPAX89YZRzyCHW5F-Klu-dBYb9nxz58t4gfwP4TLKsCQl4zv-PYrz4m5k7HYuBBCeWRkiBGkeYDFGMQJgI5tE78kRoRlkDdxFV4tB9uTMikLT1knB5Ihyl8WpoB' },
    { name: 'Tennis', count: '2 Venues', desc: 'Clay & Hard Courts', active: false, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDMcP3RBH2forFcH6poM98wCPD0x4sG3KJg_YRrYu5nAvmM8R-aLO5FhDv4T05O-Nrp4qA8CYehaa3VpYgrRi_8lhlKUqAi76Cw-aCC7U7V0BK6P-Lu67tHoA9ZpkGOiX-14-S515n7uCyNxI2lY055WNcIfSFG-JQo8CFTTaxag0O_HVaL6P67KGgyhHoUPI8z0Uk7kohkyz0bLe12q__4MsUhLyzk1lXZ36i5jdGF5Vf6OX7GhycU_iYMPFnRys18Kyw9nzzWHeAc' },
    { name: 'Swimming', count: '4 Venues', desc: 'Olympic & Heated', active: false, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuByVzf9I-rgarItSjRBEQeTt7_XOlo3xt5mG762qFHQLC-JH61p0hNP43bGJ-ZUIauHWKRuP1aV86P9bia0g8qjjUnB-phP4p1iO9zF9eqs7UU_LsGQXrdvuXZPh2eYs50bJa3yzEWjMmi8RKYhMAnuNOZTUcUnOPzb056786yFeoZfmYa47kQnzJAtBK59Hc40eflDarEFirvNij6-ehxE4AsD0E7Ehk0t4h2d3qCfFHKDd_9YaLi4hEAQaIUROrX_yUT7jnN1nmt8' },
    { name: 'Basketball', count: '1 Venue', desc: 'Indoor Courts', active: false, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD2VwZKAnx7G4rVQr9NoSOt0MnMqbR0OhMdHSav3Uraim1E8JNLCNkdNYjUgmopqwZrwfECcw-MsnwweOzzfsJ5rgi86OelWL1EsHmUi66Zc8bX-U9Yn2UjO3FO422k5bYKLEEpzvZwJapHdcCRakxOoq6K3CNb3Mini8_2gGqRY4ORYJ4dQM5qfDoxuN4Fk76zSC9fclmOqTXutZlGOC4llz-pQ9FqnwNZtEJDsxgZ1vhkxrNEkTIoj1ettsDhEi6NUg15c8_rUDSe' }
  ];

  return (
    <div className="flex flex-col h-full bg-background-dark overflow-y-auto no-scrollbar pb-32">
      <header className="sticky top-0 z-30 bg-background-dark/95 backdrop-blur-md px-4 pt-6 pb-2">
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={onBack}
            className="flex items-center justify-center size-10 rounded-full bg-surface-dark text-white border border-white/5 active:scale-90 transition-transform"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-2">
             <span className="material-symbols-outlined text-primary font-black">sports_tennis</span>
             <h1 className="text-white text-lg font-black font-display tracking-tight">Play Time</h1>
          </div>
          <button onClick={onBack} className="text-secondary-text font-bold text-sm uppercase tracking-widest">Skip</button>
        </div>
        
        <div className="space-y-1 mb-6">
          <h1 className="text-white text-3xl font-black font-display leading-tight tracking-tight">Let's Play, Arjun! 🏏</h1>
          <p className="text-secondary-text text-base font-medium">What are you playing today?</p>
        </div>

        <div className="flex w-full items-center rounded-2xl h-12 bg-surface-dark border border-white/5 shadow-inner px-4 mb-2">
          <span className="material-symbols-outlined text-secondary-text mr-3">search</span>
          <input className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder:text-gray-600 text-sm" placeholder="Search sports or venues..." />
          <div className="h-6 w-px bg-white/5 mx-3"></div>
          <span className="material-symbols-outlined text-secondary-text">tune</span>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 px-4 pt-4">
        {sports.map((sport) => (
          <div 
            key={sport.name}
            onClick={onSportClick}
            className="group relative flex flex-col justify-end aspect-[4/5] rounded-3xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all shadow-2xl border border-white/5"
          >
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" 
              style={{ backgroundImage: `url("${sport.img}")` }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/50 to-transparent opacity-90"></div>
            
            <div className="relative p-5 z-10 flex flex-col h-full justify-between">
              <div className="self-start">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-xl backdrop-blur-md border text-[10px] font-black uppercase tracking-widest shadow-2xl ${
                  sport.active ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-surface-dark/60 border-white/10 text-white/90'
                }`}>
                  {sport.active && <span className="size-1.5 rounded-full bg-primary mr-1.5 animate-pulse"></span>}
                  {sport.count}
                </span>
              </div>
              <div>
                <h3 className="text-white text-xl font-black font-display leading-tight mb-1">{sport.name}</h3>
                <p className="text-secondary-text text-[10px] font-bold uppercase tracking-wider">{sport.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-28 right-5 z-40">
        <button className="flex items-center gap-2 bg-primary text-background-dark font-black pl-5 pr-6 py-4 rounded-full shadow-glow active:scale-95 transition-all border border-black/10">
          <span className="material-symbols-outlined fill-1 font-black">bolt</span>
          <span className="uppercase tracking-widest text-xs">Quick Book</span>
        </button>
      </div>
    </div>
  );
};

export default SportSelect;
