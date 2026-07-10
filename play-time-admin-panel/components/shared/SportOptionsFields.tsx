import React from 'react';
import { Sport } from '../../types';
import { getSportOptionEntries, formatOptionKey } from '../../utils/sportUtils';

interface SportOptionsFieldsProps {
  sport: Sport | undefined;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  className?: string;
  compact?: boolean;
}

const SportOptionsFields: React.FC<SportOptionsFieldsProps> = ({
  sport,
  values,
  onChange,
  className = '',
  compact = false,
}) => {
  const entries = getSportOptionEntries(sport);

  if (entries.length === 0) return null;

  const handleChange = (key: string, value: string) => {
    onChange({ ...values, [key]: value });
  };

  const labelClass = compact
    ? 'text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block'
    : 'block text-sm font-black text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-widest';

  const inputClass = compact
    ? 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary'
    : 'w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary';

  return (
    <div className={`space-y-3 ${className}`}>
      <p className={compact ? 'text-[10px] font-black text-slate-500 uppercase tracking-widest' : 'text-xs font-black text-slate-500 uppercase tracking-widest'}>
        {sport?.name} Options
      </p>
      <div className={compact ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
        {entries.map(({ key, label, values: optionValues }) => (
          <div key={key}>
            <label className={labelClass}>{label || formatOptionKey(key)}</label>
            <select
              value={values[key] || ''}
              onChange={(e) => handleChange(key, e.target.value)}
              className={inputClass}
            >
              <option value="">Select {label || formatOptionKey(key)}</option>
              {optionValues.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SportOptionsFields;
