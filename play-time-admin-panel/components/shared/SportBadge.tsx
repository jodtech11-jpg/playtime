import React from 'react';
import { Sport } from '../../types';
import { findSport, getSportColor } from '../../utils/sportUtils';

interface SportBadgeProps {
  sportName: string;
  sports?: Sport[];
  size?: 'sm' | 'md';
  onRemove?: () => void;
}

const SportBadge: React.FC<SportBadgeProps> = ({
  sportName,
  sports = [],
  size = 'md',
  onRemove,
}) => {
  const sport = findSport(sportName, sports);
  const color = sport?.color || getSportColor(sportName, sports);
  const icon = sport?.icon || 'sports_score';
  const isSm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-2 border rounded-xl font-black uppercase tracking-widest shadow-sm ${
        isSm ? 'px-3 py-1.5 text-[9px]' : 'px-4 py-2 text-[10px]'
      }`}
      style={{
        backgroundColor: `${color}14`,
        borderColor: `${color}40`,
        color,
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: isSm ? '14px' : '16px', color }}>
        {icon}
      </span>
      {sportName}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-0.5 hover:opacity-70 rounded-md transition-opacity"
          aria-label={`Remove ${sportName}`}
        >
          <span className="material-symbols-outlined text-xs">close</span>
        </button>
      )}
    </span>
  );
};

export default SportBadge;
