import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSports } from '../hooks/useSports';
import SportManagementModal from '../components/modals/SportManagementModal';
import { getSportOptionEntries, formatOptionKey } from '../utils/sportUtils';

const Sports: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const { sports, loading } = useSports({ realtime: true });
  const [showSportModal, setShowSportModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeSports = sports.filter((s) => s.isActive !== false);
  const readOnly = !isSuperAdmin;

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Sports</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            {readOnly
              ? 'Browse the platform sports catalog and available options for your venue.'
              : 'Manage the global sports catalog and assign sports to venues.'}
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowSportModal(true)}
            className="h-12 px-6 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined">add</span>
            Manage Sports
          </button>
        )}
      </div>

      <div className="ui-card overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">Active Sports</h3>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">
            {activeSports.length} sport{activeSports.length !== 1 ? 's' : ''} available
          </p>
        </div>
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : activeSports.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {activeSports.map((sport) => {
              const optionEntries = getSportOptionEntries(sport);
              return (
                <div
                  key={`${sport.id}-${refreshKey}`}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="size-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${sport.color || '#10b981'}20` }}
                    >
                      <span
                        className="material-symbols-outlined text-2xl"
                        style={{ color: sport.color || '#10b981' }}
                      >
                        {sport.icon || 'sports'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{sport.name}</p>
                      {sport.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{sport.description}</p>
                      )}
                    </div>
                  </div>
                  {(sport.defaultMinTeamSize || sport.defaultMatchDuration || sport.defaultScoringFormat) && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
                      {sport.defaultMinTeamSize != null && (
                        <p>Team: {sport.defaultMinTeamSize}–{sport.defaultMaxTeamSize ?? sport.defaultMinTeamSize}</p>
                      )}
                      {sport.defaultMatchDuration != null && (
                        <p>Duration: {sport.defaultMatchDuration} min</p>
                      )}
                      {sport.defaultScoringFormat && (
                        <p>Scoring: {sport.defaultScoringFormat}</p>
                      )}
                    </div>
                  )}
                  {optionEntries.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-1.5">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Options</p>
                      {optionEntries.map(({ key, label, values }) => (
                        <div key={key} className="text-[10px]">
                          <span className="font-bold text-slate-600 dark:text-slate-300">{label || formatOptionKey(key)}: </span>
                          <span className="text-slate-500 dark:text-slate-400">{values.join(', ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 text-sm font-bold">
            {readOnly
              ? 'No sports configured yet. Contact your platform admin.'
              : 'No sports configured yet. Click "Manage Sports" to add your first sport.'}
          </div>
        )}
      </div>

      {!readOnly && (
        <SportManagementModal
          isOpen={showSportModal}
          onClose={() => setShowSportModal(false)}
          sports={sports}
          onUpdate={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
};

export default Sports;
