
export type Screen = 'login' | 'home' | 'venue-detail' | 'sport-select' | 'team-up' | 'membership' | 'social-feed' | 'marketplace' | 'profile' | 'map-view' | 'notifications';

export interface Venue {
  id: string;
  name: string;
  location: string;
  distance: string;
  rating: number;
  reviews: number;
  price: number;
  image: string;
  categories: string[];
  tags?: string[];
  amenities?: string[];
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice: number;
  image: string;
  tag?: string;
}

export interface MatchFeedItem {
  id: string;
  type: 'live' | 'result';
  title: string;
  time: string;
  teamA: { name: string; icon: string; score?: number; logo?: string };
  teamB: { name: string; icon: string; score?: number; logo?: string };
  description: string;
  likes: number;
  comments: number;
}

export interface Booking {
  id: string;
  venueName: string;
  venueImage?: string;
  date: string;
  time: string;
  amount: number;
  sport: string;
  status: 'Completed' | 'Upcoming' | 'Cancelled';
}

export interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  role: string;
  status: 'Joined' | 'Invited';
}

export interface Team {
  id: string;
  name: string;
  sport: string;
  logo: string;
  members: TeamMember[];
  matchesWon: number;
}
