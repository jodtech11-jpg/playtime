import { useState, useEffect } from 'react';
import { landingPageCollection } from '../services/firebase';
import { LandingPageContent } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_LANDING_PAGE: LandingPageContent = {
  id: 'landing',
  heroTitle: 'Manage Your Sports Venues',
  heroSubtitle: 'Like Never Before',
  heroDescription: 'Complete control over bookings, memberships, staff, and finances. All in one powerful platform designed for sports venue management.',
  heroPrimaryButtonText: 'Get Started',
  heroSecondaryButtonText: 'Sign In',
  stats: [
    { value: '100+', label: 'Active Venues' },
    { value: '50K+', label: 'Monthly Bookings' },
    { value: '24/7', label: 'Support Available' },
    { value: '99.9%', label: 'Uptime' }
  ],
  featuresTitle: 'Everything You Need',
  featuresDescription: 'Powerful features to streamline your venue management operations',
  features: [
    {
      icon: 'calendar_month',
      title: 'Booking Management',
      description: 'Complete control over bookings, schedules, and availability across all your venues.',
      order: 1
    },
    {
      icon: 'groups',
      title: 'Member Management',
      description: 'Manage memberships, track renewals, and handle member relationships effortlessly.',
      order: 2
    },
    {
      icon: 'account_balance',
      title: 'Financial Overview',
      description: 'Real-time financial insights, revenue tracking, and comprehensive reporting.',
      order: 3
    },
    {
      icon: 'storefront',
      title: 'Multi-Venue Support',
      description: 'Manage multiple venues from a single dashboard with centralized control.',
      order: 4
    },
    {
      icon: 'people',
      title: 'Staff Management',
      description: 'Organize staff schedules, track performance, and manage payroll efficiently.',
      order: 5
    },
    {
      icon: 'analytics',
      title: 'Advanced Analytics',
      description: 'Data-driven insights to optimize operations and maximize revenue.',
      order: 6
    }
  ],
  ctaTitle: 'Ready to Get Started?',
  ctaDescription: 'Join hundreds of venues already using Play Time to manage their operations.',
  ctaButtonText: 'Sign In to Dashboard',
  footerCopyright: '© 2024 Play Time. All rights reserved.',
  footerLinks: [
    { label: 'Privacy', url: '#' },
    { label: 'Terms', url: '#' },
    { label: 'Support', url: '#' }
  ],
  howItWorksTitle: 'How It Works',
  howItWorksDescription: 'Get started in three simple steps',
  howItWorksSteps: [
    { number: 1, title: 'Sign Up', description: 'Create your account and get verified by our team', icon: 'person_add' },
    { number: 2, title: 'Add Your Venue', description: 'Set up your venue details, courts, and pricing', icon: 'storefront' },
    { number: 3, title: 'Start Managing', description: 'Begin accepting bookings and managing operations', icon: 'rocket_launch' }
  ],
  benefitsTitle: 'Why Choose Play Time',
  benefitsDescription: 'Discover what makes us the preferred choice for venue management',
  benefits: [
    { icon: 'speed', title: 'Lightning Fast', description: 'Process bookings and payments in seconds', order: 1 },
    { icon: 'security', title: 'Secure & Reliable', description: 'Bank-level security for all transactions', order: 2 },
    { icon: 'support_agent', title: '24/7 Support', description: 'Round-the-clock assistance when you need it', order: 3 },
    { icon: 'trending_up', title: 'Grow Revenue', description: 'Increase bookings and maximize your earnings', order: 4 }
  ],
  testimonialsTitle: 'What Our Users Say',
  testimonialsDescription: 'Join thousands of satisfied venue owners',
  testimonials: [
    {
      name: 'Rajesh Kumar',
      role: 'Venue Owner',
      venue: 'Sports Arena Chennai',
      content: 'Play Time has transformed how we manage our venue. Bookings are up 40% and everything is so much easier!',
      rating: 5
    },
    {
      name: 'Priya Sharma',
      role: 'Manager',
      venue: 'Elite Badminton Club',
      content: 'The analytics and reporting features are incredible. We can now make data-driven decisions for our business.',
      rating: 5
    },
    {
      name: 'Amit Patel',
      role: 'Owner',
      venue: 'Cricket Grounds Mumbai',
      content: 'Best investment we\'ve made. The platform pays for itself with the increased efficiency and revenue.',
      rating: 5
    }
  ],
  isActive: true
};

export const useLandingPage = (realtime: boolean = true) => {
  const { user } = useAuth();
  const [content, setContent] = useState<LandingPageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const fetchContent = async () => {
      try {
        setLoading(true);
        setError(null);

        if (realtime) {
          unsubscribe = landingPageCollection.subscribe((doc: any) => {
            if (doc) {
              setContent({ ...DEFAULT_LANDING_PAGE, ...doc, id: 'landing' });
            } else {
              setContent(DEFAULT_LANDING_PAGE);
            }
            setLoading(false);
          });
        } else {
          const doc = await landingPageCollection.get();
          if (doc) {
            setContent({ ...DEFAULT_LANDING_PAGE, ...doc, id: 'landing' });
          } else {
            setContent(DEFAULT_LANDING_PAGE);
          }
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching landing page content:', err);
        setError(err.message);
        setContent(DEFAULT_LANDING_PAGE);
        setLoading(false);
      }
    };

    fetchContent();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [realtime]);

  const updateContent = async (updates: Partial<LandingPageContent>) => {
    try {
      const currentContent = await landingPageCollection.get() as LandingPageContent | null;
      
      if (currentContent) {
        await landingPageCollection.update({
          ...updates,
          updatedBy: user?.id,
          updatedAt: serverTimestamp()
        });
      } else {
        await landingPageCollection.create({
          ...DEFAULT_LANDING_PAGE,
          ...updates,
          updatedBy: user?.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (err: any) {
      console.error('Error updating landing page content:', err);
      throw err;
    }
  };

  return {
    content,
    loading,
    error,
    updateContent
  };
};

