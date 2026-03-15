import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMembershipPlans } from '../hooks/useMembershipPlans';
import { useMemberships } from '../hooks/useMemberships';
import { useUsers } from '../hooks/useUsers';
import { useVenues } from '../hooks/useVenues';
import { useToast } from '../contexts/ToastContext';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import { membershipPlansCollection, membershipsCollection } from '../services/firebase';
import { MembershipPlan, Membership } from '../types';
import { formatCurrency, getStatusColor } from '../utils/formatUtils';
import { formatDate } from '../utils/dateUtils';
import { exportMembershipsToCSV, exportMembersToPDF } from '../utils/exportUtils';
import MembershipPlanFormModal from '../components/modals/MembershipPlanFormModal';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { sendNotificationToAudience } from '../services/notificationService';

const Memberships: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const { setNewEntryHandler, unsetNewEntryHandler } = useHeaderActions();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [planFilter, setPlanFilter] = useState<string>('All');
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Fetch data
  const { plans, loading: plansLoading } = useMembershipPlans({ realtime: true });
  const { memberships, loading: membershipsLoading } = useMemberships({ realtime: true });
  const { users, loading: usersLoading } = useUsers({ searchTerm, limit: 100 });
  const { venues } = useVenues();
  const navigate = useNavigate();
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-container') && !target.closest('.export-dropdown')) {
        setOpenDropdownId(null);
        setShowExportDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Filter memberships
  // Filter memberships and group by user+venue to show only the current status
  const filteredMemberships = useMemo(() => {
    // 1. Group memberships to show only the latest record for each member per venue
    const membershipGroups = new Map<string, Membership>();

    memberships.forEach(membership => {
      const key = `${membership.userId}_${membership.venueId}`;
      const existing = membershipGroups.get(key);

      if (!existing) {
        membershipGroups.set(key, membership);
      } else {
        const existingDate = existing.createdAt?.toDate ? existing.createdAt.toDate() : new Date(existing.createdAt || 0);
        const currentDate = membership.createdAt?.toDate ? membership.createdAt.toDate() : new Date(membership.createdAt || 0);

        if (currentDate > existingDate) {
          membershipGroups.set(key, membership);
        }
      }
    });

    // 2. Apply filters to the unique list
    let filtered = Array.from(membershipGroups.values());

    if (statusFilter !== 'All') {
      filtered = filtered.filter(m => m.status === statusFilter);
    }

    if (planFilter !== 'All') {
      filtered = filtered.filter(m => m.planName === planFilter);
    }

    return filtered;
  }, [memberships, statusFilter, planFilter]);

  // Get unique plan names for filter
  const planNames = useMemo(() => {
    return Array.from(new Set(memberships.map(m => m.planName))).sort();
  }, [memberships]);

  // Get member details with user info
  const memberDetails = useMemo(() => {
    return filteredMemberships.map(membership => {
      const user = users.find(u => u.id === membership.userId);
      const venue = venues.find(v => v.id === membership.venueId);
      const plan = plans.find(p => p.id === membership.planId);

      return {
        ...membership,
        userName: user?.name || 'Unknown User',
        userEmail: user?.email || '',
        userAvatar: user?.avatar,
        venueName: venue?.name || 'Unknown Venue',
        planDetails: plan
      };
    });
  }, [filteredMemberships, users, venues, plans]);

  // Handle plan operations
  const handleCreatePlan = () => {
    setSelectedPlan(null);
    setIsPlanModalOpen(true);
  };

  // Register "New Entry" handler for Header button
  useEffect(() => {
    setNewEntryHandler(handleCreatePlan);
    return () => {
      unsetNewEntryHandler();
    };
  }, [setNewEntryHandler, unsetNewEntryHandler]);

  const handleEditPlan = (plan: MembershipPlan) => {
    setSelectedPlan(plan);
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = async (planData: Partial<MembershipPlan>) => {
    try {
      setProcessing('saving');

      if (selectedPlan) {
        await membershipPlansCollection.update(selectedPlan.id, {
          ...planData,
          updatedAt: serverTimestamp()
        });
      } else {
        await membershipPlansCollection.create({
          ...planData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      setIsPlanModalOpen(false);
      setSelectedPlan(null);
    } catch (error: any) {
      console.error('Error saving membership plan:', error);
      throw error;
    } finally {
      setProcessing(null);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan? This will affect all associated memberships.')) {
      return;
    }

    try {
      setProcessing(planId);
      await membershipPlansCollection.delete(planId);
    } catch (error: any) {
      console.error('Error deleting plan:', error);
      alert('Failed to delete plan: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  // Handle membership operations
  const handleActivateMembership = async (membershipId: string) => {
    try {
      setProcessing(membershipId);
      const membership = memberships.find(m => m.id === membershipId);
      if (!membership) return;

      const now = Timestamp.now();

      // Calculate end date based on plan type
      const endDate = new Date();
      if (membership.planType === 'Monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (membership.planType === '6 Months') {
        endDate.setMonth(endDate.getMonth() + 6);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      await membershipsCollection.update(membershipId, {
        status: 'Active',
        startDate: now,
        endDate: Timestamp.fromDate(endDate),
        updatedAt: serverTimestamp()
      });

      // Send push notification to user
      try {
        await sendNotificationToAudience({
          id: `membership_activated_${membershipId}_${Date.now()}`,
          title: 'Membership Activated! 🎉',
          body: `Your ${membership.planName} membership at ${membership.venueName} is now active. Enjoy your perks!`,
          type: 'Membership',
          targetAudience: 'Specific Users',
          targetUserIds: [membership.userId],
          status: 'Sent',
          createdBy: currentUser?.id || 'system',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (notifError) {
        console.error('Error sending membership activation notification:', notifError);
        // Don't show error to user as membership was still activated successfully
      }

      showSuccess('Membership activated successfully');
    } catch (error: any) {
      console.error('Error activating membership:', error);
      showError('Failed to activate membership: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleCancelMembership = async (membershipId: string) => {
    if (!confirm('Are you sure you want to cancel this membership?')) {
      return;
    }

    try {
      setProcessing(membershipId);
      await membershipsCollection.update(membershipId, {
        status: 'Cancelled',
        updatedAt: serverTimestamp()
      });
      showSuccess('Membership cancelled successfully');
    } catch (error: any) {
      console.error('Error cancelling membership:', error);
      showError('Failed to cancel membership: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteMembership = async (membershipId: string) => {
    if (!confirm('Are you sure you want to delete this membership record? This action cannot be undone.')) {
      return;
    }

    try {
      setProcessing(membershipId);
      await membershipsCollection.delete(membershipId);
      showSuccess('Membership record deleted successfully');
    } catch (error: any) {
      console.error('Error deleting membership:', error);
      showError('Failed to delete membership: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleExtendMembership = async (membershipId: string, extensionMonths: number) => {
    try {
      setProcessing(membershipId);
      const membership = memberships.find(m => m.id === membershipId);
      if (!membership) return;

      const currentEndDate = membership.endDate?.toDate ? membership.endDate.toDate() : new Date(membership.endDate);
      const newEndDate = new Date(currentEndDate);
      newEndDate.setMonth(newEndDate.getMonth() + extensionMonths);

      await membershipsCollection.update(membershipId, {
        endDate: Timestamp.fromDate(newEndDate),
        updatedAt: serverTimestamp()
      });
      showSuccess(`Membership extended by ${extensionMonths} month(s)`);
    } catch (error: any) {
      console.error('Error extending membership:', error);
      showError('Failed to extend membership: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const loading = plansLoading || membershipsLoading || usersLoading;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading memberships...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 bg-slate-50 dark:bg-slate-900 min-h-full">
      {/* Header */}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Memberships</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-3 font-medium">Manage membership plans and member subscriptions.</p>
        </div>
        <button
          onClick={handleCreatePlan}
          className="flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 px-6 py-3 text-white text-sm font-black shadow-lg shadow-primary/20 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]">add_card</span>
          Add Plan
        </button>
      </div>

      {/* Membership Plans */}
      {/* Membership Plans */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-6 w-1 rounded-full bg-primary"></div>
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Membership Plans</h2>
        </div>
        {plans.length === 0 ? (
          <div className="ui-card p-16 text-center border-dashed">
            <div className="size-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6 text-slate-300">
              <span className="material-symbols-outlined text-4xl">card_membership</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">No Plans Found</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto font-medium">Create your first membership plan to get started.</p>
            <button
              onClick={handleCreatePlan}
              className="px-8 py-3.5 bg-primary text-white rounded-xl text-sm font-black hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all"
            >
              Add First Plan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {plans.map((plan) => {
              const planMemberships = memberships.filter(m => m.planId === plan.id);
              const activeCount = planMemberships.filter(m => m.status === 'Active').length;

              return (
                <div
                  key={plan.id}
                  className={`ui-card group p-8 relative overflow-hidden flex flex-col ${!plan.isActive ? 'opacity-50 grayscale' : ''}`}
                >
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight group-hover:text-primary transition-colors">{plan.name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">{plan.type} Plan</span>
                        <div className="size-1 rounded-full bg-slate-200"></div>
                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.1em]">{activeCount} SEATS TAKEN</span>
                      </div>
                    </div>
                    {plan.isActive ? (
                      <span className="size-3 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"></span>
                    ) : (
                      <span className="text-[9px] font-black bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-1 rounded-md uppercase tracking-widest">Off-Line</span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1 mb-8">
                    <span className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white">
                      {formatCurrency(plan.price)}
                    </span>
                    <span className="text-sm font-bold text-slate-400 lowercase">
                      /{plan.type.replace('ly', '').replace(' Months', 'm').replace('Yearly', 'yr')}
                    </span>
                  </div>

                  <div className="space-y-4 mb-10 flex-1">
                    {plan.features?.map((f, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400 leading-tight">{f}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => handleEditPlan(plan)}
                      className="flex-1 h-12 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      className="size-12 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-all"
                    >
                      <span className="material-symbols-outlined text-xl">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Member Directory */}
      <div className="space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-primary"></div>
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Members</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                search
              </span>
              <input
                className="w-full sm:w-64 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-transparent text-slate-900 dark:text-white py-2 pl-10 text-xs font-bold focus:bg-white focus:border-primary transition-all outline-none"
                placeholder="Search members..."
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-white transition-all shadow-sm"
            >
              <option value="All">Status: All</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Expired">Expired</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="h-10 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-white transition-all shadow-sm"
            >
              <option value="All">Plans: All</option>
              {planNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

            <div className="relative export-dropdown">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className={`size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border ${showExportDropdown ? 'border-primary text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-400'} hover:text-primary transition-all shadow-sm`}
              >
                <span className="material-symbols-outlined">download</span>
              </button>
              {showExportDropdown && (
                <div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 z-30 min-w-[160px] p-1">
                  <button
                    onClick={() => {
                      exportMembershipsToCSV(filteredMemberships, users, venues);
                      setShowExportDropdown(false);
                    }}
                    className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">database</span>
                    CSV Export
                  </button>
                  <button
                    onClick={() => {
                      exportMembersToPDF(filteredMemberships, users, venues, 'Members Report');
                      setShowExportDropdown(false);
                    }}
                    className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                    PDF Report
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ui-card">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="px-6 py-5">Member</th>
                <th className="px-6 py-5">Plan</th>
                <th className="px-6 py-5">Venue</th>
                <th className="px-6 py-5">Joined</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {memberDetails.length > 0 ? (
                memberDetails.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer group" onClick={() => navigate(`/users/${member.userId}`)}>
                    <td className="px-6 py-4 flex items-center gap-4">
                      <div className="size-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 group-hover:scale-110 transition-transform">
                        {member.userAvatar ? (
                          <img src={member.userAvatar} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <span className="text-sm font-black text-primary">{member.userName.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <span className="font-black text-slate-900 dark:text-white block leading-none">{member.userName}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{member.userEmail}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[10px] font-black uppercase tracking-widest">{member.planName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{member.venueName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-500">{member.createdAt ? formatDate(member.createdAt) : 'SYSTEM'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${member.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        member.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                        }`}>
                        <span className={`size-1.5 rounded-full ${member.status === 'Active' ? 'bg-emerald-500' :
                          member.status === 'Pending' ? 'bg-amber-500' : 'bg-slate-400'
                          }`}></span>
                        {member.status}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {member.status === 'Pending' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActivateMembership(member.id);
                            }}
                            disabled={processing === member.id}
                            className="h-8 px-4 bg-primary text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-md shadow-primary/10"
                          >
                            Activate
                          </button>
                        )}
                        <div className="relative dropdown-container">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === member.id ? null : member.id);
                            }}
                            className={`size-8 flex items-center justify-center ${openDropdownId === member.id ? 'text-primary bg-primary/5' : 'text-slate-400'} hover:text-slate-900 dark:hover:text-white rounded-lg transition-all`}
                          >
                            <span className="material-symbols-outlined">settings</span>
                          </button>
                          {openDropdownId === member.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-40 min-w-[200px] p-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                            >
                              <button
                                onClick={() => navigate(`/users/${member.userId}`)}
                                className="w-full px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 transition-colors"
                              >
                                <span className="material-symbols-outlined text-lg">account_circle</span>
                                View Profile
                              </button>
                              {member.status === 'Active' && (
                                <>
                                  <button
                                    onClick={() => handleExtendMembership(member.id, 1)}
                                    className="w-full px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2"
                                  >
                                    <span className="material-symbols-outlined text-lg">history_edu</span>
                                    Extend 1 Month
                                  </button>
                                  <button
                                    onClick={() => handleCancelMembership(member.id)}
                                    className="w-full px-4 py-3 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 rounded-lg flex items-center gap-2"
                                  >
                                    <span className="material-symbols-outlined text-lg">cancel</span>
                                    Cancel Membership
                                  </button>
                                </>
                              )}
                              <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                              <button
                                onClick={() => handleDeleteMembership(member.id)}
                                className="w-full px-4 py-3 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-100 rounded-lg flex items-center gap-2"
                              >
                                <span className="material-symbols-outlined text-lg">delete</span>
                                Delete Record
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="size-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-300">
                      <span className="material-symbols-outlined text-4xl">folder_off</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No members found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Membership Plan Form Modal */}
      <MembershipPlanFormModal
        plan={selectedPlan}
        isOpen={isPlanModalOpen}
        onClose={() => {
          setIsPlanModalOpen(false);
          setSelectedPlan(null);
        }}
        onSave={handleSavePlan}
      />
    </div>
  );
};

export default Memberships;
