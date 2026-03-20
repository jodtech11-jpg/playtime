import React, { useState, useEffect } from 'react';
import { useLandingPage } from '../../hooks/useLandingPage';
import { LandingPageContent } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

interface LandingPageManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LandingPageManagementModal: React.FC<LandingPageManagementModalProps> = ({ isOpen, onClose }) => {
  const { content, loading, updateContent } = useLandingPage(false);
  const { showSuccess, showError } = useToast();
  const { isSuperAdmin } = useAuth();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<LandingPageContent>>({});

  useEffect(() => {
    if (content && isOpen) {
      setFormData(content);
    }
  }, [content, isOpen]);

  if (!isOpen) return null;

  if (!isSuperAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-4 sm:p-8">
          <div className="text-center">
            <span className="material-symbols-outlined text-6xl text-red-500 mb-4">block</span>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-600 mb-6">Only super admins can manage landing page content.</p>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-primary text-white rounded-xl font-black uppercase tracking-widest"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateContent(formData);
      showSuccess('Landing page content updated successfully!');
      onClose();
    } catch (error: any) {
      console.error('Error saving landing page content:', error);
      showError('Failed to save: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const addStat = () => {
    const stats = formData.stats || [];
    setFormData({
      ...formData,
      stats: [...stats, { value: '', label: '' }]
    });
  };

  const removeStat = (index: number) => {
    const stats = formData.stats || [];
    setFormData({
      ...formData,
      stats: stats.filter((_, i) => i !== index)
    });
  };

  const updateStat = (index: number, field: 'value' | 'label', value: string) => {
    const stats = formData.stats || [];
    setFormData({
      ...formData,
      stats: stats.map((stat, i) => i === index ? { ...stat, [field]: value } : stat)
    });
  };

  const addFeature = () => {
    const features = formData.features || [];
    setFormData({
      ...formData,
      features: [...features, { icon: '', title: '', description: '', order: features.length + 1 }]
    });
  };

  const removeFeature = (index: number) => {
    const features = formData.features || [];
    setFormData({
      ...formData,
      features: features.filter((_, i) => i !== index)
    });
  };

  const updateFeature = (index: number, field: 'icon' | 'title' | 'description' | 'order', value: string | number) => {
    const features = formData.features || [];
    setFormData({
      ...formData,
      features: features.map((feature, i) => i === index ? { ...feature, [field]: value } : feature)
    });
  };

  const addFooterLink = () => {
    const links = formData.footerLinks || [];
    setFormData({
      ...formData,
      footerLinks: [...links, { label: '', url: '#' }]
    });
  };

  const removeFooterLink = (index: number) => {
    const links = formData.footerLinks || [];
    setFormData({
      ...formData,
      footerLinks: links.filter((_, i) => i !== index)
    });
  };

  const updateFooterLink = (index: number, field: 'label' | 'url', value: string) => {
    const links = formData.footerLinks || [];
    setFormData({
      ...formData,
      footerLinks: links.map((link, i) => i === index ? { ...link, [field]: value } : link)
    });
  };

  const addBenefit = () => {
    const benefits = formData.benefits || [];
    setFormData({
      ...formData,
      benefits: [...benefits, { icon: '', title: '', description: '', order: benefits.length + 1 }]
    });
  };

  const removeBenefit = (index: number) => {
    const benefits = formData.benefits || [];
    setFormData({
      ...formData,
      benefits: benefits.filter((_, i) => i !== index)
    });
  };

  const updateBenefit = (index: number, field: 'icon' | 'title' | 'description' | 'order', value: string | number) => {
    const benefits = formData.benefits || [];
    setFormData({
      ...formData,
      benefits: benefits.map((benefit, i) => i === index ? { ...benefit, [field]: value } : benefit)
    });
  };

  const addTestimonial = () => {
    const testimonials = formData.testimonials || [];
    setFormData({
      ...formData,
      testimonials: [...testimonials, { name: '', role: '', venue: '', content: '', rating: 5 }]
    });
  };

  const removeTestimonial = (index: number) => {
    const testimonials = formData.testimonials || [];
    setFormData({
      ...formData,
      testimonials: testimonials.filter((_, i) => i !== index)
    });
  };

  const updateTestimonial = (index: number, field: 'name' | 'role' | 'venue' | 'content' | 'rating', value: string | number) => {
    const testimonials = formData.testimonials || [];
    setFormData({
      ...formData,
      testimonials: testimonials.map((testimonial, i) => i === index ? { ...testimonial, [field]: value } : testimonial)
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl p-4 sm:p-8">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-gray-600 font-medium">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto my-8">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between z-10">
          <div>
            <h3 className="text-2xl font-black text-gray-900">Landing Page Management</h3>
            <p className="text-sm text-gray-500 mt-1">Edit landing page content and features</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-gray-400">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-8 space-y-8">
          {/* Hero Section */}
          <section className="space-y-4">
            <h4 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">home</span> Hero Section
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hero Title</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  value={formData.heroTitle || ''}
                  onChange={(e) => setFormData({ ...formData, heroTitle: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hero Subtitle</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  value={formData.heroSubtitle || ''}
                  onChange={(e) => setFormData({ ...formData, heroSubtitle: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hero Description</label>
                <textarea
                  className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary resize-none"
                  rows={3}
                  value={formData.heroDescription || ''}
                  onChange={(e) => setFormData({ ...formData, heroDescription: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Primary Button Text</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  value={formData.heroPrimaryButtonText || ''}
                  onChange={(e) => setFormData({ ...formData, heroPrimaryButtonText: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Secondary Button Text</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  value={formData.heroSecondaryButtonText || ''}
                  onChange={(e) => setFormData({ ...formData, heroSecondaryButtonText: e.target.value })}
                />
              </div>
            </div>
          </section>

          {/* Stats Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">bar_chart</span> Stats Section
              </h4>
              <button
                onClick={addStat}
                className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-primary-hover"
              >
                Add Stat
              </button>
            </div>
            <div className="space-y-3">
              {(formData.stats || []).map((stat, index) => (
                <div key={index} className="flex gap-3 items-center p-4 bg-gray-50 rounded-xl">
                  <input
                    className="flex-1 px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary"
                    placeholder="Value (e.g., 100+)"
                    value={stat.value}
                    onChange={(e) => updateStat(index, 'value', e.target.value)}
                  />
                  <input
                    className="flex-1 px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary"
                    placeholder="Label (e.g., Active Venues)"
                    value={stat.label}
                    onChange={(e) => updateStat(index, 'label', e.target.value)}
                  />
                  <button
                    onClick={() => removeStat(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Features Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">star</span> Features Section
              </h4>
              <button
                onClick={addFeature}
                className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-primary-hover"
              >
                Add Feature
              </button>
            </div>
            <div className="space-y-2">
              <input
                className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                placeholder="Features Title"
                value={formData.featuresTitle || ''}
                onChange={(e) => setFormData({ ...formData, featuresTitle: e.target.value })}
              />
              <input
                className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                placeholder="Features Description"
                value={formData.featuresDescription || ''}
                onChange={(e) => setFormData({ ...formData, featuresDescription: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              {(formData.features || []).map((feature, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-xl space-y-3">
                  <div className="flex gap-3">
                    <input
                      className="w-32 px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary"
                      placeholder="Icon name"
                      value={feature.icon}
                      onChange={(e) => updateFeature(index, 'icon', e.target.value)}
                    />
                    <input
                      className="flex-1 px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary"
                      placeholder="Feature Title"
                      value={feature.title}
                      onChange={(e) => updateFeature(index, 'title', e.target.value)}
                    />
                    <input
                      className="w-24 px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary"
                      type="number"
                      placeholder="Order"
                      value={feature.order}
                      onChange={(e) => updateFeature(index, 'order', parseInt(e.target.value) || 0)}
                    />
                    <button
                      onClick={() => removeFeature(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                  <textarea
                    className="w-full px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary resize-none"
                    rows={2}
                    placeholder="Feature Description"
                    value={feature.description}
                    onChange={(e) => updateFeature(index, 'description', e.target.value)}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* CTA Section */}
          <section className="space-y-4">
            <h4 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">campaign</span> CTA Section
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">CTA Title</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  value={formData.ctaTitle || ''}
                  onChange={(e) => setFormData({ ...formData, ctaTitle: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">CTA Button Text</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  value={formData.ctaButtonText || ''}
                  onChange={(e) => setFormData({ ...formData, ctaButtonText: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">CTA Description</label>
                <textarea
                  className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary resize-none"
                  rows={2}
                  value={formData.ctaDescription || ''}
                  onChange={(e) => setFormData({ ...formData, ctaDescription: e.target.value })}
                />
              </div>
            </div>
          </section>

          {/* How It Works Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">list</span> How It Works Section
              </h4>
            </div>
            <div className="space-y-2">
              <input
                className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                placeholder="How It Works Title"
                value={formData.howItWorksTitle || ''}
                onChange={(e) => setFormData({ ...formData, howItWorksTitle: e.target.value })}
              />
              <input
                className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                placeholder="How It Works Description"
                value={formData.howItWorksDescription || ''}
                onChange={(e) => setFormData({ ...formData, howItWorksDescription: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              {(formData.howItWorksSteps || []).map((step, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-xl space-y-3">
                  <div className="flex gap-3">
                    <input
                      className="w-24 px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary"
                      type="number"
                      placeholder="Number"
                      value={step.number}
                      onChange={(e) => {
                        const steps = formData.howItWorksSteps || [];
                        setFormData({
                          ...formData,
                          howItWorksSteps: steps.map((s, i) => i === index ? { ...s, number: parseInt(e.target.value) || 0 } : s)
                        });
                      }}
                    />
                    <input
                      className="flex-1 px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary"
                      placeholder="Icon name"
                      value={step.icon}
                      onChange={(e) => {
                        const steps = formData.howItWorksSteps || [];
                        setFormData({
                          ...formData,
                          howItWorksSteps: steps.map((s, i) => i === index ? { ...s, icon: e.target.value } : s)
                        });
                      }}
                    />
                    <input
                      className="flex-1 px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary"
                      placeholder="Step Title"
                      value={step.title}
                      onChange={(e) => {
                        const steps = formData.howItWorksSteps || [];
                        setFormData({
                          ...formData,
                          howItWorksSteps: steps.map((s, i) => i === index ? { ...s, title: e.target.value } : s)
                        });
                      }}
                    />
                    <button
                      onClick={() => {
                        const steps = formData.howItWorksSteps || [];
                        setFormData({
                          ...formData,
                          howItWorksSteps: steps.filter((_, i) => i !== index)
                        });
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                  <textarea
                    className="w-full px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary resize-none"
                    rows={2}
                    placeholder="Step Description"
                    value={step.description}
                    onChange={(e) => {
                      const steps = formData.howItWorksSteps || [];
                      setFormData({
                        ...formData,
                        howItWorksSteps: steps.map((s, i) => i === index ? { ...s, description: e.target.value } : s)
                      });
                    }}
                  />
                </div>
              ))}
              <button
                onClick={() => {
                  const steps = formData.howItWorksSteps || [];
                  setFormData({
                    ...formData,
                    howItWorksSteps: [...steps, { number: steps.length + 1, title: '', description: '', icon: '' }]
                  });
                }}
                className="w-full px-4 py-2 bg-primary/10 text-primary rounded-lg text-xs font-black uppercase tracking-widest hover:bg-primary/20 transition-colors"
              >
                Add Step
              </button>
            </div>
          </section>

          {/* Benefits Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">star</span> Benefits Section
              </h4>
              <button
                onClick={addBenefit}
                className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-primary-hover"
              >
                Add Benefit
              </button>
            </div>
            <div className="space-y-2">
              <input
                className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                placeholder="Benefits Title"
                value={formData.benefitsTitle || ''}
                onChange={(e) => setFormData({ ...formData, benefitsTitle: e.target.value })}
              />
              <input
                className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                placeholder="Benefits Description"
                value={formData.benefitsDescription || ''}
                onChange={(e) => setFormData({ ...formData, benefitsDescription: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              {(formData.benefits || []).map((benefit, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-xl space-y-3">
                  <div className="flex gap-3">
                    <input
                      className="w-32 px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary"
                      placeholder="Icon name"
                      value={benefit.icon}
                      onChange={(e) => updateBenefit(index, 'icon', e.target.value)}
                    />
                    <input
                      className="flex-1 px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary"
                      placeholder="Benefit Title"
                      value={benefit.title}
                      onChange={(e) => updateBenefit(index, 'title', e.target.value)}
                    />
                    <input
                      className="w-24 px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary"
                      type="number"
                      placeholder="Order"
                      value={benefit.order}
                      onChange={(e) => updateBenefit(index, 'order', parseInt(e.target.value) || 0)}
                    />
                    <button
                      onClick={() => removeBenefit(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                  <textarea
                    className="w-full px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary resize-none"
                    rows={2}
                    placeholder="Benefit Description"
                    value={benefit.description}
                    onChange={(e) => updateBenefit(index, 'description', e.target.value)}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Testimonials Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">format_quote</span> Testimonials Section
              </h4>
              <button
                onClick={addTestimonial}
                className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-primary-hover"
              >
                Add Testimonial
              </button>
            </div>
            <div className="space-y-2">
              <input
                className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                placeholder="Testimonials Title"
                value={formData.testimonialsTitle || ''}
                onChange={(e) => setFormData({ ...formData, testimonialsTitle: e.target.value })}
              />
              <input
                className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                placeholder="Testimonials Description"
                value={formData.testimonialsDescription || ''}
                onChange={(e) => setFormData({ ...formData, testimonialsDescription: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              {(formData.testimonials || []).map((testimonial, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className="px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary"
                      placeholder="Name"
                      value={testimonial.name}
                      onChange={(e) => updateTestimonial(index, 'name', e.target.value)}
                    />
                    <input
                      className="px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary"
                      placeholder="Role"
                      value={testimonial.role}
                      onChange={(e) => updateTestimonial(index, 'role', e.target.value)}
                    />
                    <input
                      className="px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary"
                      placeholder="Venue"
                      value={testimonial.venue}
                      onChange={(e) => updateTestimonial(index, 'venue', e.target.value)}
                    />
                    <input
                      className="px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary"
                      type="number"
                      min="1"
                      max="5"
                      placeholder="Rating (1-5)"
                      value={testimonial.rating}
                      onChange={(e) => updateTestimonial(index, 'rating', parseInt(e.target.value) || 5)}
                    />
                  </div>
                  <textarea
                    className="w-full px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary resize-none"
                    rows={3}
                    placeholder="Testimonial Content"
                    value={testimonial.content}
                    onChange={(e) => updateTestimonial(index, 'content', e.target.value)}
                  />
                  <button
                    onClick={() => removeTestimonial(index)}
                    className="w-full px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm font-bold"
                  >
                    Remove Testimonial
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Footer Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">description</span> Footer Section
              </h4>
              <button
                onClick={addFooterLink}
                className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-primary-hover"
              >
                Add Link
              </button>
            </div>
            <div className="space-y-2">
              <input
                className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                placeholder="Copyright Text"
                value={formData.footerCopyright || ''}
                onChange={(e) => setFormData({ ...formData, footerCopyright: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              {(formData.footerLinks || []).map((link, index) => (
                <div key={index} className="flex gap-3 items-center p-4 bg-gray-50 rounded-xl">
                  <input
                    className="flex-1 px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary"
                    placeholder="Link Label"
                    value={link.label}
                    onChange={(e) => updateFooterLink(index, 'label', e.target.value)}
                  />
                  <input
                    className="flex-1 px-4 py-2 bg-white border-gray-200 rounded-lg text-sm font-bold focus:ring-primary focus:border-primary"
                    placeholder="Link URL"
                    value={link.url}
                    onChange={(e) => updateFooterLink(index, 'url', e.target.value)}
                  />
                  <button
                    onClick={() => removeFooterLink(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-8 py-6 flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-primary text-primary-content rounded-xl text-sm font-black uppercase tracking-widest hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">save</span>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPageManagementModal;

