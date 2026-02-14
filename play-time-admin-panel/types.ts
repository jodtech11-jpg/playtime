
export enum Role {
  PLAYER = 'player',
  VENUE_MANAGER = 'venue_manager',
  SUPER_ADMIN = 'super_admin'
}

export type LoadingState = 'loading' | 'loaded' | 'error';

export interface Permission {
  id: string;
  name: string;
  description?: string;
  category: 'users' | 'bookings' | 'venues' | 'financials' | 'staff' | 'marketing' | 'settings' | 'other';
  resource: string; // e.g., 'users.create', 'bookings.edit'
  action: 'create' | 'read' | 'update' | 'delete' | 'manage';
  createdAt?: any;
  updatedAt?: any;
}

export interface RoleDefinition {
  id: string;
  name: string;
  description?: string;
  permissions: string[]; // Array of permission IDs
  isSystem: boolean; // System roles cannot be deleted
  createdAt?: any;
  updatedAt?: any;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role | string;
  status: 'Active' | 'Pending' | 'Inactive';
  avatar?: string;
  venueIds?: string[]; // For venue managers
  managedVenues?: string[]; // Venue IDs this manager manages
  customPermissions?: string[]; // Additional permissions beyond role
  walletBalance?: number; // User wallet balance
  level?: number; // User level/rank
  progress?: number; // User progress (0-100)
  streak?: number; // Daily streak count
  longestStreak?: number; // Longest streak achieved
  totalXP?: number; // Total experience points
  city?: string; // User's city
  state?: string; // User's state
  achievements?: Array<{
    name: string;
    description?: string;
    unlocked: boolean;
    unlockedAt?: any;
  }>; // User achievements
  sportStats?: Record<string, number>; // Statistics per sport
  totalMatches?: number; // Total matches played
  matchesWon?: number; // Matches won
  matchesLost?: number; // Matches lost
  totalSpent?: number; // Total amount spent on bookings
  notificationSettings?: {
    booking?: boolean;
    match?: boolean;
    social?: boolean;
    promotional?: boolean;
  };
  createdAt?: any;
  updatedAt?: any;
}

export interface AuthContextType {
  user: User | null;
  firebaseUser: any | null;
  loading: LoadingState;
  error: string | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isVenueManager: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export interface Booking {
  id: string;
  venueId: string;
  courtId: string;
  court: string;
  sport: string;
  userId: string;
  user: string;
  date: string;
  time: string;
  startTime: any;
  endTime: any;
  duration: number; // in hours
  status: 'Pending' | 'Confirmed' | 'Cancelled' | 'Completed';
  amount: number;
  paymentStatus: 'Pending' | 'Paid' | 'Refunded';
  paymentMethod?: 'Online' | 'Offline' | 'Cash';
  paymentGateway?: 'Razorpay' | 'Other';
  paymentTransactionId?: string; // Razorpay payment ID or transaction reference
  paymentDate?: any; // When payment was completed
  isFirstTimeBooking?: boolean; // For convenience fee calculation
  teamBox?: {
    type: '2v2' | '4v4';
    slots: Array<{
      userId?: string;
      gender?: 'M' | 'F';
      filled: boolean;
    }>;
  };
  createdAt?: any;
  updatedAt?: any;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  managerId?: string;
  sports: string[];
  courts: Court[];
  amenities: string[];
  images: string[];
  rules?: string;
  status: 'Active' | 'Pending' | 'Inactive';
  // Payment-related fields
  paymentSettings?: {
    razorpay?: {
      accountId?: string; // Razorpay account ID
      apiKey?: string; // Razorpay API key (encrypted)
      enabled: boolean;
    };
    bankAccount?: {
      accountHolderName?: string;
      accountNumber?: string;
      ifscCode?: string;
      bankName?: string;
      branch?: string;
    };
    upiId?: string;
    paymentMethods?: ('Bank Transfer' | 'UPI' | 'Cash' | 'Cheque')[];
  };
  // User-related fields
  userIds?: string[]; // List of user IDs who use this venue
  staffIds?: string[]; // List of staff member IDs
  createdAt?: any;
  updatedAt?: any;
}

export interface Court {
  id: string;
  venueId: string;
  name: string;
  sport: 'Badminton' | 'Cricket' | 'Football' | string;
  type: string;
  pricePerHour: number;
  availability: {
    [key: string]: { // day of week
      start: string;
      end: string;
      available: boolean;
    };
  };
  status: 'Active' | 'Maintenance' | 'Inactive';
  createdAt?: any;
  updatedAt?: any;
}

export interface Membership {
  id: string;
  userId: string;
  venueId: string;
  planId: string;
  planName: string;
  planType: 'Monthly' | '6 Months' | 'Annual';
  price: number;
  paymentStatus?: 'Pending' | 'Paid' | 'Refunded';
  paymentMethod?: 'Online' | 'Offline' | 'Cash';
  paymentGateway?: 'Razorpay' | 'Other';
  paymentTransactionId?: string; // Razorpay payment ID or transaction reference
  paymentDate?: any; // When payment was completed
  startDate: any;
  endDate: any;
  status: 'Pending' | 'Active' | 'Expired' | 'Cancelled';
  createdAt?: any;
  updatedAt?: any;
}

export interface MembershipPlan {
  id: string;
  venueId: string;
  name: string;
  type: 'Monthly' | '6 Months' | 'Annual';
  price: number;
  features: string[];
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface Transaction {
  id: string;
  type: 'Booking' | 'Membership' | 'Equipment' | 'Commission' | 'ConvenienceFee';
  source: string; // Venue name or user name
  sourceId: string; // Venue ID or User ID
  amount: number;
  platformCommission?: number; // 5% of booking/membership
  convenienceFee?: number; // ₹100 for first-time bookings
  venuePayout?: number; // Amount to venue
  netPlatform?: number; // Net amount to platform
  status: 'Completed' | 'Pending' | 'Refunded';
  bookingId?: string;
  membershipId?: string;
  invoiceId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: 'Booking' | 'Membership' | 'Commission' | 'Settlement';
  source: string;
  sourceId: string;
  amount: number;
  breakdown: {
    gross: number;
    commission?: number;
    convenienceFee?: number;
    gatewayFee?: number;
    net: number;
  };
  status: 'Draft' | 'Sent' | 'Paid' | 'Cancelled';
  paymentMethod?: 'Bank Transfer' | 'UPI' | 'Cash' | 'Cheque' | 'Other';
  paymentReference?: string; // Bank transaction reference, UPI ID, etc.
  paymentConfirmedBy?: string; // Super Admin user ID who confirmed payment
  paymentConfirmedAt?: any; // When payment was confirmed
  receiptUrl?: string; // URL to payment receipt/image
  dueDate?: any;
  paidDate?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface Payment {
  id: string;
  type: 'Online' | 'Offline';
  direction: 'UserToVenue' | 'VenueToPlatform';
  sourceType: 'Booking' | 'Membership' | 'Settlement';
  sourceId: string; // Booking ID, Membership ID, or Invoice ID
  userId?: string; // For user payments
  venueId: string;
  amount: number;
  paymentMethod: 'Razorpay' | 'Bank Transfer' | 'UPI' | 'Cash' | 'Cheque' | 'Other';
  paymentGateway?: 'Razorpay' | 'Other';
  transactionId?: string; // Razorpay payment ID, bank reference, UPI ID, etc.
  status: 'Pending' | 'Completed' | 'Failed' | 'Refunded';
  paymentDate?: any;
  confirmedBy?: string; // Admin user ID who confirmed (for offline payments)
  confirmedAt?: any;
  receiptUrl?: string; // For offline payment receipts
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Settlement {
  id: string;
  venueId: string;
  venueName: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number; // Total amount to be paid by venue
  breakdown: {
    commission: number;
    convenienceFee: number;
    gatewayFee?: number;
    net: number;
  };
  status: 'Pending' | 'Paid' | 'Overdue' | 'Cancelled';
  paymentMethod?: 'Bank Transfer' | 'UPI' | 'Cash' | 'Cheque' | 'Other';
  paymentReference?: string;
  paymentDate?: any;
  paidDate?: any;
  confirmedBy?: string; // Super Admin user ID
  confirmedAt?: any;
  receiptUrl?: string;
  dueDate: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface Staff {
  id: string;
  venueId: string;
  name: string;
  email?: string;
  phone?: string;
  role: string; // e.g., 'Senior Coach', 'Receptionist', 'Coach', 'Trainer'
  department?: string; // e.g., 'Football', 'Front Desk', 'Tennis'
  salary: number; // Monthly salary
  status: 'Active' | 'On Leave' | 'Inactive';
  avatar?: string;
  permissions?: string[]; // Array of permission strings
  joinDate?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface Expense {
  id: string;
  venueId: string;
  staffId?: string; // If expense is for a specific staff member
  staffName?: string; // Staff member name (for display)
  title: string;
  category: 'Travel' | 'Meals' | 'Equipment' | 'Maintenance' | 'Utilities' | 'Other';
  amount: number;
  description?: string;
  receiptUrl?: string; // URL to receipt image in Storage
  date: any;
  createdBy: string; // User ID who created the expense
  createdAt?: any;
  updatedAt?: any;
}

export interface SalaryRecord {
  id: string;
  staffId: string;
  venueId: string;
  amount: number;
  month: string; // Format: 'YYYY-MM'
  status: 'Pending' | 'Paid' | 'Overdue';
  paidDate?: any;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Post {
  id: string;
  venueId: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  type: 'Match' | 'Community' | 'Venue Update' | 'Other';
  content: string;
  images?: string[]; // Array of image URLs
  matchResult?: {
    teamA: {
      name: string;
      logo?: string;
      score: number;
    };
    teamB: {
      name: string;
      logo?: string;
      score: number;
    };
    status: 'Final' | 'Live' | 'Upcoming';
  };
  likes?: number;
  comments?: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Removed';
  isReported?: boolean;
  reportCount?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface Report {
  id: string;
  postId: string;
  reporterId: string;
  reporterName?: string;
  reason: 'Spam' | 'Inappropriate Content' | 'Aggressive Language' | 'False Information' | 'Harassment' | 'Other';
  description?: string;
  status: 'Pending' | 'Reviewed' | 'Dismissed' | 'Action Taken';
  actionTaken?: 'Post Removed' | 'User Banned' | 'Warning Issued' | 'No Action';
  reviewedBy?: string; // Moderator/Admin user ID
  reviewedAt?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface Sport {
  id: string;
  name: string;
  description?: string;
  icon?: string; // Material icon name
  color?: string; // Hex color for UI
  isActive: boolean;
  order?: number; // Display order
  // Common tournament settings
  defaultMinTeamSize?: number;
  defaultMaxTeamSize?: number;
  defaultMatchDuration?: number; // in minutes
  defaultScoringFormat?: string; // e.g., "Best of 3", "First to 21"
  // Sport-specific options (flexible JSON structure)
  sportSpecificOptions?: {
    // Badminton
    courtType?: 'Indoor' | 'Outdoor' | 'Both';
    gameTypes?: string[]; // e.g., ['Singles', 'Doubles', 'Mixed Doubles']
    shuttleType?: string[]; // e.g., ['Plastic', 'Feather']
    // Cricket
    format?: string[]; // e.g., ['T20', 'ODI', 'Test']
    overs?: number[];
    ballType?: string[]; // e.g., ['Leather', 'Tennis']
    pitchType?: string[]; // e.g., ['Turf', 'Concrete', 'Matting']
    // Football
    fieldSize?: string[]; // e.g., ['5v5', '7v7', '11v11']
    matchDuration?: number[]; // in minutes
    ballSize?: string[]; // e.g., ['Size 4', 'Size 5']
    // Tennis
    courtSurface?: string[]; // e.g., ['Hard', 'Clay', 'Grass', 'Carpet']
    matchFormat?: string[]; // e.g., ['Best of 3', 'Best of 5']
    // Basketball
    courtType?: string[]; // e.g., ['Indoor', 'Outdoor']
    ballSize?: string[]; // e.g., ['Size 6', 'Size 7']
    // Generic custom fields
    [key: string]: any;
  };
  createdAt?: any;
  updatedAt?: any;
}

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  sport: string; // Sport ID or name (for backward compatibility)
  sportId?: string; // Reference to Sport document
  venueId: string;
  venueName?: string;
  startDate: any;
  endDate: any;
  registrationStartDate: any;
  registrationEndDate: any;
  entryFee: number;
  prizeDetails?: {
    first?: number;
    second?: number;
    third?: number;
    description?: string;
  };
  maxTeams?: number;
  minTeamSize?: number;
  maxTeamSize?: number;
  status: 'Draft' | 'Open' | 'Registration Closed' | 'Ongoing' | 'Completed' | 'Cancelled';
  bracketType?: 'Single Elimination' | 'Double Elimination' | 'Round Robin' | 'Swiss';
  teams?: TournamentTeam[];
  matches?: TournamentMatch[];
  createdAt?: any;
  updatedAt?: any;
}

export interface TournamentTeam {
  id: string;
  tournamentId: string;
  name: string;
  captainId: string;
  captainName?: string;
  captainEmail?: string;
  captainPhone?: string;
  members: Array<{
    userId?: string;
    name: string;
    email?: string;
    phone?: string;
  }>;
  division?: string; // e.g., 'Div A', 'Div B'
  status: 'Pending' | 'Approved' | 'Rejected' | 'Paid' | 'Unpaid';
  paymentStatus: 'Pending' | 'Paid' | 'Refunded';
  paymentDate?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  round: string; // e.g., 'Round 1', 'Quarterfinals', 'Semifinals', 'Finals'
  matchNumber: number;
  teamAId: string;
  teamAName: string;
  teamBId: string;
  teamBName: string;
  courtId?: string;
  courtName?: string;
  scheduledTime?: any;
  status: 'Scheduled' | 'Live' | 'Completed' | 'Cancelled';
  score?: {
    teamA: number;
    teamB: number;
  };
  winnerId?: string;
  winnerName?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string; // Material icon name
  color?: string; // Hex color for UI
  isActive: boolean;
  order?: number; // Display order
  createdAt?: any;
  updatedAt?: any;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  category: string; // Category ID or name (for backward compatibility)
  price: number;
  originalPrice?: number; // For discounted products
  discount?: number; // Discount percentage
  stock: number;
  minStock?: number; // Reorder point
  images: string[];
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  sku?: string;
  venueId?: string; // Optional: venue-specific products
  venueName?: string; // For display purposes
  // Analytics
  views?: number;
  salesCount?: number; // Total units sold
  revenue?: number; // Total revenue from this product
  // Additional fields
  weight?: number; // For shipping calculations
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  tags?: string[]; // For search and filtering
  isFeatured?: boolean; // Featured products
  createdAt?: any;
  updatedAt?: any;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    image?: string; // Product image for display
  }>;
  subtotal: number; // Before discounts and shipping
  discount?: number; // Discount amount
  shippingCost?: number; // Shipping charges
  tax?: number; // Tax amount
  total: number;
  status: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Refunded';
  shippingAddress?: {
    name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
  };
  paymentStatus: 'Pending' | 'Paid' | 'Refunded' | 'Partially Refunded';
  paymentMethod?: string;
  paymentTransactionId?: string; // Payment gateway transaction ID
  // Order tracking
  trackingNumber?: string;
  carrier?: string; // Shipping carrier name
  shippedAt?: any;
  deliveredAt?: any;
  cancelledAt?: any;
  cancelledReason?: string;
  // Order management
  notes?: string; // Internal notes
  adminNotes?: string; // Admin-only notes
  statusHistory?: Array<{
    status: Order['status'];
    timestamp: any;
    updatedBy?: string; // User ID who updated
    note?: string;
  }>;
  // Refund information
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: any;
  // Venue association (if order is venue-specific)
  venueId?: string;
  venueName?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface MarketingCampaign {
  id: string;
  title: string;
  description?: string;
  type: 'Global' | 'Venue';
  venueId?: string; // Required if type is 'Venue'
  venueName?: string;
  target: string; // e.g., 'Discovery Page', 'Uptown Complex'
  imageUrl: string;
  status: 'Live' | 'Paused' | 'Draft' | 'Expired';
  startDate?: any;
  endDate?: any;
  clicks?: number;
  impressions?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  type: 'Refund Request' | 'App Crash' | 'Payment Sync' | 'Booking Issue' | 'Membership Issue' | 'Other';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  subject: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  assignedTo?: string; // Admin user ID
  responses?: Array<{
    userId: string;
    userName?: string;
    message: string;
    createdAt: any;
  }>;
  createdAt?: any;
  updatedAt?: any;
  resolvedAt?: any;
}

export interface QuickMatch {
  id: string;
  venueId: string;
  venueName?: string;
  sport: string;
  courtId?: string;
  courtName?: string;
  date: any; // Firestore timestamp
  time: string; // e.g., '18:00'
  maxPlayers: number;
  currentPlayers: number;
  playerIds: string[]; // Array of user IDs who joined
  status: 'Open' | 'Full' | 'Started' | 'Completed' | 'Cancelled';
  createdBy: string; // User ID who created the match
  createdAt?: any;
  updatedAt?: any;
}

export interface Leaderboard {
  id: string;
  venueId?: string; // Optional: venue-specific leaderboard
  sport: string;
  type: 'Global' | 'Venue' | 'Monthly' | 'All-Time';
  entries: Array<{
    userId: string;
    userName?: string;
    userAvatar?: string;
    score: number;
    rank: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
  }>;
  period?: 'January 2024' | string; // For monthly leaderboards
  updatedAt?: any;
}

export interface Poll {
  id: string;
  question: string;
  options: Array<{
    id: string;
    text: string;
    votes: number;
  }>;
  venueId?: string; // Optional: venue-specific poll
  sport?: string; // Optional: sport-specific poll
  status: 'Active' | 'Closed';
  startDate?: any;
  endDate?: any;
  totalVotes: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface FlashDeal {
  id: string;
  title: string;
  description?: string;
  venueId: string;
  venueName?: string;
  discountType: 'Percentage' | 'Fixed';
  discountValue: number; // Percentage (0-100) or fixed amount
  originalPrice: number;
  discountedPrice: number;
  startTime: any; // Firestore timestamp
  endTime: any; // Firestore timestamp
  maxBookings?: number; // Limit on number of bookings
  currentBookings: number;
  status: 'Upcoming' | 'Active' | 'Expired' | 'Cancelled';
  imageUrl?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface AppSettings {
  id: string; // Will be 'platform' or similar constant
  
  // General Settings
  appName?: string;
  appLogo?: string;
  appDescription?: string;
  timezone?: string;
  currency?: string;
  currencySymbol?: string;
  locale?: string;
  supportEmail?: string;
  supportPhone?: string;
  
  // Business Rules
  convenienceFee: number; // ₹100 for first-time bookings
  platformCommission: number; // 5% commission
  cancellationWindowHours: number; // Hours before booking that cancellation is allowed
  bookingBufferMinutes: number; // Minutes between bookings
  
  // Booking Settings
  maxAdvanceBookingDays?: number; // Maximum days in advance bookings can be made
  minBookingDurationMinutes?: number; // Minimum booking duration
  maxBookingDurationMinutes?: number; // Maximum booking duration
  autoConfirmBookings?: boolean; // Auto-confirm bookings without approval
  requireVenueApproval?: boolean; // Require venue manager approval for bookings
  allowSameDayBookings?: boolean; // Allow bookings on the same day
  refundPolicy?: 'full' | 'partial' | 'none'; // Refund policy for cancellations
  refundPercentage?: number; // Percentage refunded (if partial)
  
  // Payment Settings
  paymentMethods?: string[]; // Available payment methods
  settlementFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly'; // How often venues get paid
  minimumPayoutAmount?: number; // Minimum amount before payout
  enableAutoSettlement?: boolean; // Automatically process settlements
  taxRate?: number; // Platform tax rate (%)
  enableGST?: boolean; // Enable GST
  gstNumber?: string; // GST registration number
  
  // Notification Settings
  defaultNotificationChannels?: ('push' | 'whatsapp' | 'email' | 'sms')[]; // Default channels
  enableBookingNotifications?: boolean; // Send notifications for bookings
  enablePaymentNotifications?: boolean; // Send notifications for payments
  enableMarketingNotifications?: boolean; // Allow marketing notifications
  notificationReminderHours?: number[]; // Hours before booking to send reminder (e.g., [24, 2])
  enableAutoReminders?: boolean; // Automatically send booking reminders
  
  // Security Settings
  sessionTimeoutMinutes?: number; // Session timeout in minutes
  requireStrongPasswords?: boolean; // Require strong passwords
  minPasswordLength?: number; // Minimum password length
  enableTwoFactorAuth?: boolean; // Enable 2FA for admins
  apiRateLimit?: number; // API requests per minute
  enableMaintenanceMode?: boolean; // Maintenance mode
  maintenanceMessage?: string; // Message shown during maintenance
  
  // System Settings
  dataRetentionDays?: number; // Days to retain data
  enableAutoBackup?: boolean; // Automatic backups
  backupFrequency?: 'daily' | 'weekly' | 'monthly'; // Backup frequency
  enableAnalytics?: boolean; // Enable analytics tracking
  enableErrorLogging?: boolean; // Enable error logging
  maxFileUploadSizeMB?: number; // Maximum file upload size
  
  // API Integrations
  integrations: {
    razorpay: {
      enabled: boolean;
      status: 'Connected' | 'Disconnected' | 'Setup Required';
      apiKey?: string;
      apiSecret?: string;
      webhookSecret?: string;
    };
    whatsapp: {
      enabled: boolean;
      status: 'Connected' | 'Disconnected' | 'Setup Required';
      apiKey?: string;
      phoneNumberId?: string;
      businessAccountId?: string;
    };
    email?: {
      enabled: boolean;
      status: 'Connected' | 'Disconnected' | 'Setup Required';
      provider?: 'smtp' | 'sendgrid' | 'ses' | 'mailgun';
      smtpHost?: string;
      smtpPort?: number;
      smtpUser?: string;
      smtpPassword?: string;
      fromEmail?: string;
      fromName?: string;
    };
    sms?: {
      enabled: boolean;
      status: 'Connected' | 'Disconnected' | 'Setup Required';
      provider?: 'twilio' | 'aws-sns' | 'msg91';
      apiKey?: string;
      apiSecret?: string;
      fromNumber?: string;
    };
  };
  
  helpCenterDocs?: Array<{
    id: string;
    title: string;
    content: string;
    category: 'General' | 'Bookings' | 'Payments' | 'Memberships' | 'Account' | 'Other';
    order: number;
  }>;
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string; // User ID who last updated
}

export interface LandingPageContent {
  id: string; // Will be 'landing' or similar constant
  
  // Hero Section
  heroTitle?: string;
  heroSubtitle?: string;
  heroDescription?: string;
  heroPrimaryButtonText?: string;
  heroSecondaryButtonText?: string;
  heroBackgroundImage?: string;
  
  // Stats Section
  stats?: Array<{
    value: string;
    label: string;
  }>;
  
  // Features Section
  featuresTitle?: string;
  featuresDescription?: string;
  features?: Array<{
    icon: string;
    title: string;
    description: string;
    order: number;
  }>;
  
  // CTA Section
  ctaTitle?: string;
  ctaDescription?: string;
  ctaButtonText?: string;
  
  // How It Works Section
  howItWorksTitle?: string;
  howItWorksDescription?: string;
  howItWorksSteps?: Array<{
    number: number;
    title: string;
    description: string;
    icon: string;
  }>;
  
  // Benefits Section
  benefitsTitle?: string;
  benefitsDescription?: string;
  benefits?: Array<{
    icon: string;
    title: string;
    description: string;
    order: number;
  }>;
  
  // Testimonials Section
  testimonialsTitle?: string;
  testimonialsDescription?: string;
  testimonials?: Array<{
    name: string;
    role: string;
    venue: string;
    content: string;
    rating: number;
    avatar?: string;
  }>;
  
  // Footer
  footerCopyright?: string;
  footerLinks?: Array<{
    label: string;
    url: string;
  }>;
  
  // Meta
  isActive?: boolean;
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
}

/** CMS page for frontend (e.g. /about, /terms). One doc per page in cmsPages collection. */
export interface CmsPage {
  id: string;
  slug: string; // URL path, e.g. 'about', 'terms'
  title: string;
  description?: string;
  body?: string; // HTML or plain text content
  isActive: boolean;
  order: number;
  metaTitle?: string;
  metaDescription?: string;
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'Announcement' | 'Booking' | 'Membership' | 'Tournament' | 'Promotion' | 'System' | 'Other';
  targetAudience: 'All Users' | 'Venue Managers' | 'Specific Users' | 'Venue Users';
  targetUserIds?: string[]; // Required if targetAudience is 'Specific Users'
  targetVenueId?: string; // Required if targetAudience is 'Venue Users'
  imageUrl?: string;
  actionUrl?: string; // Deep link or URL to navigate to
  actionText?: string; // e.g., 'View Booking', 'Open App'
  scheduledFor?: any; // Optional: schedule notification for future
  sentAt?: any; // When notification was actually sent
  status: 'Draft' | 'Scheduled' | 'Sending' | 'Sent' | 'Failed';
  sentCount?: number; // Number of users who received the notification
  failedCount?: number; // Number of failed deliveries
  createdBy: string; // Admin user ID who created the notification
  createdAt?: any;
  updatedAt?: any;
}

export interface FCMToken {
  id: string;
  userId: string;
  token: string;
  deviceType?: 'web' | 'android' | 'ios';
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
  };
  isActive: boolean;
  lastUsedAt?: any;
  createdAt?: any;
  updatedAt?: any;
}
