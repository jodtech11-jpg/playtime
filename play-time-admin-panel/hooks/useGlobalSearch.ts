import { useState, useEffect, useMemo } from 'react';
import { useBookings } from './useBookings';
import { useUsers } from './useUsers';
import { useVenues } from './useVenues';
import { useStaff } from './useStaff';
import { useTournaments } from './useTournaments';
import { useProducts } from './useProducts';
import { useOrders } from './useOrders';
import { useNotifications } from './useNotifications';

export interface SearchResult {
  id: string;
  type: 'booking' | 'user' | 'venue' | 'staff' | 'tournament' | 'product' | 'order' | 'notification';
  title: string;
  subtitle?: string;
  description?: string;
  status?: string;
  url: string;
  data: any;
}

export const useGlobalSearch = (query: string, enabled: boolean = true) => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Only fetch data if search is enabled and query is long enough
  const shouldSearch = enabled && query.trim().length >= 2;

  // Fetch all data (with limits for performance) - only when searching
  const bookingsOptions = shouldSearch ? { realtime: false, limit: 50 } : { realtime: false, limit: 0 };
  const { bookings } = useBookings(bookingsOptions);
  const { users } = useUsers(shouldSearch ? { limit: 50 } : { limit: 0 });
  const { venues } = useVenues(shouldSearch ? { realtime: false } : { realtime: false });
  const { staff } = useStaff(shouldSearch ? { realtime: false } : { realtime: false });
  const { tournaments } = useTournaments(shouldSearch ? { realtime: false } : { realtime: false });
  const { products } = useProducts(shouldSearch ? { realtime: false, limit: 50 } : { realtime: false, limit: 0 });
  const { orders } = useOrders(shouldSearch ? { realtime: false, limit: 50 } : { realtime: false, limit: 0 });
  const { notifications } = useNotifications(shouldSearch);

  // Perform search
  useEffect(() => {
    if (!shouldSearch) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const searchLower = query.toLowerCase().trim();
    const searchResults: SearchResult[] = [];

    // Search bookings
    bookings.forEach(booking => {
      const matches = 
        booking.user?.toLowerCase().includes(searchLower) ||
        booking.court?.toLowerCase().includes(searchLower) ||
        booking.sport?.toLowerCase().includes(searchLower) ||
        booking.venueId?.toLowerCase().includes(searchLower) ||
        booking.id?.toLowerCase().includes(searchLower);
      
      if (matches) {
        searchResults.push({
          id: booking.id,
          type: 'booking',
          title: `${booking.user} - ${booking.court}`,
          subtitle: `${booking.sport} • ${booking.date} ${booking.time}`,
          description: `Status: ${booking.status} • Amount: ₹${booking.amount}`,
          status: booking.status,
          url: `/bookings`,
          data: booking
        });
      }
    });

    // Search users
    users.forEach(user => {
      const matches = 
        user.name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.phone?.toLowerCase().includes(searchLower) ||
        user.id?.toLowerCase().includes(searchLower);
      
      if (matches) {
        searchResults.push({
          id: user.id,
          type: 'user',
          title: user.name || 'Unknown User',
          subtitle: user.email,
          description: user.phone ? `Phone: ${user.phone}` : undefined,
          status: user.status,
          url: `/crm`, // Users are typically viewed in CRM
          data: user
        });
      }
    });

    // Search venues
    venues.forEach(venue => {
      const matches = 
        venue.name?.toLowerCase().includes(searchLower) ||
        venue.address?.toLowerCase().includes(searchLower) ||
        venue.id?.toLowerCase().includes(searchLower);
      
      if (matches) {
        searchResults.push({
          id: venue.id,
          type: 'venue',
          title: venue.name,
          subtitle: venue.address,
          description: `Sports: ${venue.sports?.join(', ') || 'N/A'}`,
          status: venue.status,
          url: `/venues`,
          data: venue
        });
      }
    });

    // Search staff
    staff.forEach(staffMember => {
      const matches = 
        staffMember.name?.toLowerCase().includes(searchLower) ||
        staffMember.email?.toLowerCase().includes(searchLower) ||
        staffMember.phone?.toLowerCase().includes(searchLower) ||
        staffMember.role?.toLowerCase().includes(searchLower) ||
        staffMember.id?.toLowerCase().includes(searchLower);
      
      if (matches) {
        searchResults.push({
          id: staffMember.id,
          type: 'staff',
          title: staffMember.name,
          subtitle: staffMember.role,
          description: staffMember.email || staffMember.phone || undefined,
          status: staffMember.status,
          url: `/staff`,
          data: staffMember
        });
      }
    });

    // Search tournaments
    tournaments.forEach(tournament => {
      const matches = 
        tournament.name?.toLowerCase().includes(searchLower) ||
        tournament.sport?.toLowerCase().includes(searchLower) ||
        tournament.id?.toLowerCase().includes(searchLower);
      
      if (matches) {
        searchResults.push({
          id: tournament.id,
          type: 'tournament',
          title: tournament.name,
          subtitle: tournament.sport,
          description: `Status: ${tournament.status} • Entry Fee: ₹${tournament.entryFee}`,
          status: tournament.status,
          url: `/tournaments`,
          data: tournament
        });
      }
    });

    // Search products
    products.forEach(product => {
      const matches = 
        product.name?.toLowerCase().includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower) ||
        product.category?.toLowerCase().includes(searchLower) ||
        product.sku?.toLowerCase().includes(searchLower);
      
      if (matches) {
        searchResults.push({
          id: product.id,
          type: 'product',
          title: product.name,
          subtitle: product.category,
          description: `Price: ₹${product.price} • Stock: ${product.stock}`,
          status: product.status,
          url: `/marketplace`,
          data: product
        });
      }
    });

    // Search orders
    orders.forEach(order => {
      const matches = 
        order.orderNumber?.toLowerCase().includes(searchLower) ||
        order.userName?.toLowerCase().includes(searchLower) ||
        order.userEmail?.toLowerCase().includes(searchLower) ||
        order.id?.toLowerCase().includes(searchLower);
      
      if (matches) {
        searchResults.push({
          id: order.id,
          type: 'order',
          title: `Order #${order.orderNumber}`,
          subtitle: order.userName || order.userEmail,
          description: `Total: ₹${order.total} • Status: ${order.status}`,
          status: order.status,
          url: `/marketplace`,
          data: order
        });
      }
    });

    // Search notifications
    notifications.forEach(notification => {
      const matches = 
        notification.title?.toLowerCase().includes(searchLower) ||
        notification.body?.toLowerCase().includes(searchLower) ||
        notification.type?.toLowerCase().includes(searchLower);
      
      if (matches) {
        searchResults.push({
          id: notification.id,
          type: 'notification',
          title: notification.title,
          subtitle: notification.type,
          description: notification.body?.substring(0, 100),
          status: notification.status,
          url: `/notifications`,
          data: notification
        });
      }
    });

    // Sort results by relevance (exact matches first, then partial matches)
    searchResults.sort((a, b) => {
      const aExact = a.title.toLowerCase() === searchLower || a.title.toLowerCase().startsWith(searchLower);
      const bExact = b.title.toLowerCase() === searchLower || b.title.toLowerCase().startsWith(searchLower);
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return 0;
    });

    setResults(searchResults.slice(0, 20)); // Limit to 20 results
    setLoading(false);
  }, [query, shouldSearch, bookings, users, venues, staff, tournaments, products, orders, notifications]);

  return { results, loading };
};

