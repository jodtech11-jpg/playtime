import React, { useState } from 'react';
import { Court, Venue } from '../../types';
import { useCourts } from '../../hooks/useCourts';
import { courtsCollection, syncVenueCourts } from '../../services/firebase';
import { formatCurrency, getStatusColor } from '../../utils/formatUtils';
import CourtFormModal from './CourtFormModal';
import { serverTimestamp } from 'firebase/firestore';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

interface CourtManagementModalProps {
  venue: Venue;
  isOpen: boolean;
  onClose: () => void;
}

const CourtManagementModal: React.FC<CourtManagementModalProps> = ({
  venue,
  isOpen,
  onClose
}) => {
  const { courts, loading } = useCourts({ venueId: venue.id, realtime: true });
  const [isCourtModalOpen, setIsCourtModalOpen] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const handleCreateCourt = () => {
    setSelectedCourt(null);
    setIsCourtModalOpen(true);
  };

  const handleEditCourt = (court: Court) => {
    setSelectedCourt(court);
    setIsCourtModalOpen(true);
  };

  const handleSaveCourt = async (courtData: Partial<Court>) => {
    try {
      setProcessing('saving');

      if (selectedCourt) {
        await courtsCollection.update(selectedCourt.id, {
          ...courtData,
          updatedAt: serverTimestamp()
        });
      } else {
        await courtsCollection.create({
          ...courtData,
          venueId: venue.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      await syncVenueCourts(venue.id);
      setIsCourtModalOpen(false);
      setSelectedCourt(null);
    } catch (error: any) {
      console.error('Error saving court:', error);
      throw error;
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteCourt = (courtId: string) => {
    openConfirm({
      title: 'Delete court?',
      message: 'This action cannot be undone.',
      onConfirm: async () => {
        try {
          setProcessing(courtId);
          await courtsCollection.delete(courtId);
          await syncVenueCourts(venue.id);
        } catch (error: any) {
          console.error('Error deleting court:', error);
          showError('Failed to delete court: ' + error.message);
        } finally {
          setProcessing(null);
        }
      },
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {confirmDialog}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-surface-dark border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between z-10">
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100">Manage Courts</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{venue.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCreateCourt}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-content rounded-xl text-sm font-black hover:bg-primary-hover shadow-lg shadow-primary/10 transition-all"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Add Court
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-gray-500">close</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                  <p className="text-sm text-gray-500">Loading courts...</p>
                </div>
              </div>
            ) : courts.length === 0 ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">sports_tennis</span>
                <h3 className="text-xl font-black text-gray-900 mb-2">No Courts Added</h3>
                <p className="text-gray-500 mb-6">Add your first court to start accepting bookings.</p>
                <button
                  onClick={handleCreateCourt}
                  className="px-6 py-3 bg-primary text-primary-content rounded-xl text-sm font-black hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all"
                >
                  Add First Court
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {courts.map((court) => {
                  const statusColors = getStatusColor(court.status);
                  return (
                    <div
                      key={court.id}
                      className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-primary/50 transition-all"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-black text-gray-900">{court.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">{court.sport} {court.type && `• ${court.type}`}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                          {court.status}
                        </span>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-gray-600">Price per Hour</span>
                          <span className="text-lg font-black text-primary">{formatCurrency(court.pricePerHour)}</span>
                        </div>
                        <div>
                          <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Availability</span>
                          <div className="mt-2 space-y-1">
                            {Object.entries(court.availability || {}).slice(0, 3).map(([day, schedule]) => (
                              <div key={day} className="flex items-center justify-between text-xs">
                                <span className="text-gray-600">{day.substring(0, 3)}</span>
                                {schedule.available ? (
                                  <span className="text-gray-900 font-bold">
                                    {schedule.start} - {schedule.end}
                                  </span>
                                ) : (
                                  <span className="text-red-500 font-bold">Closed</span>
                                )}
                              </div>
                            ))}
                            {Object.keys(court.availability || {}).length > 3 && (
                              <p className="text-xs text-gray-400">+{Object.keys(court.availability || {}).length - 3} more days</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => handleEditCourt(court)}
                          className="flex-1 py-2 bg-background-light dark:bg-surface-dark text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCourt(court.id)}
                          disabled={processing === court.id}
                          className="px-4 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          {processing === court.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Court Form Modal */}
      <CourtFormModal
        court={selectedCourt}
        venueId={venue.id}
        isOpen={isCourtModalOpen}
        onClose={() => {
          setIsCourtModalOpen(false);
          setSelectedCourt(null);
        }}
        onSave={handleSaveCourt}
      />
    </>
  );
};

export default CourtManagementModal;

