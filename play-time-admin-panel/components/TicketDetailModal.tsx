import React, { useState, useEffect } from 'react';
import { SupportTicket } from '../types';
import { useUsers } from '../hooks/useUsers';
import { useAuth } from '../contexts/AuthContext';
import { supportTicketsCollection } from '../services/firebase';
import { getRelativeTime, formatDate } from '../utils/dateUtils';
import { serverTimestamp } from 'firebase/firestore';

interface TicketDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: SupportTicket | null;
  onUpdate: () => void;
}

const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  isOpen,
  onClose,
  ticket,
  onUpdate
}) => {
  const { user } = useAuth();
  const { users } = useUsers({ limit: 100 });
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<SupportTicket['status']>('Open');
  const [priority, setPriority] = useState<SupportTicket['priority']>('Low');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ticket) {
      setStatus(ticket.status);
      setPriority(ticket.priority);
      setAssignedTo(ticket.assignedTo || '');
      setResponse('');
      setError(null);
    }
  }, [ticket]);

  if (!isOpen || !ticket) return null;

  const ticketUser = users.find(u => u.id === ticket.userId);
  const assignedUser = assignedTo ? users.find(u => u.id === assignedTo) : null;
  const createdAt = ticket.createdAt 
    ? (ticket.createdAt.toDate ? ticket.createdAt.toDate() : new Date(ticket.createdAt))
    : new Date();
  const resolvedAt = ticket.resolvedAt 
    ? (ticket.resolvedAt.toDate ? ticket.resolvedAt.toDate() : new Date(ticket.resolvedAt))
    : null;

  const handleAddResponse = async () => {
    if (!response.trim() || !user) return;

    setLoading(true);
    setError(null);

    try {
      const currentResponses = ticket.responses || [];
      const newResponse = {
        userId: user.id,
        userName: user.name,
        message: response.trim(),
        createdAt: serverTimestamp()
      };

      await supportTicketsCollection.update(ticket.id, {
        responses: [...currentResponses, newResponse],
        updatedAt: serverTimestamp()
      });

      setResponse('');
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to add response');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const updateData: any = {
        status,
        priority,
        updatedAt: serverTimestamp()
      };

      if (assignedTo) {
        updateData.assignedTo = assignedTo;
      } else {
        updateData.assignedTo = null;
      }

      if (status === 'Resolved' || status === 'Closed') {
        updateData.resolvedAt = serverTimestamp();
      }

      await supportTicketsCollection.update(ticket.id, updateData);
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to update ticket');
    } finally {
      setLoading(false);
    }
  };

  const priorityColors = {
    Low: 'bg-blue-50 text-blue-700 border-blue-100',
    Medium: 'bg-orange-50 text-orange-700 border-orange-100',
    High: 'bg-red-50 text-red-700 border-red-100',
    Critical: 'bg-red-100 text-red-800 border-red-200'
  };

  const statusColors = {
    Open: 'bg-blue-50 text-blue-700 border-blue-100',
    'In Progress': 'bg-amber-50 text-amber-700 border-amber-100',
    Resolved: 'bg-green-50 text-green-700 border-green-100',
    Closed: 'bg-gray-50 text-gray-700 border-gray-100'
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-2xl font-black text-gray-900">
              {ticket.ticketNumber || `#${ticket.id.substring(0, 8).toUpperCase()}`}
            </h3>
            <p className="text-sm text-gray-500 mt-1">{ticket.subject}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Ticket Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SupportTicket['status'])}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as SupportTicket['priority'])}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Assign To
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Unassigned</option>
                {users.filter(u => u.role === 'Super Admin' || u.role === 'Admin').map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Type
              </label>
              <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700">
                {ticket.type}
              </div>
            </div>
          </div>

          <button
            onClick={handleUpdateStatus}
            disabled={loading}
            className="w-full py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Status & Priority'}
          </button>

          {/* User Info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">User Information</p>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black">
                {(ticketUser?.name || ticket.userName || 'U')[0].toUpperCase()}
              </div>
              <div>
                <p className="font-black text-gray-900">{ticketUser?.name || ticket.userName || 'Unknown User'}</p>
                <p className="text-xs text-gray-500">{ticket.userEmail || ticketUser?.email || 'No email'}</p>
              </div>
            </div>
          </div>

          {/* Ticket Details */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Description</p>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap">
              {ticket.description}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Timeline</p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="size-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-blue-600 text-sm">add</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-gray-900">Ticket Created</p>
                  <p className="text-xs text-gray-500">{formatDate(createdAt)} ({getRelativeTime(createdAt)})</p>
                </div>
              </div>
              {ticket.responses && ticket.responses.map((response, index) => {
                const responseUser = users.find(u => u.id === response.userId);
                const responseDate = response.createdAt?.toDate ? response.createdAt.toDate() : new Date(response.createdAt);
                return (
                  <div key={index} className="flex gap-3">
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary text-xs font-black">
                        {(responseUser?.name || response.userName || 'A')[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-black text-gray-900">
                        {responseUser?.name || response.userName || 'Admin'}
                      </p>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{response.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{getRelativeTime(responseDate)}</p>
                    </div>
                  </div>
                );
              })}
              {resolvedAt && (
                <div className="flex gap-3">
                  <div className="size-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-green-600 text-sm">check_circle</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-gray-900">Ticket Resolved</p>
                    <p className="text-xs text-gray-500">{formatDate(resolvedAt)} ({getRelativeTime(resolvedAt)})</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Add Response */}
          {status !== 'Resolved' && status !== 'Closed' && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Add Response</p>
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Type your response..."
                rows={4}
              />
              <button
                onClick={handleAddResponse}
                disabled={loading || !response.trim()}
                className="mt-3 w-full py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Response'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketDetailModal;

