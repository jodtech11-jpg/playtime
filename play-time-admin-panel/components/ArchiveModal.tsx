import React, { useState, useMemo } from 'react';
import { useSupportTickets } from '../hooks/useSupportTickets';
import { useUsers } from '../hooks/useUsers';
import { supportTicketsCollection } from '../services/firebase';
import { SupportTicket } from '../types';
import { getRelativeTime, formatDate } from '../utils/dateUtils';
import { serverTimestamp } from 'firebase/firestore';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ArchiveModal: React.FC<ArchiveModalProps> = ({ isOpen, onClose }) => {
  const [statusFilter, setStatusFilter] = useState<'Resolved' | 'Closed' | 'All'>('All');
  const [processing, setProcessing] = useState<string | null>(null);

  // Fetch all tickets and filter for archived ones
  const { tickets, loading } = useSupportTickets({ 
    realtime: true
  });
  const { users } = useUsers({ limit: 100 });

  const archivedTickets = useMemo(() => {
    return tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed');
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    if (statusFilter === 'All') return archivedTickets;
    return archivedTickets.filter(t => t.status === statusFilter);
  }, [archivedTickets, statusFilter]);

  const ticketDetails = useMemo(() => {
    return filteredTickets.map(ticket => {
      const user = users.find(u => u.id === ticket.userId);
      return {
        ...ticket,
        userName: user?.name || ticket.userName || 'Unknown User',
        userInitials: (user?.name || ticket.userName || 'U')[0].toUpperCase(),
        createdAtDate: ticket.createdAt?.toDate ? ticket.createdAt.toDate() : new Date(ticket.createdAt),
        resolvedDate: ticket.resolvedAt?.toDate ? ticket.resolvedAt.toDate() : null
      };
    });
  }, [filteredTickets, users]);

  const handleRestore = async (ticketId: string) => {
    if (!confirm('Are you sure you want to restore this ticket?')) return;

    try {
      setProcessing(ticketId);
      await supportTicketsCollection.update(ticketId, {
        status: 'Open',
        updatedAt: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error restoring ticket:', error);
      alert('Failed to restore ticket: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (ticketId: string) => {
    if (!confirm('Are you sure you want to permanently delete this ticket? This action cannot be undone.')) return;

    try {
      setProcessing(ticketId);
      await supportTicketsCollection.delete(ticketId);
    } catch (error: any) {
      console.error('Error deleting ticket:', error);
      alert('Failed to delete ticket: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-2xl font-black text-gray-900">Archived Tickets</h3>
            <p className="text-sm text-gray-500 mt-1">
              {archivedTickets.length} archived ticket{archivedTickets.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6">
          {/* Filters */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setStatusFilter('All')}
              className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-colors ${
                statusFilter === 'All'
                  ? 'bg-sidebar-dark text-white'
                  : 'bg-white border border-gray-200 text-gray-400'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('Resolved')}
              className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-colors ${
                statusFilter === 'Resolved'
                  ? 'bg-sidebar-dark text-white'
                  : 'bg-white border border-gray-200 text-gray-400'
              }`}
            >
              Resolved
            </button>
            <button
              onClick={() => setStatusFilter('Closed')}
              className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-colors ${
                statusFilter === 'Closed'
                  ? 'bg-sidebar-dark text-white'
                  : 'bg-white border border-gray-200 text-gray-400'
              }`}
            >
              Closed
            </button>
          </div>

          {loading && ticketDetails.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-gray-600 font-medium">Loading archived tickets...</p>
            </div>
          ) : ticketDetails.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">archive</span>
              <p className="text-sm font-medium">No archived tickets found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ticketDetails.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-gray-50 rounded-xl p-5 border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-bold text-gray-400 font-mono text-xs">
                          {ticket.ticketNumber || `#${ticket.id.substring(0, 8).toUpperCase()}`}
                        </p>
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border ${
                          ticket.status === 'Resolved' 
                            ? 'bg-green-50 text-green-700 border-green-100'
                            : 'bg-gray-50 text-gray-700 border-gray-100'
                        }`}>
                          {ticket.status}
                        </span>
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border ${
                          ticket.priority === 'Critical' || ticket.priority === 'High' 
                            ? 'bg-red-50 text-red-700 border-red-100'
                            : ticket.priority === 'Medium'
                            ? 'bg-orange-50 text-orange-700 border-orange-100'
                            : 'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                          {ticket.priority}
                        </span>
                      </div>
                      <h4 className="font-black text-gray-900 mb-1">{ticket.subject}</h4>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{ticket.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black">
                            {ticket.userInitials}
                          </div>
                          <span>{ticket.userName}</span>
                        </div>
                        <span>•</span>
                        <span>Type: {ticket.type}</span>
                        <span>•</span>
                        <span>Created: {getRelativeTime(ticket.createdAtDate)}</span>
                        {ticket.resolvedDate && (
                          <>
                            <span>•</span>
                            <span>Resolved: {getRelativeTime(ticket.resolvedDate)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRestore(ticket.id)}
                        disabled={processing === ticket.id}
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase hover:bg-gray-50 transition-all disabled:opacity-50"
                      >
                        {processing === ticket.id ? 'Restoring...' : 'Restore'}
                      </button>
                      <button
                        onClick={() => handleDelete(ticket.id)}
                        disabled={processing === ticket.id}
                        className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-black uppercase hover:bg-red-100 transition-all disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 border border-gray-200 rounded-xl font-black text-sm hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArchiveModal;

