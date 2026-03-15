import React, { useState, useMemo, useEffect } from 'react';
import { useMarketingCampaigns } from '../hooks/useMarketingCampaigns';
import { useVenues } from '../hooks/useVenues';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import { useToast } from '../contexts/ToastContext';
import { marketingCampaignsCollection } from '../services/firebase';
import { MarketingCampaign } from '../types';
import { getRelativeTime } from '../utils/dateUtils';
import { serverTimestamp } from 'firebase/firestore';
import CreateCampaignModal from '../components/modals/CreateCampaignModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const Marketing: React.FC = () => {
  const { setNewEntryHandler, unsetNewEntryHandler } = useHeaderActions();
  const { showSuccess, showError } = useToast();
  const [campaignType, setCampaignType] = useState<'Global' | 'Venue'>('Global');
  const [processing, setProcessing] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);

  const { campaigns, loading } = useMarketingCampaigns({ realtime: true });
  const { venues } = useVenues({ realtime: true });

  // Register "New Entry" handler for Header button
  useEffect(() => {
    setNewEntryHandler(() => {
      setShowCreateModal(true);
    });
    return () => {
      unsetNewEntryHandler();
    };
  }, [setNewEntryHandler, unsetNewEntryHandler]);

  // Filter campaigns by type
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => c.type === campaignType);
  }, [campaigns, campaignType]);

  // Calculate campaign insights
  const insights = useMemo(() => {
    const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const avgClickRate = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const activeCampaigns = campaigns.filter(c => c.status === 'Live').length;

    // Calculate trends (compare with previous period - simplified for now)
    // In a real app, you'd compare with historical data
    const previousPeriodClicks = 0; // Would be fetched from historical data
    const previousPeriodImpressions = 0; // Would be fetched from historical data
    const previousAvgClickRate = previousPeriodImpressions > 0 
      ? (previousPeriodClicks / previousPeriodImpressions) * 100 
      : 0;
    
    const clickRateTrend = previousAvgClickRate > 0 
      ? ((avgClickRate - previousAvgClickRate) / previousAvgClickRate) * 100 
      : 0;
    const reachTrend = previousPeriodImpressions > 0
      ? ((totalImpressions - previousPeriodImpressions) / previousPeriodImpressions) * 100
      : 0;

    return {
      totalReach: totalImpressions,
      avgClickRate: avgClickRate.toFixed(1),
      activeCampaigns,
      clickRateTrend: clickRateTrend.toFixed(1),
      reachTrend: reachTrend.toFixed(1)
    };
  }, [campaigns]);

  const handleToggleCampaign = async (campaignId: string, currentStatus: MarketingCampaign['status']) => {
    try {
      setProcessing(campaignId);
      const newStatus = currentStatus === 'Live' ? 'Paused' : 'Live';
      await marketingCampaignsCollection.update(campaignId, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error toggling campaign:', error);
      showError('Failed to update campaign: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteCampaign = (campaignId: string) => {
    setDeletingCampaignId(campaignId);
  };

  const _doDeleteCampaign = async (campaignId: string) => {
    try {
      setProcessing(campaignId);
      await marketingCampaignsCollection.delete(campaignId);
      showSuccess('Campaign deleted successfully.');
    } catch (error: any) {
      console.error('Error deleting campaign:', error);
      showError('Failed to delete campaign: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleCreateCampaign = async (campaignData: Omit<MarketingCampaign, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingCampaign) {
      // Update existing campaign
      await marketingCampaignsCollection.update(editingCampaign.id, {
        ...campaignData,
        updatedAt: serverTimestamp()
      });
      setEditingCampaign(null);
    } else {
      // Create new campaign
      await marketingCampaignsCollection.create({
        ...campaignData,
        clicks: 0,
        impressions: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  };

  const handleEditCampaign = (campaign: MarketingCampaign) => {
    setEditingCampaign(campaign);
    setShowCreateModal(true);
  };

  const handleDownloadMetrics = () => {
    const csvRows = [
      ['Campaign Title', 'Type', 'Status', 'Clicks', 'Impressions', 'Click Rate', 'Start Date', 'End Date', 'Created At'].join(','),
      ...campaigns.map(c => {
        const clickRate = c.impressions && c.impressions > 0 
          ? ((c.clicks || 0) / c.impressions * 100).toFixed(2) 
          : '0.00';
        const startDate = c.startDate?.toDate ? c.startDate.toDate().toISOString().split('T')[0] : '';
        const endDate = c.endDate?.toDate ? c.endDate.toDate().toISOString().split('T')[0] : '';
        const createdAt = c.createdAt?.toDate ? c.createdAt.toDate().toISOString().split('T')[0] : '';
        
        return [
          c.title,
          c.type,
          c.status,
          c.clicks || 0,
          c.impressions || 0,
          clickRate + '%',
          startDate,
          endDate,
          createdAt
        ].join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `marketing-metrics-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && campaigns.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading marketing campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 bg-background-light min-h-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Marketing & Offers</h2>
          <p className="text-gray-500 mt-1">Manage in-app banners, global offers, and venue announcements.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-primary text-primary-content px-6 py-3 rounded-xl font-black text-sm hover:shadow-lg transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined">add_photo_alternate</span>
          Create New Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-surface-dark rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight">Active Banners</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setCampaignType('Global')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                    campaignType === 'Global'
                      ? 'bg-primary text-primary-content'
                      : 'bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Global
                </button>
                <button
                  onClick={() => setCampaignType('Venue')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                    campaignType === 'Venue'
                      ? 'bg-primary text-primary-content'
                      : 'bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Venue Specific
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {filteredCampaigns.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">campaign</span>
                  <p className="text-sm font-medium">No {campaignType.toLowerCase()} campaigns found</p>
                </div>
              ) : (
                filteredCampaigns.map((campaign) => {
                  const venue = venues.find(v => v.id === campaign.venueId);
                  const imageUrl = campaign.imageUrl || '';
                  const createdAt = campaign.createdAt?.toDate ? campaign.createdAt.toDate() : new Date(campaign.createdAt);

                  return (
                    <div key={campaign.id} className="p-6 flex items-center gap-6 hover:bg-gray-50 transition-colors">
                      {imageUrl ? (
                        <div 
                          className="size-20 rounded-2xl bg-gray-200 dark:bg-gray-700 bg-cover bg-center shrink-0 border border-gray-100 dark:border-gray-700" 
                          style={{ backgroundImage: `url(${imageUrl})` }}
                        ></div>
                      ) : (
                        <div className="size-20 rounded-2xl bg-gray-200 dark:bg-gray-700 shrink-0 border border-gray-100 dark:border-gray-700 flex items-center justify-center">
                          <span className="material-symbols-outlined text-gray-400">image</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                            campaign.type === 'Global' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {campaign.type}
                          </span>
                          <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 truncate">{campaign.title}</h4>
                        </div>
                        <p className="text-xs text-gray-400 font-medium">Placement: {campaign.target}</p>
                        {venue && (
                          <p className="text-xs text-gray-400 font-medium">Venue: {venue.name}</p>
                        )}
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-widest">
                            <span className="material-symbols-outlined text-sm">ads_click</span> 
                            {campaign.clicks || 0} Clicks
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            campaign.status === 'Live' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                          }`}>
                            <span className={`size-1.5 rounded-full ${campaign.status === 'Live' ? 'bg-green-600 animate-pulse' : 'bg-gray-400'}`}></span> 
                            {campaign.status}
                          </span>
                          <span className="text-[9px] text-gray-400">{getRelativeTime(createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          className="p-2 text-gray-400 hover:text-gray-900"
                          onClick={() => handleEditCampaign(campaign)}
                          disabled={processing === campaign.id}
                        >
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                        <button
                          onClick={() => handleToggleCampaign(campaign.id, campaign.status)}
                          disabled={processing === campaign.id}
                          className={`p-2 rounded-lg text-xs font-bold transition-all ${
                            campaign.status === 'Live'
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title={campaign.status === 'Live' ? 'Pause Campaign' : 'Activate Campaign'}
                        >
                          {campaign.status === 'Live' ? 'Pause' : 'Activate'}
                        </button>
                        <button 
                          className="p-2 text-gray-400 hover:text-red-500"
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          disabled={processing === campaign.id}
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-sidebar-dark rounded-3xl p-8 text-white space-y-6 shadow-2xl">
            <h3 className="text-xl font-black uppercase tracking-tight">Campaign Insights</h3>
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total reach</p>
                <p className="text-2xl font-black mt-1">
                  {insights.totalReach.toLocaleString()} 
                  {parseFloat(insights.reachTrend) !== 0 && (
                    <span className={`text-xs ml-1 font-bold ${parseFloat(insights.reachTrend) > 0 ? 'text-primary' : 'text-red-500'}`}>
                      {parseFloat(insights.reachTrend) > 0 ? '+' : ''}{insights.reachTrend}%
                    </span>
                  )}
                </p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Avg. Click rate</p>
                <p className="text-2xl font-black mt-1">
                  {insights.avgClickRate}% 
                  {parseFloat(insights.clickRateTrend) !== 0 && (
                    <span className={`text-xs ml-1 font-bold ${parseFloat(insights.clickRateTrend) > 0 ? 'text-primary' : 'text-red-500'}`}>
                      {parseFloat(insights.clickRateTrend) > 0 ? '+' : ''}{insights.clickRateTrend}%
                    </span>
                  )}
                </p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Active campaigns</p>
                <p className="text-2xl font-black mt-1">{insights.activeCampaigns}</p>
              </div>
            </div>
            <button 
              onClick={handleDownloadMetrics}
              className="w-full py-4 bg-white text-sidebar-dark rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-gray-100 transition-all"
            >
              Download Metrics
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
            <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Marketing Tips</h4>
            <p className="text-xs text-gray-500 leading-relaxed font-medium">
              Banners with real player photos perform 35% better. Ensure your "Summer Cup" announcements are live at least 2 weeks before registration ends.
            </p>
          </div>
        </div>
      </div>

      {/* Create/Edit Campaign Modal */}
      <CreateCampaignModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingCampaign(null);
        }}
        onCreate={handleCreateCampaign}
        editingCampaign={editingCampaign}
      />

      {/* Delete Campaign Confirm */}
      <ConfirmDialog
        isOpen={!!deletingCampaignId}
        title="Delete Campaign"
        message="Are you sure you want to delete this campaign? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={!!processing}
        onConfirm={async () => {
          if (deletingCampaignId) {
            await _doDeleteCampaign(deletingCampaignId);
            setDeletingCampaignId(null);
          }
        }}
        onCancel={() => setDeletingCampaignId(null)}
      />
    </div>
  );
};

export default Marketing;
