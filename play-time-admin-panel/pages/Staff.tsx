import React, { useState, useMemo, useEffect } from 'react';
import { useStaff, useActiveStaff } from '../hooks/useStaff';
import { useExpenses } from '../hooks/useExpenses';
import { useVenues } from '../hooks/useVenues';
import { staffCollection, expensesCollection } from '../services/firebase';
import { Staff as StaffType, Expense } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import { formatCurrency, getStatusColor } from '../utils/formatUtils';
import { formatDate, getRelativeTime } from '../utils/dateUtils';
import StaffFormModal from '../components/modals/StaffFormModal';
import { serverTimestamp } from 'firebase/firestore';

const Staff: React.FC = () => {
  const { user } = useAuth();
  const { setNewEntryHandler, unsetNewEntryHandler } = useHeaderActions();
  const { staff, loading: staffLoading } = useStaff({ realtime: true });
  const { staff: activeStaff } = useActiveStaff();
  const { expenses, loading: expensesLoading } = useExpenses({ limit: 10, realtime: true });
  const { venues } = useVenues({ realtime: true });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffType | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Expense form state
  const [expenseForm, setExpenseForm] = useState({
    staffId: '',
    title: '',
    category: 'Travel' as Expense['category'],
    amount: 0,
    description: ''
  });
  const [expenseLoading, setExpenseLoading] = useState(false);

  // Calculate statistics
  const stats = useMemo(() => {
    const monthlyPayroll = staff
      .filter(s => s.status === 'Active')
      .reduce((sum, s) => sum + (s.salary || 0), 0);
    
    const activeStaffCount = activeStaff.length;
    const trainersOnDuty = staff.filter(s => 
      s.status === 'Active' && 
      (s.role?.toLowerCase().includes('trainer') || s.role?.toLowerCase().includes('coach'))
    ).length;

    return {
      monthlyPayroll,
      activeStaff: activeStaffCount,
      trainersOnDuty
    };
  }, [staff, activeStaff]);

  // Filter staff by search
  const filteredStaff = useMemo(() => {
    if (!searchQuery) return staff;
    const query = searchQuery.toLowerCase();
    return staff.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.role?.toLowerCase().includes(query) ||
      s.department?.toLowerCase().includes(query) ||
      s.email?.toLowerCase().includes(query)
    );
  }, [staff, searchQuery]);

  const handleCreateStaff = () => {
    setSelectedStaff(null);
    setIsModalOpen(true);
  };

  // Register "New Entry" handler for Header button
  useEffect(() => {
    setNewEntryHandler(handleCreateStaff);
    return () => {
      unsetNewEntryHandler();
    };
  }, [setNewEntryHandler, unsetNewEntryHandler]);

  const handleEditStaff = (staffMember: StaffType) => {
    setSelectedStaff(staffMember);
    setIsModalOpen(true);
  };

  const handleSaveStaff = async (staffData: Partial<StaffType>) => {
    try {
      setProcessing('saving');
      
      if (selectedStaff) {
        // Update existing staff
        await staffCollection.update(selectedStaff.id, {
          ...staffData,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new staff
        await staffCollection.create({
          ...staffData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      setIsModalOpen(false);
      setSelectedStaff(null);
    } catch (error: any) {
      console.error('Error saving staff:', error);
      throw error;
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to delete this staff member? This action cannot be undone.')) {
      return;
    }

    try {
      setProcessing(staffId);
      await staffCollection.delete(staffId);
    } catch (error: any) {
      console.error('Error deleting staff:', error);
      alert('Failed to delete staff: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !expenseForm.staffId || !expenseForm.title || expenseForm.amount <= 0) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setExpenseLoading(true);
      
      const selectedStaffMember = staff.find(s => s.id === expenseForm.staffId);
      const venueId = selectedStaffMember?.venueId || (venues.length > 0 ? venues[0].id : '');

      await expensesCollection.create({
        venueId,
        staffId: expenseForm.staffId,
        staffName: selectedStaffMember?.name || '',
        title: expenseForm.title,
        category: expenseForm.category,
        amount: expenseForm.amount,
        description: expenseForm.description,
        date: serverTimestamp(),
        createdBy: user.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Reset form
      setExpenseForm({
        staffId: '',
        title: '',
        category: 'Travel',
        amount: 0,
        description: ''
      });
    } catch (error: any) {
      console.error('Error logging expense:', error);
      alert('Failed to log expense: ' + error.message);
    } finally {
      setExpenseLoading(false);
    }
  };

  const loading = staffLoading || expensesLoading;

  if (loading && staff.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading staff data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gray-900 dark:text-gray-100">Staff & Trainer Management</h2>
          <p className="text-gray-500 mt-1 font-medium">Manage your team, assign roles, and track payroll.</p>
        </div>
        <button
          onClick={handleCreateStaff}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-content font-black py-3 px-6 rounded-xl transition-all shadow-xl shadow-primary/20"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add New Staff
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            label: "Monthly Payroll",
            val: formatCurrency(stats.monthlyPayroll),
            trend: "+2.5%",
            icon: "payments",
            color: "text-primary",
            bg: "bg-green-50"
          },
          {
            label: "Active Staff",
            val: stats.activeStaff.toString(),
            trend: `+${staff.length - stats.activeStaff} Inactive`,
            icon: "group",
            color: "text-blue-600",
            bg: "bg-blue-50"
          },
          {
            label: "Trainers on Duty",
            val: stats.trainersOnDuty.toString(),
            trend: "0% Change",
            icon: "sports_handball",
            color: "text-orange-600",
            bg: "bg-orange-50"
          }
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className={`p-3 ${s.bg} rounded-xl ${s.color}`}>
                <span className="material-symbols-outlined">{s.icon}</span>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-500">{s.trend}</span>
            </div>
            <div>
              <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{s.label}</p>
              <p className="text-3xl font-black text-gray-900 dark:text-gray-100 mt-1">{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-surface-dark p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
              <input
                className="w-full pl-10 pr-4 py-2.5 bg-background-light border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                placeholder="Search staff..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="px-5 py-2.5 bg-background-light rounded-xl text-xs font-black uppercase tracking-widest text-gray-600 hover:bg-gray-200 transition-colors">Filters</button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {filteredStaff.length === 0 ? (
              <div className="p-12 text-center">
                <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">group</span>
                <p className="text-gray-500 font-medium">No staff members found</p>
                <button
                  onClick={handleCreateStaff}
                  className="mt-4 px-6 py-3 bg-primary text-primary-content rounded-xl text-sm font-black hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all"
                >
                  Add First Staff Member
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left">Staff Member</th>
                    <th className="px-6 py-4 text-left">Role</th>
                    <th className="px-6 py-4 text-left">Status</th>
                    <th className="px-6 py-4 text-right">Salary</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {filteredStaff.map((st) => {
                    const statusColors = getStatusColor(st.status);
                    const venue = venues.find(v => v.id === st.venueId);
                    return (
                      <tr key={st.id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-6 py-5 flex items-center gap-4">
                          <div className="size-10 rounded-full bg-primary/20 text-primary-content flex items-center justify-center font-black">
                            {st.name[0]?.toUpperCase() || 'S'}
                          </div>
                          <div>
                            <p className="font-black text-gray-900 dark:text-gray-100">{st.name}</p>
                            <p className="text-[10px] font-bold text-gray-400 font-mono">#{st.id.substring(0, 8).toUpperCase()}</p>
                            {venue && (
                              <p className="text-[10px] font-bold text-gray-500">{venue.name}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <p className="font-bold text-gray-900 dark:text-gray-100">{st.role}</p>
                          {st.department && (
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{st.department}</p>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                            {st.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right font-black text-gray-900 dark:text-gray-100">{formatCurrency(st.salary)}/mo</td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditStaff(st)}
                              className="px-3 py-1.5 bg-background-light text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteStaff(st.id)}
                              disabled={processing === st.id}
                              className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              {processing === st.id ? '...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Quick Expense Log</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Daily allowances and petty cash</p>
            </div>
            <form onSubmit={handleLogExpense} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Staff Member *</label>
                <select
                  className="w-full rounded-xl border-gray-100 bg-background-light text-sm font-bold text-gray-600 focus:ring-primary focus:border-primary"
                  value={expenseForm.staffId}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, staffId: e.target.value }))}
                  required
                >
                  <option value="">Select staff...</option>
                  {staff.filter(s => s.status === 'Active').map(s => (
                    <option key={s.id} value={s.id}>{s.name} - {s.role}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Expense Title *</label>
                <input
                  className="w-full rounded-xl border-gray-100 bg-background-light py-2 px-4 text-sm font-bold focus:ring-primary focus:border-primary"
                  placeholder="e.g., Travel Allowance"
                  type="text"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount (₹) *</label>
                  <input
                    className="w-full rounded-xl border-gray-100 bg-background-light py-2 px-4 text-sm font-bold focus:ring-primary focus:border-primary"
                    placeholder="0.00"
                    type="number"
                    min="0"
                    step="0.01"
                    value={expenseForm.amount || ''}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Category *</label>
                  <select
                    className="w-full rounded-xl border-gray-100 bg-background-light text-sm font-bold text-gray-600 focus:ring-primary focus:border-primary"
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, category: e.target.value as Expense['category'] }))}
                    required
                  >
                    <option value="Travel">Travel</option>
                    <option value="Meals">Meals</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</label>
                <textarea
                  className="w-full rounded-xl border-gray-100 bg-background-light py-2 px-4 text-sm font-bold focus:ring-primary focus:border-primary"
                  placeholder="Optional description..."
                  rows={2}
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <button
                type="submit"
                disabled={expenseLoading}
                className="w-full py-4 bg-primary text-primary-content font-black rounded-xl hover:shadow-lg transition-all uppercase text-xs tracking-widest disabled:opacity-50"
              >
                {expenseLoading ? 'Logging...' : 'Log Expense'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Recent Logs</h3>
              <a href="#" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View All</a>
            </div>
            <div className="divide-y divide-gray-50">
              {expenses.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">No expenses logged yet</div>
              ) : (
                expenses.map((log) => {
                  const categoryIcons: Record<string, string> = {
                    Travel: 'commute',
                    Meals: 'lunch_dining',
                    Equipment: 'sports',
                    Maintenance: 'build',
                    Utilities: 'bolt',
                    Other: 'receipt'
                  };
                  const categoryColors: Record<string, { text: string; bg: string }> = {
                    Travel: { text: 'text-blue-600', bg: 'bg-blue-50' },
                    Meals: { text: 'text-orange-600', bg: 'bg-orange-50' },
                    Equipment: { text: 'text-green-600', bg: 'bg-green-50' },
                    Maintenance: { text: 'text-red-600', bg: 'bg-red-50' },
                    Utilities: { text: 'text-yellow-600', bg: 'bg-yellow-50' },
                    Other: { text: 'text-gray-600', bg: 'bg-gray-50' }
                  };
                  const colors = categoryColors[log.category] || categoryColors.Other;
                  const date = log.date?.toDate ? log.date.toDate() : new Date(log.date);
                  return (
                    <div key={log.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                      <div className={`size-10 rounded-xl ${colors.bg} ${colors.text} flex items-center justify-center`}>
                        <span className="material-symbols-outlined text-xl">{categoryIcons[log.category] || 'receipt'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{log.title}</p>
                        <p className="text-xs text-gray-500 font-medium">{log.staffName || 'Unknown'} • {getRelativeTime(date)}</p>
                      </div>
                      <span className="text-xs font-black text-gray-400">-{formatCurrency(log.amount)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Staff Form Modal */}
      <StaffFormModal
        staff={selectedStaff}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStaff(null);
        }}
        onSave={handleSaveStaff}
      />
    </div>
  );
};

export default Staff;
