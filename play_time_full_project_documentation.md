# 🏟️ Play Time – Turf & Court Booking Platform

## 1. Project Overview
**Play Time** is a mobile-first sports booking platform that allows users to discover, book, and participate in games at nearby turfs and courts. The platform supports badminton, cricket, football, and similar sports with advanced booking, membership, team-up, and social interaction features.

**Target Region:** Tamil Nadu, India (Phase 1)

**Platforms:**
- Android App
- iOS App
- Web Admin Panel

---

## 2. User Roles

### 2.1 Players (Customers)
- Discover nearby venues
- Book slots or full courts
- Join or create teams
- Purchase memberships
- Participate in venue social feeds
- Buy sports items

### 2.2 Venue Admins
- Manage bookings & availability
- Create memberships
- Activate memberships
- Manage staff & expenses
- Moderate social feed
- View financial reports

### 2.3 Super Admin (Play Time Team)
- Approve venues
- Monitor platform revenue
- Manage disputes & reports
- Control global banners & tournaments

---

## 3. Core Features

### 3.1 Authentication
- Phone number login via OTP
- Secure session handling

### 3.2 User Profile
- Basic details (name, gender, DOB)
- Extended fitness profile
- Privacy controls

---

## 4. Discovery Module
- GPS-based nearby venue listing
- Filters: sport type, price, membership-only
- Venue detail pages with amenities, rules, and photos

---

## 5. Booking System

### 5.1 Sports Supported
- Badminton
- Cricket
- Football

### 5.2 Booking Types
- Time-slot booking
- Full court/turf booking

### 5.3 Team-Up Logic
- Badminton: 2-player & 4-player team boxes
- Gender tags (M/F)
- Join / Leave slots

### 5.4 Booking Flow
1. Select sport
2. Choose venue & court
3. Pick time slot
4. Team-up (if applicable)
5. Confirm & Pay

---

## 6. Membership Management

### 6.1 Membership Plans
- Monthly
- 6 Months
- Annual

### 6.2 Membership Flow
- User purchases membership
- Payment goes to venue
- Venue admin activates membership
- Status: Pending → Active

---

## 7. Social Feed (Venue-Based)

### Features:
- Venue-specific feed
- Match post with **Photo A VS Photo B** layout
- Score repost option
- Comments & interactions
- Report & moderation system

---

## 8. Marketplace

### Features:
- Sports product listing
- Cart & checkout
- Order tracking
- Inventory management via admin

---

## 9. Notifications
- Booking confirmations
- Team-up invites
- Membership activation
- Tournament alerts
- Push notifications

---

## 10. Admin Panel (Web)

### 10.1 Dashboard
- Today’s bookings
- Revenue overview
- Upcoming matches
- Active memberships

### 10.2 Booking Management
- Calendar view
- Slot blocking
- Accept / Reject bookings

### 10.3 Membership Management
- Create/edit plans
- Activate memberships
- Member list

### 10.4 Financials
- Booking revenue
- Membership revenue
- Convenience fee tracking
- Invoice export

### 10.5 Staff Management
- Add staff & trainers
- Salary & expense tracking

### 10.6 Social Feed Moderation
- Review reported posts
- Ban users
- Remove content

### 10.7 Tournament Manager
- Create tournaments
- Team registration
- Match schedules

### 10.8 CRM (Super Admin)
- Venue onboarding
- User analytics
- Dispute management

---

## 11. Payment & Business Rules

1. Booking amount → Venue account
2. Membership fee → Venue account
3. Platform commission → Play Time
4. Convenience fee (₹100 first-time) → Play Time
5. Refunds based on cancellation policy

---

## 12. Technical Architecture

### Frontend
- Mobile: Flutter or React Native
- Admin: React + Tailwind / Ant Design

### Backend
- Firebase

### Database
- Firestore

### Storage
- AWS S3 (images)

### Payments
- Offline payment confirmations

---

## 13. Data Models (Summary)

- Users
- Venues
- Courts
- Bookings
- Memberships
- TeamBoxes
- Posts
- Reports
- Products & Orders

---

## 14. Security & Compliance
- OTP-based authentication
- Role-based access control
- Secure payment handling
- Data privacy controls

---

## 15. Testing & QA
- Booking race condition tests
- Payment flow tests
- UI automation tests
- Load testing

---

## 16. Deployment
- CI/CD pipelines
- Cloud hosting (AWS / GCP)
- CDN-enabled assets

---

## 17. Future Enhancements
- Player ratings
- AI match suggestions
- Coach booking
- Corporate memberships
- Multi-language support (Tamil)

---

## 18. MVP Scope (Phase 1)
- Venue discovery
- Booking & payment
- Membership activation
- Basic social feed
- Admin booking management

---

## ✅ End of Document

**Play Time – Built to Play, Connect, and Compete** 🏆

