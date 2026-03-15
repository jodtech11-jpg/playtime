import React, { useState, useMemo } from 'react';
import { useSupportTickets } from '../hooks/useSupportTickets';
import { useUsers } from '../hooks/useUsers';
import { supportTicketsCollection } from '../services/firebase';
import { SupportTicket } from '../types';
import { getRelativeTime } from '../utils/dateUtils';
import { serverTimestamp } from 'firebase/firestore';
import TicketDetailModal from '../components/modals/TicketDetailModal';
import ArchiveModal from '../components/modals/ArchiveModal';
import HelpCenterDocsModal from '../components/modals/HelpCenterDocsModal';

const Support: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<'Open' | 'In Progress' | 'Resolved' | 'Closed' | 'All'>('All');
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showHelpCenterModal, setShowHelpCenterModal] = useState(false);

  const { tickets, loading } = useSupportTickets({ realtime: true });
  const { users } = useUsers({ limit: 100 });

  // Filter tickets
  const filteredTickets = useMemo(() => {
    if (statusFilter === 'All') return tickets;
    if (statusFilter === 'Open') {
      // Show unresolved tickets (Open and In Progress)
      return tickets.filter(t => t.status === 'Open' || t.status === 'In Progress');
    }
    return tickets.filter(t => t.status === statusFilter);
  }, [tickets, statusFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const openTickets = tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
    const billingDisputes = tickets.filter(t => t.type === 'Refund Request' && t.status !== 'Resolved' && t.status !== 'Closed').length;
    
    // Calculate average response time
    const resolvedTickets = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed');
    let avgResponseTime = 'N/A';
    
    if (resolvedTickets.length > 0) {
      const totalResponseTime = resolvedTickets.reduce((sum, ticket) => {
        if (ticket.createdAt && ticket.resolvedAt) {
          const created = ticket.createdAt.toDate ? ticket.createdAt.toDate() : new Date(ticket.createdAt);
          const resolved = ticket.resolvedAt.toDate ? ticket.resolvedAt.toDate() : new Date(ticket.resolvedAt);
          const hours = (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);
          return sum + hours;
        }
        return sum;
      }, 0);
      
      const avgHours = totalResponseTime / resolvedTickets.length;
      if (avgHours < 1) {
        avgResponseTime = `${Math.round(avgHours * 60)}m`;
      } else {
        avgResponseTime = `${avgHours.toFixed(1)}h`;
      }
    }

    return {
      openTickets,
      billingDisputes,
      avgResponseTime
    };
  }, [tickets]);

  // Get ticket details with user info
  const ticketDetails = useMemo(() => {
    return filteredTickets.map(ticket => {
      const user = users.find(u => u.id === ticket.userId);
      const priorityColor = ticket.priority === 'High' || ticket.priority === 'Critical' ? 'red' :
                            ticket.priority === 'Medium' ? 'orange' : 'blue';
      
      return {
        ...ticket,
        userName: user?.name || ticket.userName || 'Unknown User',
        userInitials: (user?.name || ticket.userName || 'U')[0].toUpperCase(),
        priorityColor,
        createdAtDate: ticket.createdAt?.toDate ? ticket.createdAt.toDate() : new Date(ticket.createdAt)
      };
    });
  }, [filteredTickets, users]);

  const handleResolveTicket = async (ticketId: string) => {
    try {
      setProcessing(ticketId);
      await supportTicketsCollection.update(ticketId, {
        status: 'Resolved',
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error resolving ticket:', error);
      alert('Failed to resolve ticket: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleViewTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setShowTicketModal(true);
  };

  const handleTicketUpdate = () => {
    // Force refresh by closing and reopening modal
    setShowTicketModal(false);
    setTimeout(() => {
      if (selectedTicket) {
        setShowTicketModal(true);
      }
    }, 100);
  };

  if (loading && tickets.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading support tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 bg-background-light dark:bg-background-dark min-h-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Support & Disputes</h2>
          <p className="text-gray-500 mt-1">Manage user reports, billing disputes, and platform inquiries.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowArchiveModal(true)}
            className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
          >
            Archive
          </button>
          <button 
            onClick={() => setShowHelpCenterModal(true)}
            className="bg-sidebar-dark text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all"
          >
            Help Center Docs
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Open Tickets', val: stats.openTickets.toString(), color: 'text-orange-600', bg: 'bg-orange-50', icon: 'confirmation_number' },
          { label: 'Billing Disputes', val: stats.billingDisputes.toString(), color: 'text-red-600', bg: 'bg-red-50', icon: 'payments' },
          { label: 'Avg. Response', val: stats.avgResponseTime, color: 'text-blue-600', bg: 'bg-blue-50', icon: 'timer' },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
            <div className={`size-12 rounded-xl ${s.bg} ${s.color} flex items-center justify-center`}>
              <span className="material-symbols-outlined">{s.icon}</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.label}</p>
              <h4 className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">{s.val}</h4>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-surface-dark rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden mb-10">
        <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/30 dark:bg-gray-800/30">
          <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight">Active Tickets</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('Open')}
              className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-colors ${
                statusFilter === 'Open'
                  ? 'bg-sidebar-dark text-white'
                  : 'bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
              }`}
            >
              Unresolved
            </button>
            <button
              onClick={() => setStatusFilter('All')}
              className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-colors ${
                statusFilter === 'All'
                  ? 'bg-sidebar-dark text-white'
                  : 'bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
              }`}
            >
              Recent
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {ticketDetails.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">support_agent</span>
              <p className="text-sm font-medium">No tickets found</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/30 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                  <th className="px-8 py-4">Ticket</th>
                  <th className="px-8 py-4">User</th>
                  <th className="px-8 py-4">Type</th>
                  <th className="px-8 py-4">Priority</th>
                  <th className="px-8 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm font-medium">
                {ticketDetails.map((ticket) => (
                  <tr 
                    key={ticket.id} 
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleViewTicket(ticket)}
                  >
                    <td className="px-8 py-6">
                      <p className="font-bold text-gray-400 font-mono text-xs">{ticket.ticketNumber || `#${ticket.id.substring(0, 8).toUpperCase()}`}</p>
                      <p className="text-[9px] font-black text-gray-300 uppercase mt-1">
                        {getRelativeTime(ticket.createdAtDate)}
                      </p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                          {ticket.userInitials}
                        </div>
                        <span className="font-black text-gray-900">{ticket.userName}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-gray-600 font-semibold">{ticket.type}</td>
                    <td className="px-8 py-6">
                      <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border ${
                        ticket.priorityColor === 'red' ? 'bg-red-50 text-red-700 border-red-100' :
                        ticket.priorityColor === 'orange' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                        'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewTicket(ticket);
                        }}
                        className="bg-background-light dark:bg-background-dark px-4 py-2 rounded-xl text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Ticket Detail Modal */}
      <TicketDetailModal
        isOpen={showTicketModal}
        onClose={() => {
          setShowTicketModal(false);
          setSelectedTicket(null);
        }}
        ticket={selectedTicket}
        onUpdate={handleTicketUpdate}
      />

      {/* Archive Modal */}
      <ArchiveModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
      />

      {/* Help Center Docs Modal */}
      <HelpCenterDocsModal
        isOpen={showHelpCenterModal}
        onClose={() => setShowHelpCenterModal(false)}
      />
    </div>
  );
};

export default Support;
