
import React, { useState, useEffect } from 'react';
import { Team, TeamMember } from '../types';

const TeamUp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'matches' | 'teams'>('matches');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamSport, setNewTeamSport] = useState('Football');
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    const savedTeams = localStorage.getItem('playtime_teams');
    if (savedTeams) {
      setTeams(JSON.parse(savedTeams));
    } else {
      const initialTeams: Team[] = [
        {
          id: 't-1',
          name: 'Green Harriers',
          sport: 'Football',
          logo: '⚽',
          matchesWon: 12,
          members: [
            { id: 'm-1', name: 'Arjun K.', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCiKBX1n5QmFNWe88dAbOaF52LVf3XkM-8iG_7CC22pn3TQ__kIZ416-aqz2WccqXI4HuR0UHT0N1de7EZx0r1dK6LSMq3GoPiYxDK5S_k7wMXJ0XTBHOv2UTcWm0kD1xoNrqQHR7yBltNNGEFhnsUk4zRvKx9JnPvW2TqA7BX1FV6SUa74FY4rglkTH4jnYbZOtYF6Io5wmTsmOLeugxVXJYDJhuwJ_x197dCHsEx4qDR8uAj167tbvBqXN2RwdsmCjPnPlDzXEPG0', role: 'Captain', status: 'Joined' },
            { id: 'm-2', name: 'Ravi S.', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBeFLoUqYO7HBP3ScYzPU8REnHa8jkCIGg8o4KKcLqrKex_0cdshMm592OtIuDO5JsvbxeGH82LcezFbAg6HtAgp0OTyJPJI043Bk6FcrzyE-xIH61W6_tcMg2gy8X7VGqEhJUfYJMOqkGnLGbVrnScJjc3RLlc8Wjtx3B2iFUKu4NFEjMNio8T9UzHXcG6SZrHzsSQHplRCbA3iZ51EjyP8ltZTIdlpOh4XXJM6XhNi5DD7_SSS1rHpnwNbLHdeEXtHW2ieqHd13HM', role: 'Forward', status: 'Joined' }
          ]
        }
      ];
      setTeams(initialTeams);
      localStorage.setItem('playtime_teams', JSON.stringify(initialTeams));
    }
  }, []);

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) return;
    const newTeam: Team = {
      id: `team-${Date.now()}`,
      name: newTeamName,
      sport: newTeamSport,
      logo: newTeamSport === 'Football' ? '⚽' : newTeamSport === 'Cricket' ? '🏏' : '🏸',
      matchesWon: 0,
      members: [{ 
        id: 'me', 
        name: 'Arjun K.', 
        avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCiKBX1n5QmFNWe88dAbOaF52LVf3XkM-8iG_7CC22pn3TQ__kIZ416-aqz2WccqXI4HuR0UHT0N1de7EZx0r1dK6LSMq3GoPiYxDK5S_k7wMXJ0XTBHOv2UTcWm0kD1xoNrqQHR7yBltNNGEFhnsUk4zRvKx9JnPvW2TqA7BX1FV6SUa74FY4rglkTH4jnYbZOtYF6Io5wmTsmOLeugxVXJYDJhuwJ_x197dCHsEx4qDR8uAj167tbvBqXN2RwdsmCjPnPlDzXEPG0', 
        role: 'Captain', 
        status: 'Joined' 
      }]
    };
    const updated = [...teams, newTeam];
    setTeams(updated);
    localStorage.setItem('playtime_teams', JSON.stringify(updated));
    setNewTeamName('');
    setIsCreatingTeam(false);
  };

  const updateMemberRole = (teamId: string, memberId: string, newRole: string) => {
    const updated = teams.map(t => {
      if (t.id === teamId) {
        return {
          ...t,
          members: t.members.map(m => m.id === memberId ? { ...m, role: newRole } : m)
        };
      }
      return t;
    });
    setTeams(updated);
    localStorage.setItem('playtime_teams', JSON.stringify(updated));
    if (selectedTeam && selectedTeam.id === teamId) {
      const updatedSelected = updated.find(u => u.id === teamId);
      if (updatedSelected) setSelectedTeam(updatedSelected);
    }
  };

  const invitePlayer = () => {
    alert("Invitation link copied to clipboard! Send it to your teammates.");
  };

  return (
    <div className="flex flex-col h-full bg-background-dark overflow-y-auto no-scrollbar pb-32">
      <header className="sticky top-0 z-30 flex flex-col bg-background-dark/95 backdrop-blur-md p-4 pb-0 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <h2 className="text-white text-2xl font-black font-display leading-tight tracking-tight">Social hub</h2>
            <span className="text-secondary-text text-[11px] font-bold uppercase tracking-wider">Play with your crew</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center justify-center rounded-full size-10 bg-surface-dark border border-white/5 transition-transform active:scale-90">
              <span className="material-symbols-outlined text-white text-xl">search</span>
            </button>
            <button className="flex items-center justify-center rounded-full size-10 bg-surface-dark border border-white/5 transition-transform active:scale-90">
              <span className="material-symbols-outlined text-white text-xl">settings</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex w-full mb-1">
          <button 
            onClick={() => setActiveTab('matches')}
            className={`flex-1 py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'matches' ? 'text-primary' : 'text-gray-500'}`}
          >
            Join Match
            {activeTab === 'matches' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full shadow-glow"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('teams')}
            className={`flex-1 py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'teams' ? 'text-primary' : 'text-gray-500'}`}
          >
            My Teams
            {activeTab === 'teams' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full shadow-glow"></div>}
          </button>
        </div>
      </header>

      {activeTab === 'matches' ? (
        <div className="animate-in fade-in duration-500">
          <div className="px-4 py-5 sticky top-[108px] z-20 bg-background-dark/95 backdrop-blur-md">
            <div className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-surface-dark p-1 border border-white/5">
              <button className="flex-1 h-full rounded-xl text-xs font-black uppercase text-gray-400">Singles</button>
              <button className="flex-1 h-full rounded-xl text-xs font-black uppercase bg-primary text-background-dark shadow-sm">Doubles</button>
            </div>
          </div>

          <div className="flex flex-col gap-6 px-4 pt-2">
            {/* Match Card Example */}
            <div className="flex flex-col rounded-3xl bg-surface-dark border border-white/5 overflow-hidden shadow-2xl">
              <div className="p-4 bg-gradient-to-br from-surface-card to-surface-dark border-b border-white/5 flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white text-base font-black font-display">Smash Arena, Chennai</h3>
                    <span className="bg-blue-500/20 text-blue-400 text-[9px] font-black px-2 py-0.5 rounded-md border border-blue-500/30 uppercase">Mixed</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 text-xs font-medium">
                    <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                    <span>Today, 6:00 PM</span>
                  </div>
                </div>
                <div className="bg-primary/10 text-primary p-2 rounded-xl border border-primary/20">
                  <span className="material-symbols-outlined text-[24px]">sports_tennis</span>
                </div>
              </div>

              <div className="p-6 flex flex-col gap-6">
                <div className="flex justify-between items-center relative">
                  <div className="flex flex-col items-center gap-3 w-[40%]">
                    <div className="relative group">
                      <img className="size-16 rounded-full border-2 border-primary object-cover shadow-glow transition-transform group-hover:scale-105" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBeFLoUqYO7HBP3ScYzPU8REnHa8jkCIGg8o4KKcLqrKex_0cdshMm592OtIuDO5JsvbxeGH82LcezFbAg6HtAgp0OTyJPJI043Bk6FcrzyE-xIH61W6_tcMg2gy8X7VGqEhJUfYJMOqkGnLGbVrnScJjc3RLlc8Wjtx3B2iFUKu4NFEjMNio8T9UzHXcG6SZrHzsSQHplRCbA3iZ51EjyP8ltZTIdlpOh4XXJM6XhNi5DD7_SSS1rHpnwNbLHdeEXtHW2ieqHd13HM" alt="" />
                      <div className="absolute -bottom-1 -right-1 bg-blue-600 text-[9px] text-white size-5 flex items-center justify-center rounded-full border-2 border-surface-dark font-black">M</div>
                    </div>
                    <div className="text-center">
                      <p className="text-white text-xs font-black truncate">Ravi K.</p>
                      <p className="text-primary text-[9px] font-black uppercase tracking-widest">Pro</p>
                    </div>
                  </div>

                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <div className="bg-background-dark/80 backdrop-blur-md text-gray-400 text-[10px] font-black px-4 py-1.5 rounded-full border border-white/10 shadow-xl">VS</div>
                  </div>

                  <div className="flex flex-col items-center gap-3 w-[40%]">
                    <div className="relative group">
                      <img className="size-16 rounded-full border-2 border-secondary-text object-cover grayscale opacity-80" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA5uu9Mun86XCEAfKDPiGeloIUTlheTpJSBzL0rclj0_9sFYOwgM2TNS2MpskfxGSCAm0JfpkytTuEK9TbUHAqwqWjJblS9_rY8aGe2E-E5Of0WuV-wU7oZxld6aKXB-v4ghaEESTaxR-fASmHUipjtQA4TNXJEqAj-SGVwy7jYkv8SF1htV6f03yz3_WdvObT7PEst_RtwxoFr7XusbeOjQp0oH452XgfPXCjJJMGm9juDqX-kRNLwrHd-vNVmwB6XaSvSY65YW8Zm" alt="" />
                      <div className="absolute -bottom-1 -right-1 bg-pink-500 text-[9px] text-white size-5 flex items-center justify-center rounded-full border-2 border-surface-dark font-black">F</div>
                    </div>
                    <div className="text-center">
                      <p className="text-white text-xs font-black truncate">Anita R.</p>
                      <p className="text-yellow-500 text-[9px] font-black uppercase tracking-widest">Inter</p>
                    </div>
                  </div>
                </div>

                <div className="h-px w-full bg-white/5"></div>

                <div className="flex justify-between items-center">
                   <div className="flex flex-col items-center gap-3 w-[40%] opacity-50">
                    <div className="size-16 rounded-full border-2 border-dashed border-white/20 bg-white/5 flex items-center justify-center">
                      <span className="material-symbols-outlined text-gray-600">person_add</span>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Empty Slot</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-4 w-[40%]">
                    <button className="w-full bg-primary text-background-dark text-[11px] font-black uppercase py-4 rounded-2xl shadow-glow active:scale-95 transition-all tracking-[0.1em]">Join Team</button>
                    <p className="text-[9px] text-secondary-text font-bold uppercase tracking-widest">1 spot left</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 mb-8">
              <h4 className="text-white font-black font-display text-lg mb-4">Near You</h4>
              <div className="h-40 w-full rounded-[32px] overflow-hidden relative shadow-2xl group cursor-pointer border border-white/5">
                <img className="w-full h-full object-cover grayscale opacity-40 group-hover:scale-105 transition-transform duration-1000" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCnP1yseuwjdOUtakehlGsirvb_FITfqwxDqpBTNR2G-6ITmlRv-m0JGw6ep6uYE6xalsXfbPcyEhuXE20KVNepa6-kCeC6EIE5Z70ykleTthu0cqbX5SYgSnW-VRR9bG-vu5WTbonAhrPVED5_l3lapSTn9TuJseFURAkoJWushIwxUVSnFmbVosoaOTzdcRDJaauu_T9oYZcm5IqiAZsk2EdePQ_onF7MH0lhZHzwpYG9-Mh8tNLTaoudZFkBd6qDl5P31rH7x81j" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-transparent to-transparent"></div>
                <div className="absolute bottom-5 left-6">
                  <p className="text-white text-lg font-black leading-tight">12 Active Courts</p>
                  <p className="text-secondary-text text-[10px] font-bold uppercase tracking-[0.2em] mt-1">in 5km radius</p>
                </div>
                <button className="absolute right-6 bottom-5 bg-white text-background-dark text-[10px] font-black uppercase px-5 py-2.5 rounded-xl shadow-lg transition-transform active:scale-95">Open Map</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* MY TEAMS SECTION */
        <div className="p-4 space-y-6 animate-in slide-in-from-right duration-500">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">Active Squads ({teams.length})</h3>
            <button className="text-primary text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5">
               Recent First <span className="material-symbols-outlined text-[16px]">expand_more</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {teams.map((team) => (
              <div 
                key={team.id}
                onClick={() => setSelectedTeam(team)}
                className="group relative flex items-center gap-5 p-5 rounded-[32px] bg-surface-dark border border-white/5 shadow-2xl transition-all active:scale-[0.98] cursor-pointer hover:border-primary/20"
              >
                <div className="size-16 rounded-[22px] bg-white/5 border border-white/10 flex items-center justify-center text-3xl shadow-inner group-hover:scale-105 transition-transform">
                  {team.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white text-lg font-black font-display tracking-tight leading-tight truncate">{team.name}</h4>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-primary text-[9px] font-black uppercase tracking-widest">{team.sport}</span>
                    <div className="size-1 rounded-full bg-gray-700"></div>
                    <span className="text-gray-500 text-[9px] font-bold uppercase tracking-widest">{team.members.length} Members</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                   <div className="flex items-center gap-1.5 text-yellow-500">
                      <span className="material-symbols-outlined text-[18px] fill-1">emoji_events</span>
                      <span className="text-sm font-black tracking-tight">{team.matchesWon}</span>
                   </div>
                   <span className="text-[8px] font-black text-gray-600 uppercase tracking-[0.2em]">Wins</span>
                </div>
              </div>
            ))}
          </div>

          {teams.length === 0 && (
             <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                <span className="material-symbols-outlined text-6xl mb-4">groups_3</span>
                <p className="text-white text-sm font-bold">No teams yet</p>
                <p className="text-gray-500 text-[10px] uppercase tracking-widest mt-1">Start by creating your own squad</p>
             </div>
          )}
        </div>
      )}

      {/* FAB: Trigger Create Team Flow */}
      <div className="fixed bottom-28 right-5 z-40">
        <button 
          onClick={() => setIsCreatingTeam(true)}
          className="flex items-center justify-center size-14 rounded-2xl bg-primary text-background-dark shadow-[0_10px_30px_rgba(13,242,89,0.4)] transition-all active:scale-[0.85] hover:scale-110"
        >
          <span className="material-symbols-outlined text-4xl font-bold">add</span>
        </button>
      </div>

      {/* MODAL: Create Team */}
      {isCreatingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in zoom-in-95 duration-300">
          <div className="w-full max-w-[400px] bg-surface-dark border border-white/10 rounded-[40px] shadow-glow p-8">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-white text-2xl font-black font-display tracking-tight leading-tight">Create New Squad</h3>
              <button onClick={() => setIsCreatingTeam(false)} className="text-gray-500"><span className="material-symbols-outlined">close</span></button>
            </div>
            
            <div className="space-y-8">
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Team Identity</label>
                <input 
                  type="text" 
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Marina Mavericks"
                  className="w-full h-14 bg-background-dark border border-white/5 rounded-2xl text-white px-5 focus:ring-primary focus:border-primary transition-all text-sm font-bold"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Select Sport</label>
                <div className="grid grid-cols-3 gap-3">
                  {['Football', 'Cricket', 'Badminton'].map(sport => (
                    <button 
                      key={sport}
                      onClick={() => setNewTeamSport(sport)}
                      className={`h-12 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${newTeamSport === sport ? 'bg-primary/10 border-primary text-primary shadow-glow' : 'bg-background-dark border-white/5 text-gray-500'}`}
                    >
                      {sport}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                 <button 
                  onClick={() => setIsCreatingTeam(false)} 
                  className="flex-1 h-14 rounded-2xl border border-white/5 text-gray-500 font-black text-[11px] uppercase tracking-widest active:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateTeam}
                  className={`flex-1 h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-glow transition-all active:scale-95 ${!newTeamName.trim() ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-primary text-background-dark'}`}
                >
                  Create Team
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Team Management / Detail */}
      {selectedTeam && (
        <div className="fixed inset-0 z-[60] bg-background-dark animate-in slide-in-from-bottom duration-500">
           <header className="sticky top-0 z-30 flex items-center bg-background-dark/95 backdrop-blur-md p-4 pb-3 justify-between border-b border-white/5">
            <button onClick={() => setSelectedTeam(null)} className="flex size-10 items-center justify-center rounded-full bg-surface-dark border border-white/5 transition-transform active:scale-90">
              <span className="material-symbols-outlined text-white">arrow_back</span>
            </button>
            <h2 className="text-white text-lg font-black font-display tracking-tight flex-1 text-center pr-10">Manage Squad</h2>
            <button className="absolute right-4"><span className="material-symbols-outlined text-primary">edit</span></button>
          </header>

          <div className="p-6">
            <div className="flex flex-col items-center mb-10">
               <div className="size-24 rounded-[32px] bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-5xl shadow-glow mb-5">
                  {selectedTeam.logo}
               </div>
               <h1 className="text-3xl font-black font-display text-white tracking-tight">{selectedTeam.name}</h1>
               <p className="text-secondary-text text-xs font-bold uppercase tracking-[0.2em] mt-2">{selectedTeam.sport} SQUAD</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-10">
               <div className="bg-surface-dark p-4 rounded-3xl border border-white/5 flex flex-col items-center text-center">
                  <span className="text-2xl font-black text-white">{selectedTeam.matchesWon}</span>
                  <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Wins</span>
               </div>
               <div className="bg-surface-dark p-4 rounded-3xl border border-white/5 flex flex-col items-center text-center">
                  <span className="text-2xl font-black text-white">{selectedTeam.members.length}/15</span>
                  <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">SQUAD SIZE</span>
               </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-gray-500 uppercase tracking-[0.2em]">Member List</h3>
                <button 
                  onClick={invitePlayer}
                  className="px-4 py-2 bg-primary/10 border border-primary/30 rounded-xl text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                  Invite
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {selectedTeam.members.map((member) => (
                  <div key={member.id} className="flex items-center gap-4 p-4 bg-surface-dark border border-white/5 rounded-[28px]">
                    <img className="size-12 rounded-2xl object-cover border border-white/10" src={member.avatar} alt="" />
                    <div className="flex-1">
                      <p className="text-white text-sm font-bold">{member.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                         <span className="material-symbols-outlined text-primary text-xs">verified</span>
                         <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">{member.status}</span>
                      </div>
                    </div>
                    
                    {/* Role Picker */}
                    <div className="relative group">
                       <select 
                        value={member.role}
                        onChange={(e) => updateMemberRole(selectedTeam.id, member.id, e.target.value)}
                        className="bg-background-dark border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest px-3 py-2 text-primary focus:ring-primary focus:border-primary appearance-none pr-8 cursor-pointer"
                       >
                         {['Captain', 'Defender', 'Midfield', 'Forward', 'Goalie', 'Tactician'].map(role => (
                           <option key={role} value={role}>{role}</option>
                         ))}
                       </select>
                       <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-[16px] pointer-events-none">expand_more</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-12 space-y-4">
               <button className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 active:bg-white/10 transition-all">
                  <span className="material-symbols-outlined">schedule</span>
                  Team Training Schedule
               </button>
               <button className="w-full h-14 border border-red-500/20 text-red-500 rounded-2xl font-black text-[11px] uppercase tracking-widest active:bg-red-500/5 transition-all">
                  Leave Squad
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamUp;
