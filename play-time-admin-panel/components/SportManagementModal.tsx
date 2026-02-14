import React, { useState, useEffect } from 'react';
import { Sport } from '../types';
import { sportsCollection } from '../services/firebase';
import { serverTimestamp } from 'firebase/firestore';

interface SportManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  sports: Sport[];
  onUpdate: () => void;
}

const SportManagementModal: React.FC<SportManagementModalProps> = ({
  isOpen,
  onClose,
  sports,
  onUpdate
}) => {
  const [editingSport, setEditingSport] = useState<Sport | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('#10b981');
  const [order, setOrder] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  
  // Common tournament settings
  const [defaultMinTeamSize, setDefaultMinTeamSize] = useState<string>('');
  const [defaultMaxTeamSize, setDefaultMaxTeamSize] = useState<string>('');
  const [defaultMatchDuration, setDefaultMatchDuration] = useState<string>('');
  const [defaultScoringFormat, setDefaultScoringFormat] = useState('');
  
  // Sport-specific options (form-based)
  const [sportSpecificOptions, setSportSpecificOptions] = useState<Array<{key: string; values: string[]}>>([]);
  const [newOptionKey, setNewOptionKey] = useState('');
  const [newOptionValue, setNewOptionValue] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (editingSport) {
      setName(editingSport.name);
      setDescription(editingSport.description || '');
      setIcon(editingSport.icon || '');
      setColor(editingSport.color || '#10b981');
      setOrder(editingSport.order?.toString() || '');
      setIsActive(editingSport.isActive);
      setDefaultMinTeamSize(editingSport.defaultMinTeamSize?.toString() || '');
      setDefaultMaxTeamSize(editingSport.defaultMaxTeamSize?.toString() || '');
      setDefaultMatchDuration(editingSport.defaultMatchDuration?.toString() || '');
      setDefaultScoringFormat(editingSport.defaultScoringFormat || '');
      // Convert object to array format
      const options = editingSport.sportSpecificOptions || {};
      setSportSpecificOptions(
        Object.entries(options).map(([key, value]) => ({
          key,
          values: Array.isArray(value) ? value : [String(value)]
        }))
      );
    } else {
      resetForm();
    }
    setError(null);
  }, [editingSport]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setIcon('');
    setColor('#10b981');
    setOrder('');
    setIsActive(true);
    setDefaultMinTeamSize('');
    setDefaultMaxTeamSize('');
    setDefaultMatchDuration('');
    setDefaultScoringFormat('');
    setSportSpecificOptions([]);
    setNewOptionKey('');
    setNewOptionValue('');
  };

  const addOption = () => {
    if (!newOptionKey.trim()) return;
    setSportSpecificOptions([...sportSpecificOptions, { key: newOptionKey.trim(), values: [] }]);
    setNewOptionKey('');
  };

  const removeOption = (index: number) => {
    setSportSpecificOptions(sportSpecificOptions.filter((_, i) => i !== index));
  };

  const addOptionValue = (index: number) => {
    if (!newOptionValue.trim()) return;
    const updated = [...sportSpecificOptions];
    updated[index].values = [...updated[index].values, newOptionValue.trim()];
    setSportSpecificOptions(updated);
    setNewOptionValue('');
  };

  const removeOptionValue = (optionIndex: number, valueIndex: number) => {
    const updated = [...sportSpecificOptions];
    updated[optionIndex].values = updated[optionIndex].values.filter((_, i) => i !== valueIndex);
    setSportSpecificOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!name.trim()) {
        throw new Error('Sport name is required');
      }

      // Convert array format to object
      const parsedOptions: Record<string, any> = {};
      sportSpecificOptions.forEach(option => {
        if (option.key && option.values.length > 0) {
          parsedOptions[option.key] = option.values;
        }
      });

      const sportData: Omit<Sport, 'id' | 'createdAt' | 'updatedAt'> = {
        name: name.trim(),
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
        color: color,
        order: order ? parseInt(order) : undefined,
        isActive,
        defaultMinTeamSize: defaultMinTeamSize ? parseInt(defaultMinTeamSize) : undefined,
        defaultMaxTeamSize: defaultMaxTeamSize ? parseInt(defaultMaxTeamSize) : undefined,
        defaultMatchDuration: defaultMatchDuration ? parseInt(defaultMatchDuration) : undefined,
        defaultScoringFormat: defaultScoringFormat.trim() || undefined,
        sportSpecificOptions: Object.keys(parsedOptions).length > 0 ? parsedOptions : undefined
      };

      if (editingSport) {
        await sportsCollection.update(editingSport.id, {
          ...sportData,
          updatedAt: serverTimestamp()
        });
      } else {
        await sportsCollection.create({
          ...sportData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      resetForm();
      setEditingSport(null);
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to save sport');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (sport: Sport) => {
    setEditingSport(sport);
  };

  const handleDelete = async (sportId: string) => {
    if (!confirm('Are you sure you want to delete this sport? Tournaments using this sport will need to be updated.')) {
      return;
    }

    try {
      setProcessing(sportId);
      await sportsCollection.delete(sportId);
      onUpdate();
    } catch (err: any) {
      alert('Failed to delete sport: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleToggleActive = async (sport: Sport) => {
    try {
      setProcessing(sport.id);
      await sportsCollection.update(sport.id, {
        isActive: !sport.isActive,
        updatedAt: serverTimestamp()
      });
      onUpdate();
    } catch (err: any) {
      alert('Failed to update sport: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  // Pre-fill sport-specific options based on sport name
  const getSportTemplate = (sportName: string) => {
    const templates: Record<string, any> = {
      'Badminton': {
        courtType: ['Indoor', 'Outdoor', 'Both'],
        gameTypes: ['Singles', 'Doubles', 'Mixed Doubles'],
        shuttleType: ['Plastic', 'Feather']
      },
      'Cricket': {
        format: ['T20', 'ODI', 'Test'],
        overs: [6, 10, 20, 50],
        ballType: ['Leather', 'Tennis'],
        pitchType: ['Turf', 'Concrete', 'Matting']
      },
      'Football': {
        fieldSize: ['5v5', '7v7', '11v11'],
        matchDuration: [20, 30, 45, 90],
        ballSize: ['Size 4', 'Size 5']
      },
      'Tennis': {
        courtSurface: ['Hard', 'Clay', 'Grass', 'Carpet'],
        matchFormat: ['Best of 3', 'Best of 5']
      },
      'Basketball': {
        courtType: ['Indoor', 'Outdoor'],
        ballSize: ['Size 6', 'Size 7']
      }
    };
    return templates[sportName] || {};
  };

  const applyTemplate = () => {
    if (name.trim()) {
      const template = getSportTemplate(name.trim());
      if (Object.keys(template).length > 0) {
        const templateArray = Object.entries(template).map(([key, value]) => ({
          key,
          values: Array.isArray(value) ? value : [String(value)]
        }));
        setSportSpecificOptions(templateArray);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-2xl font-black text-gray-900">
            {editingSport ? 'Edit Sport' : 'Manage Sports'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="material-symbols-outlined text-3xl">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Form Section */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-4">
            <h4 className="text-lg font-black text-gray-900">
              {editingSport ? 'Edit Sport' : 'Create New Sport'}
            </h4>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Sport Name *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (!editingSport && sportSpecificOptions.length === 0) {
                          // Auto-apply template when name changes
                          setTimeout(() => {
                            const template = getSportTemplate(e.target.value);
                            if (Object.keys(template).length > 0) {
                              const templateArray = Object.entries(template).map(([key, value]) => ({
                                key,
                                values: Array.isArray(value) ? value : [String(value)]
                              }));
                              setSportSpecificOptions(templateArray);
                            }
                          }, 100);
                        }
                      }}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g., Badminton, Cricket, Football"
                      required
                    />
                    <button
                      type="button"
                      onClick={applyTemplate}
                      className="px-4 py-3 bg-primary/10 text-primary rounded-xl font-black text-xs hover:bg-primary/20 transition-all"
                      title="Apply template for this sport"
                    >
                      Apply Template
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="Sport description..."
                    rows={2}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Icon (Material Symbol)
                  </label>
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., sports, sports_soccer"
                  />
                  {icon && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="material-symbols-outlined text-2xl">{icon}</span>
                      <span className="text-xs text-gray-500">Preview</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-16 h-12 border border-gray-200 rounded-xl cursor-pointer"
                    />
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="#10b981"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={order}
                    onChange={(e) => setOrder(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0"
                    min="0"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-5 h-5 text-primary rounded focus:ring-primary"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Active (visible in tournament creation)
                  </label>
                </div>
              </div>

              {/* Common Tournament Settings */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h5 className="text-sm font-black text-gray-900 mb-4">Common Tournament Settings</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                      Default Min Team Size
                    </label>
                    <input
                      type="number"
                      value={defaultMinTeamSize}
                      onChange={(e) => setDefaultMinTeamSize(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="1"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                      Default Max Team Size
                    </label>
                    <input
                      type="number"
                      value={defaultMaxTeamSize}
                      onChange={(e) => setDefaultMaxTeamSize(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="11"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                      Default Match Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={defaultMatchDuration}
                      onChange={(e) => setDefaultMatchDuration(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="90"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                      Default Scoring Format
                    </label>
                    <input
                      type="text"
                      value={defaultScoringFormat}
                      onChange={(e) => setDefaultScoringFormat(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g., Best of 3, First to 21"
                    />
                  </div>
                </div>
              </div>

              {/* Sport-Specific Options */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-sm font-black text-gray-900">Sport-Specific Options</h5>
                  <button
                    type="button"
                    onClick={applyTemplate}
                    className="text-xs text-primary hover:underline"
                  >
                    Use Template
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Add custom options for this sport (e.g., courtType, gameTypes, ballSize, etc.)
                </p>

                {/* Add New Option */}
                <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newOptionKey}
                      onChange={(e) => setNewOptionKey(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      placeholder="Option Name (e.g., courtType, gameTypes)"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addOption();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={addOption}
                      disabled={!newOptionKey.trim()}
                      className="px-4 py-2 bg-primary text-primary-content rounded-xl text-sm font-black hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add Option
                    </button>
                  </div>
                </div>

                {/* Existing Options */}
                <div className="space-y-4">
                  {sportSpecificOptions.map((option, optionIndex) => (
                    <div key={optionIndex} className="p-4 border border-gray-200 rounded-xl bg-white">
                      <div className="flex items-center justify-between mb-3">
                        <h6 className="font-black text-gray-900 capitalize">{option.key}</h6>
                        <button
                          type="button"
                          onClick={() => removeOption(optionIndex)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          title="Remove Option"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                      
                      {/* Values List */}
                      <div className="space-y-2 mb-3">
                        {option.values.map((value, valueIndex) => (
                          <div key={valueIndex} className="flex items-center gap-2">
                            <span className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                              {value}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeOptionValue(optionIndex, valueIndex)}
                              className="text-red-500 hover:text-red-700 transition-colors"
                              title="Remove Value"
                            >
                              <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add Value */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newOptionValue}
                          onChange={(e) => setNewOptionValue(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                          placeholder="Add value (e.g., Indoor, Outdoor)"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addOptionValue(optionIndex);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => addOptionValue(optionIndex)}
                          disabled={!newOptionValue.trim()}
                          className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-black hover:bg-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add Value
                        </button>
                      </div>
                    </div>
                  ))}

                  {sportSpecificOptions.length === 0 && (
                    <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                      <span className="material-symbols-outlined text-4xl mb-2 block">add_circle_outline</span>
                      <p className="text-sm">No sport-specific options added yet</p>
                      <p className="text-xs mt-1">Click "Add Option" above to get started</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                {editingSport && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSport(null);
                      resetForm();
                    }}
                    className="px-6 py-3 border border-gray-200 rounded-xl font-black text-sm hover:bg-gray-50 transition-colors"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : editingSport ? 'Update Sport' : 'Create Sport'}
                </button>
              </div>
            </form>
          </div>

          {/* Sports List */}
          <div>
            <h4 className="text-lg font-black text-gray-900 mb-4">Existing Sports</h4>
            {sports.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">sports</span>
                <p>No sports found. Create your first sport above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sports.map((sport) => (
                  <div
                    key={sport.id}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                      editingSport?.id === sport.id
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {sport.icon && (
                        <span
                          className="material-symbols-outlined text-2xl"
                          style={{ color: sport.color }}
                        >
                          {sport.icon}
                        </span>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h5 className="font-black text-gray-900">{sport.name}</h5>
                          {!sport.isActive && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[9px] font-black uppercase tracking-widest rounded">
                              Inactive
                            </span>
                          )}
                          {sport.order !== undefined && (
                            <span className="text-xs text-gray-400">Order: {sport.order}</span>
                          )}
                        </div>
                        {sport.description && (
                          <p className="text-sm text-gray-500 mt-1">{sport.description}</p>
                        )}
                        {sport.sportSpecificOptions && Object.keys(sport.sportSpecificOptions).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {Object.keys(sport.sportSpecificOptions).slice(0, 3).map(key => (
                              <span key={key} className="px-2 py-1 bg-primary/10 text-primary text-[9px] font-black uppercase rounded">
                                {key}
                              </span>
                            ))}
                            {Object.keys(sport.sportSpecificOptions).length > 3 && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-[9px] font-black uppercase rounded">
                                +{Object.keys(sport.sportSpecificOptions).length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(sport)}
                        disabled={processing === sport.id}
                        className={`px-3 py-2 rounded-lg text-xs font-black transition-all disabled:opacity-50 ${
                          sport.isActive
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        }`}
                        title={sport.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {sport.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleEdit(sport)}
                        className="px-3 py-2 text-gray-400 hover:text-primary transition-colors"
                        title="Edit"
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(sport.id)}
                        disabled={processing === sport.id}
                        className="px-3 py-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:bg-primary-hover transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SportManagementModal;

