import React, { useState, useEffect } from 'react';
import { Venue, Court } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useSports } from '../../hooks/useSports';
import { useAppSettings } from '../../hooks/useAppSettings';
import GoogleMapPicker from '../shared/GoogleMapPicker';
import ImageUpload from '../shared/ImageUpload';

interface VenueFormModalProps {
  venue: Venue | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (venueData: Partial<Venue>) => Promise<void>;
}

const VenueFormModal: React.FC<VenueFormModalProps> = ({
  venue,
  isOpen,
  onClose,
  onSave
}) => {
  const { isSuperAdmin } = useAuth();
  const { sports } = useSports({ activeOnly: true, realtime: false });
  const { settings } = useAppSettings(false);
  const [formData, setFormData] = useState<Partial<Venue>>({
    name: '',
    address: '',
    location: { lat: 0, lng: 0 },
    sports: [],
    courts: [],
    amenities: [],
    images: [],
    rules: '',
    status: 'Pending',
    paymentSettings: {
      razorpay: {
        enabled: false
      },
      paymentMethods: ['Bank Transfer', 'UPI', 'Cash']
    },
    userIds: [],
    staffIds: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (venue) {
      // Clean payment settings - remove Razorpay credentials (they come from admin settings)
      const cleanedPaymentSettings = venue.paymentSettings ? {
        ...venue.paymentSettings,
        razorpay: venue.paymentSettings.razorpay ? {
          enabled: venue.paymentSettings.razorpay.enabled || false
          // Don't include accountId or apiKey - they come from admin settings
        } : { enabled: false },
        bankAccount: venue.paymentSettings.bankAccount,
        upiId: venue.paymentSettings.upiId,
        paymentMethods: venue.paymentSettings.paymentMethods || ['Bank Transfer', 'UPI', 'Cash']
      } : {
        razorpay: { enabled: false },
        paymentMethods: ['Bank Transfer', 'UPI', 'Cash']
      };

      setFormData({
        name: venue.name || '',
        address: venue.address || '',
        location: venue.location || { lat: 0, lng: 0 },
        sports: venue.sports || [],
        courts: venue.courts || [],
        amenities: venue.amenities || [],
        images: venue.images || [],
        rules: venue.rules || '',
        status: venue.status || 'Pending',
        paymentSettings: cleanedPaymentSettings,
        userIds: venue.userIds || [],
        staffIds: venue.staffIds || []
      });
    } else {
      setFormData({
        name: '',
        address: '',
        location: { lat: 0, lng: 0 },
        sports: [],
        courts: [],
        amenities: [],
        images: [],
        rules: '',
        status: 'Pending',
        paymentSettings: {
          razorpay: {
            enabled: false
          },
          paymentMethods: ['Bank Transfer', 'UPI', 'Cash']
        },
        userIds: [],
        staffIds: []
      });
    }
  }, [venue, isOpen]);

  const handleInputChange = (field: keyof Venue, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayChange = (field: 'sports' | 'amenities', value: string) => {
    const current = formData[field] || [];
    if (value && !current.includes(value)) {
      setFormData(prev => ({
        ...prev,
        [field]: [...current, value]
      }));
    }
  };

  const handleRemoveArrayItem = (field: 'sports' | 'amenities', index: number) => {
    const current = formData[field] || [];
    setFormData(prev => ({
      ...prev,
      [field]: current.filter((_, i) => i !== index)
    }));
  };

  const handleImagesChange = (urls: string[]) => {
    setFormData(prev => ({
      ...prev,
      images: urls
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Helper function to recursively remove undefined values, empty strings, and empty objects
      const cleanObject = (obj: any): any => {
        if (obj === null || obj === undefined) {
          return undefined;
        }

        // Treat empty strings as undefined for cleaner data
        if (typeof obj === 'string' && obj.trim() === '') {
          return undefined;
        }

        if (Array.isArray(obj)) {
          const cleaned = obj.map(item => cleanObject(item)).filter(item => item !== undefined);
          return cleaned.length > 0 ? cleaned : undefined;
        }

        if (typeof obj === 'object') {
          const cleaned: any = {};
          Object.keys(obj).forEach(key => {
            const value = cleanObject(obj[key]);
            if (value !== undefined) {
              cleaned[key] = value;
            }
          });
          // Return undefined if object is empty after cleaning
          return Object.keys(cleaned).length > 0 ? cleaned : undefined;
        }

        return obj;
      };

      // Clean payment settings - ensure Razorpay credentials are not saved (they come from admin settings)
      let cleanedPaymentSettings: any = undefined;

      if (formData.paymentSettings) {
        cleanedPaymentSettings = {
          razorpay: formData.paymentSettings.razorpay ? {
            enabled: formData.paymentSettings.razorpay.enabled || false
            // Explicitly exclude accountId and apiKey - they come from admin settings
          } : { enabled: false },
          bankAccount: formData.paymentSettings.bankAccount ? cleanObject(formData.paymentSettings.bankAccount) : undefined,
          upiId: formData.paymentSettings.upiId && formData.paymentSettings.upiId.trim() ? formData.paymentSettings.upiId.trim() : undefined,
          paymentMethods: formData.paymentSettings.paymentMethods || ['Bank Transfer', 'UPI', 'Cash']
        };

        // Remove undefined values from paymentSettings
        cleanedPaymentSettings = cleanObject(cleanedPaymentSettings);
      }

      const cleanedFormData = {
        ...formData,
        paymentSettings: cleanedPaymentSettings
      };

      // Clean the entire form data to remove any undefined values
      const finalCleanedData = cleanObject(cleanedFormData);

      await onSave(finalCleanedData);
      onClose();
    } catch (err: any) {
      console.error('Error saving venue:', err);
      setError(err.message || 'Failed to save venue');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-8 py-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className={`size-10 rounded-xl ${venue ? 'bg-blue-500' : 'bg-emerald-500'} flex items-center justify-center text-white`}>
              <span className="material-symbols-outlined text-xl">{venue ? 'edit_square' : 'add_business'}</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                {venue ? 'Modify Venue' : 'Register New Facility'}
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {venue ? `ID: ${venue.id.substring(0, 12).toUpperCase()}` : 'Venue Deployment Wizard'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
          <form id="venue-form" onSubmit={handleSubmit} className="space-y-12">
            {error && (
              <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 px-5 py-4 rounded-xl text-xs font-bold flex items-center gap-3">
                <span className="material-symbols-outlined text-lg">error</span>
                {error}
              </div>
            )}

            {/* Core Specifications */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-5 w-1 rounded-full bg-primary"></div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Core Specifications</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Facility Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
                    placeholder="Enter official designation"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Deployment Status</label>
                  <div className="relative">
                    <select
                      value={formData.status}
                      onChange={(e) => handleInputChange('status', e.target.value)}
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-900 dark:text-white appearance-none disabled:opacity-60"
                      required
                      disabled={!isSuperAdmin}
                    >
                      <option value="Pending">Pending Review</option>
                      <option value="Active">Operational / Active</option>
                      <option value="Inactive">Decommissioned / Inactive</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                  </div>
                </div>
              </div>

              {/* Geographical Node */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Geographical Node</label>
                <div className="rounded-[2rem] overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm transition-all focus-within:border-primary/40">
                  <GoogleMapPicker
                    address={formData.address || ''}
                    lat={formData.location?.lat || 0}
                    lng={formData.location?.lng || 0}
                    onAddressChange={(address) => handleInputChange('address', address)}
                    onLocationChange={(lat, lng) => handleInputChange('location', { lat, lng })}
                  />
                </div>
              </div>
            </section>

            {/* Disciplines & Amenities */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Sports */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-1 rounded-full bg-amber-500"></div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Operational Disciplines</h3>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          const selectedSport = sports.find(s => s.id === e.target.value);
                          handleArrayChange('sports', selectedSport?.name || e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-900 dark:text-white appearance-none"
                      disabled={sports.length === 0}
                    >
                      <option value="">{sports.length === 0 ? 'No sports configured' : 'Add Discipline...'}</option>
                      {sports
                        .filter(sport => !formData.sports?.includes(sport.name))
                        .map(sport => (
                          <option key={sport.id} value={sport.id}>
                            {sport.name}
                          </option>
                        ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">add_circle</span>
                  </div>

                  <div className="flex flex-wrap gap-2 min-h-[44px] p-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                    {formData.sports && formData.sports.length > 0 ? (
                      formData.sports.map((sport, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm group hover:border-amber-400/50 transition-all"
                        >
                          <span className="material-symbols-outlined text-sm text-amber-500">sports_score</span>
                          {sport}
                          <button
                            type="button"
                            onClick={() => handleRemoveArrayItem('sports', index)}
                            className="p-1 hover:bg-rose-50 dark:hover:bg-rose-900/40 hover:text-rose-500 rounded-md transition-colors"
                          >
                            <span className="material-symbols-outlined text-xs">close</span>
                          </button>
                        </span>
                      ))
                    ) : (
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic px-3 py-2">No disciplines assigned</p>
                    )}
                  </div>
                </div>
              </section>

              {/* Amenities */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-1 rounded-full bg-emerald-500"></div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Facility Infrastructure</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleArrayChange('amenities', e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-900 dark:text-white appearance-none"
                      >
                        <option value="">Select Asset...</option>
                        {[
                          'Parking', 'Valet', 'Changing Room', 'Locker Room', 'Shower',
                          'Floodlights', 'Wi-Fi', 'First Aid', 'Cafeteria', 'Restroom',
                          'Viewing Gallery', 'Scoreboard', 'A/C', 'CCTV', 'Equipment Rental'
                        ]
                          .filter(amenity => !formData.amenities?.includes(amenity))
                          .map(amenity => (
                            <option key={amenity} value={amenity}>{amenity}</option>
                          ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">inventory_2</span>
                    </div>
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Manual entry..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const value = e.currentTarget.value.trim();
                            if (value && !formData.amenities?.includes(value)) {
                              handleArrayChange('amenities', value);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                        className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">edit</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 min-h-[44px] p-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                    {formData.amenities && formData.amenities.length > 0 ? (
                      formData.amenities.map((amenity, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:border-emerald-400/50 transition-all"
                        >
                          <span className="material-symbols-outlined text-sm text-emerald-500">done_all</span>
                          {amenity}
                          <button
                            type="button"
                            onClick={() => handleRemoveArrayItem('amenities', index)}
                            className="p-1 hover:bg-rose-50 dark:hover:bg-rose-900/40 hover:text-rose-500 rounded-md transition-colors"
                          >
                            <span className="material-symbols-outlined text-xs">close</span>
                          </button>
                        </span>
                      ))
                    ) : (
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic px-3 py-2">No infrastructure logged</p>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* Visual Assets */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-5 w-1 rounded-full bg-blue-500"></div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Professional Gallery</h3>
              </div>

              <div className="ui-card p-6 bg-slate-50 dark:bg-slate-800/30 border-dashed">
                <ImageUpload
                  value={formData.images || []}
                  onChange={handleImagesChange}
                  folder="venues"
                  itemId={venue?.id}
                  maxImages={10}
                  maxSizeMB={5}
                  compress={true}
                  multiple={true}
                  disabled={loading}
                />
              </div>
            </section>

            {/* Protocol & Policy */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-5 w-1 rounded-full bg-slate-900 dark:bg-white"></div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Operational Protocol</h3>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Terms & Regulatory Policies</label>
                <textarea
                  value={formData.rules}
                  onChange={(e) => handleInputChange('rules', e.target.value)}
                  rows={5}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                  placeholder="Draft facility terms, cancellation policies, and operational rules..."
                />
              </div>
            </section>

            {/* Financial Protocol */}
            <section className="space-y-6 border-t border-slate-100 dark:border-slate-800 pt-10">
              <div className="flex items-center gap-3">
                <div className="h-5 w-1 rounded-full bg-indigo-500"></div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Financial Protocol</h3>
              </div>

              {/* Razorpay Integration */}
              <div className="ui-card bg-slate-50 dark:bg-slate-800/50 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:border-indigo-400/40 transition-all">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-500">bolt</span>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Rapid Settlement Network</h4>
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-wide">
                    Enable real-time digital payments via Razorpay protocol. Uses system-wide master credentials for execution.
                  </p>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.paymentSettings?.razorpay?.enabled || false}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          paymentSettings: {
                            ...prev.paymentSettings,
                            razorpay: {
                              ...prev.paymentSettings?.razorpay,
                              enabled: e.target.checked
                            },
                            paymentMethods: prev.paymentSettings?.paymentMethods || ['Bank Transfer', 'UPI', 'Cash']
                          }
                        }));
                      }}
                      disabled={!settings.integrations?.razorpay?.apiKey || !settings.integrations?.razorpay?.apiSecret}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-[20px] after:w-[20px] after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-30"></div>
                  </label>

                  {!settings.integrations?.razorpay?.apiKey || !settings.integrations?.razorpay?.apiSecret ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-full text-[8px] font-black uppercase tracking-widest border border-rose-100 dark:border-rose-800">
                      <span className="material-symbols-outlined text-[10px]">warning</span>
                      Global Config Missing
                    </span>
                  ) : formData.paymentSettings?.razorpay?.enabled ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[8px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800 animate-pulse">
                      <span className="material-symbols-outlined text-[10px]">shield_check</span>
                      Protocol Engaged
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-8">
                {/* Bank Account */}
                <div className="ui-card p-6 space-y-6">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400">account_balance</span>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Settlement Account</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Holder Designation</label>
                      <input
                        type="text"
                        value={formData.paymentSettings?.bankAccount?.accountHolderName || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            paymentSettings: {
                              ...prev.paymentSettings,
                              paymentMethods: prev.paymentSettings?.paymentMethods || ['Bank Transfer', 'UPI', 'Cash'],
                              razorpay: prev.paymentSettings?.razorpay || { enabled: false },
                              bankAccount: {
                                ...(prev.paymentSettings?.bankAccount || { accountNumber: '', ifscCode: '', bankName: '', branch: '' }),
                                accountHolderName: val
                              }
                            }
                          }));
                        }}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                        placeholder="Legal Entity Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Identifier</label>
                      <input
                        type="text"
                        value={formData.paymentSettings?.bankAccount?.accountNumber || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            paymentSettings: {
                              ...prev.paymentSettings,
                              paymentMethods: prev.paymentSettings?.paymentMethods || ['Bank Transfer', 'UPI', 'Cash'],
                              razorpay: prev.paymentSettings?.razorpay || { enabled: false },
                              bankAccount: {
                                ...(prev.paymentSettings?.bankAccount || { accountHolderName: '', ifscCode: '', bankName: '', branch: '' }),
                                accountNumber: val
                              }
                            }
                          }));
                        }}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                        placeholder="Digital Payout Node"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Protocol (IFSC) Code</label>
                      <input
                        type="text"
                        value={formData.paymentSettings?.bankAccount?.ifscCode || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            paymentSettings: {
                              ...prev.paymentSettings,
                              paymentMethods: prev.paymentSettings?.paymentMethods || ['Bank Transfer', 'UPI', 'Cash'],
                              razorpay: prev.paymentSettings?.razorpay || { enabled: false },
                              bankAccount: {
                                ...(prev.paymentSettings?.bankAccount || { accountHolderName: '', accountNumber: '', bankName: '', branch: '' }),
                                ifscCode: val
                              }
                            }
                          }));
                        }}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                        placeholder="Transaction Routing"
                      />
                    </div>
                  </div>
                </div>

                {/* UPI & Methods */}
                <div className="space-y-8">
                  <div className="ui-card p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-400 text-lg">qr_code_2</span>
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">UPI Digital Uplink</h4>
                    </div>
                    <input
                      type="text"
                      value={formData.paymentSettings?.upiId || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          paymentSettings: {
                            ...prev.paymentSettings,
                            razorpay: prev.paymentSettings?.razorpay || { enabled: false },
                            paymentMethods: prev.paymentSettings?.paymentMethods || ['Bank Transfer', 'UPI', 'Cash'],
                            upiId: val
                          }
                        }));
                      }}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                      placeholder="node@protocol"
                    />
                  </div>

                  <div className="ui-card p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-400 text-lg">checklist</span>
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Accepted Modalities</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {['Bank Transfer', 'UPI', 'Cash', 'Cheque'].map((method) => {
                        const isSelected = formData.paymentSettings?.paymentMethods?.includes(method as any);
                        return (
                          <button
                            key={method}
                            type="button"
                            onClick={() => {
                              const current = formData.paymentSettings?.paymentMethods || [];
                              const newMethods = isSelected
                                ? current.filter(m => m !== method)
                                : [...current, method as any];
                              setFormData(prev => ({
                                ...prev,
                                paymentSettings: {
                                  ...prev.paymentSettings,
                                  razorpay: prev.paymentSettings?.razorpay || { enabled: false },
                                  paymentMethods: newMethods
                                }
                              }));
                            }}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${isSelected
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-md'
                              : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-700 hover:border-slate-300'
                              }`}
                          >
                            {method}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-8 py-6 flex gap-4">
          <button
            type="submit"
            form="venue-form"
            disabled={loading}
            className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 h-14 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3 group"
          >
            {loading ? (
              <div className="size-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-lg group-hover:rotate-12 transition-transform">{venue ? 'save' : 'rocket_launch'}</span>
            )}
            {loading ? 'Processing...' : venue ? 'Commit Changes' : 'Execute Registration'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white h-14 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
          >
            Abort
          </button>
        </div>
      </div>
    </div>
  );
};

export default VenueFormModal;

