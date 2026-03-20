# Play Time — User Manual

**Version 1.0 | March 2026**

*This file is bundled with the admin panel (also mirrored at the monorepo root as `USER_MANUAL.md` when present). In the **Play Time Admin Panel**, open **User manual** in the sidebar (or go to `#/user-manual`) to read this guide in the browser.*

Play Time is a mobile-first sports booking platform for Tamil Nadu, India. It lets players discover nearby turfs and courts, book slots, join teams, buy memberships, and socialise — while giving venue owners and the Play Time team powerful tools to manage everything.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [User Roles](#2-user-roles)
3. [Mobile App — Player Guide](#3-mobile-app--player-guide)
   - 3.1 [Getting Started](#31-getting-started)
   - 3.2 [Discovering Venues](#32-discovering-venues)
   - 3.3 [Booking a Court or Slot](#33-booking-a-court-or-slot)
   - 3.4 [Team-Up Feature](#34-team-up-feature)
   - 3.5 [Memberships](#35-memberships)
   - 3.6 [Social Feed](#36-social-feed)
   - 3.7 [Marketplace](#37-marketplace)
   - 3.8 [Notifications](#38-notifications)
   - 3.9 [Profile & Settings](#39-profile--settings)
4. [Admin Panel — Venue Manager Guide](#4-admin-panel--venue-manager-guide)
   - 4.1 [Accessing the Panel](#41-accessing-the-panel)
   - 4.2 [Dashboard](#42-dashboard)
   - 4.3 [Bookings](#43-bookings)
   - 4.4 [Court Management](#44-court-management)
   - 4.5 [Memberships](#45-memberships)
   - 4.6 [Staff Management](#46-staff-management)
   - 4.7 [Financials](#47-financials)
   - 4.8 [Quick Matches](#48-quick-matches)
   - 4.9 [Flash Deals](#49-flash-deals)
   - 4.10 [Support](#410-support)
   - 4.11 [Notifications](#411-notifications)
5. [Admin Panel — Super Admin Guide](#5-admin-panel--super-admin-guide)
   - 5.1 [Venue Management & Onboarding](#51-venue-management--onboarding)
   - 5.2 [User Management](#52-user-management)
   - 5.3 [Tournaments](#53-tournaments)
   - 5.4 [Leaderboards & Polls](#54-leaderboards--polls)
   - 5.5 [Marketplace Management](#55-marketplace-management)
   - 5.6 [Moderation](#56-moderation)
   - 5.7 [CRM & Analytics](#57-crm--analytics)
   - 5.8 [Payments](#58-payments)
   - 5.9 [Marketing](#59-marketing)
   - 5.10 [Frontend CMS](#510-frontend-cms)
   - 5.11 [Role & Permission Management](#511-role--permission-management)
   - 5.12 [Settings](#512-settings)
   - 5.13 [Activity Log](#513-activity-log)
6. [Payments & Business Rules](#6-payments--business-rules)
7. [FAQ](#7-faq)
8. [Troubleshooting](#8-troubleshooting)
9. [Glossary](#9-glossary)

---

## 1. Introduction

**Play Time** is a sports booking and community platform built for players and venue owners across Tamil Nadu. It supports:

- **Players** — Find nearby courts, book slots, form teams, buy memberships, and engage in post-match social feeds.
- **Venue Managers** — Manage bookings, courts, staff, memberships, and finances from a web-based admin panel.
- **Super Admins (Play Time Team)** — Oversee the entire platform: approve venues, manage tournaments, moderate content, and track platform revenue.

**Supported Sports:** Badminton, Cricket, Football (more coming in future phases)

**Platforms:**
- Android & iOS mobile app (Flutter)
- Web admin panel (React + Firebase)

---

## 2. User Roles

| Role | Who | Access |
|------|-----|--------|
| **Player** | Anyone who downloads the app | Discover, book, join teams, buy memberships, social feed |
| **Venue Manager** | Venue owner or appointed staff | Admin panel — their venue's bookings, courts, members, finances, staff |
| **Super Admin** | Play Time internal team | Full admin panel access including all venues, users, tournaments, platform settings |

---

## 3. Mobile App — Player Guide

### 3.1 Getting Started

#### Installation
1. Download **Play Time** from the Google Play Store (Android) or App Store (iOS).
2. Open the app. You will see the onboarding screens briefly.

#### Login / Sign Up
Play Time supports two login methods:

**Phone Number (OTP):**
1. On the Login screen, enter your 10-digit Indian mobile number.
2. Tap **Send OTP**.
3. Enter the 6-digit OTP you receive via SMS.
4. You are logged in. If it's your first time, you'll be prompted to complete your profile.

**Google Sign-In:**
1. Tap **Continue with Google**.
2. Select your Google account.
3. You are logged in.

> **Note:** Your phone number must be a valid 10-digit Indian number (no country code needed — the app adds +91 automatically).

#### First-Time Setup
After your first login, complete your profile:
- Full name
- Gender
- Date of birth

These details help the platform match you for team-up requests.

---

### 3.2 Discovering Venues

The **Home Screen** shows venues near you.

**How it works:**
1. On first use, allow location permissions when prompted. This enables GPS-based venue discovery.
2. Venues are listed by default sorted by **rating**.
3. Use the **search bar** at the top to search by venue name.
4. Use the **category filters** (All, Badminton, Cricket, Football, etc.) to filter by sport.
5. Tap the **filter icon** to apply advanced filters:
   - Maximum price per hour
   - Specific amenities (e.g. parking, changing rooms)
   - Membership-only venues
   - Sort by rating, distance, or price

**Map View:**
- Tap the map icon in the top bar to switch to map view and see venues plotted near your location.

**Venue Detail:**
Tap any venue card to open its detail page, which shows:
- Photos, amenities, and rules
- Available courts and sports
- Pricing per slot
- Membership plans offered
- Reviews and ratings

**Favourites:**
Tap the heart icon on any venue card to save it to your favourites for quick access.

---

### 3.3 Booking a Court or Slot

**Booking Flow:**
1. Open a venue's detail page.
2. Tap **Book Now** or select a specific court.
3. Choose your sport (Badminton / Cricket / Football).
4. Select the **date** and **time slot**.
5. Choose between:
   - **Full Court** — book the entire court for yourself
   - **Slot Booking** — book an individual slot (you may share the court)
6. Review the booking summary (court, time, price, convenience fee).
7. Tap **Confirm & Pay**.
8. Complete payment via Razorpay.

**Booking Confirmation:**
- After payment, you'll receive a **Booking Pass** with a QR code.
- Access your booking pass anytime from the **Bookings** screen (bottom navigation).
- You'll also receive a push notification confirming the booking.

**Cancellation:**
- Open the booking in the **Bookings** screen.
- Tap **Cancel Booking**.
- Refund eligibility depends on how far in advance you cancel (see [Section 6](#6-payments--business-rules)).

---

### 3.4 Team-Up Feature

Team-Up lets you fill open slots in a court booking by connecting with other players.

**For Badminton:**
- **2-player box** — 1 vs 1
- **4-player box** — 2 vs 2

Each slot in a Team-Up box shows gender tags (M/F) so you can find the right match.

**Joining an existing Team-Up:**
1. On a venue's booking screen, look for slots marked **Team-Up Available**.
2. Tap the slot to see open positions.
3. Tap **Join** on a position that matches you.
4. Pay your share of the slot cost.
5. You're confirmed — you'll get a booking pass.

**Creating a Team-Up:**
1. When booking a slot, toggle **Enable Team-Up**.
2. Set the number of open positions and gender tags.
3. Complete your booking. Other players can now find and join your slot.

**Leaving a Team-Up:**
- Open the booking in the **Bookings** screen.
- Tap **Leave Team-Up**. Refund rules apply.

---

### 3.5 Memberships

Memberships give you access to discounted or unlimited bookings at a specific venue.

**Purchasing a Membership:**
1. Open a venue's detail page.
2. Tap **Memberships**.
3. Choose a plan (Monthly / 6 Months / Annual).
4. Tap **Buy Membership** and complete payment.
5. Your membership status will show as **Pending Activation**.

**Activation:**
The venue manager must manually activate your membership. Once activated, you'll receive a notification and your status changes to **Active**. This is typically done within 24 hours.

**Viewing Your Memberships:**
- Go to **Profile** → **My Memberships** to see all active and past memberships.

---

### 3.6 Social Feed

Each venue has its own social feed where players share match results and highlights.

**Viewing the Feed:**
- Tap **Feed** from the bottom navigation or from a venue's detail page.
- Posts are shown in a match format: **Photo A vs Photo B** with player names and scores.

**Creating a Post:**
1. Tap the **+** button on the Feed screen.
2. Upload photos for both sides (Player A and Player B).
3. Enter player names, sport, and score.
4. Tap **Post**.

**Interactions:**
- **Repost** — share a match result to your profile.
- **Comment** — leave a comment on a post.

**Reporting Content:**
- Tap the three-dot menu on any post.
- Select **Report** and choose a reason.
- The Play Time moderation team will review the report.

---

### 3.7 Marketplace

The Marketplace lets you browse and purchase sports products.

**Browsing Products:**
1. Tap **Marketplace** from the bottom navigation.
2. Browse by category or search by product name.
3. Tap a product to view details, images, and pricing.

**Placing an Order:**
1. Tap **Add to Cart** on a product.
2. Go to your **Cart** (cart icon, top right).
3. Review items and tap **Checkout**.
4. Enter delivery details and complete payment.

**Tracking Orders:**
- Go to **Profile** → **My Orders** to view order status and tracking.

---

### 3.8 Notifications

You'll receive push notifications for:
- Booking confirmations and reminders
- Team-Up join requests and confirmations
- Membership activation by venue
- Tournament updates and invites
- Flash deal alerts

**Managing Notifications:**
- Tap the bell icon in the top bar to view all notifications.
- Go to **Profile** → **Settings** → **Notifications** to manage what types of notifications you receive.

---

### 3.9 Profile & Settings

**Accessing your profile:**
Tap the **Profile** icon in the bottom navigation.

**What you can manage:**
- Profile photo, name, gender, date of birth
- My Bookings history
- My Memberships
- My Orders
- Team Preferences (sports you play, availability)
- Privacy Settings (who can see your profile)
- Language Settings (English; Tamil coming in a future update)
- Help & Support (raise a ticket or browse FAQs)

**Signing Out:**
- Go to **Profile** → scroll to the bottom → tap **Sign Out**.

---

## 4. Admin Panel — Venue Manager Guide

The Play Time Admin Panel is a web application for managing your venue.

**URL:** Open your browser and go to the admin panel URL provided by the Play Time team.

### 4.1 Accessing the Panel

1. Go to the admin panel URL.
2. On the landing page, click **Login**.
3. Enter your email and password (set up by the Play Time team when your venue was onboarded).
4. You'll be directed to your venue's **Dashboard**.

> **Venue Two-Step Auth:** On first login to a specific venue, you may be asked to confirm your venue identity. Follow the on-screen prompts.

**Switching Between Light and Dark Mode:**
Click the sun/moon icon in the top-right header bar to toggle themes.

---

### 4.2 Dashboard

The Dashboard is your at-a-glance overview of your venue's activity.

**What you'll see:**
- **Today's Bookings** — count and revenue for today
- **Pending Bookings** — bookings awaiting your confirmation
- **Active Memberships** — current active member count
- **Revenue Overview** — chart showing booking and membership revenue
- **Upcoming Matches** — next few bookings
- **Recent Sign-ups** — newest players who joined the platform

**Date Range Filter:**
Use the buttons at the top of the Dashboard to switch between Today / This Week / This Month / Custom Date Range.

---

### 4.3 Bookings

Navigate to **Bookings** in the sidebar.

**Views:**
- **Day view** — see bookings for a single day hour-by-hour
- **Week view** — see the full week's bookings
- **Month view** — calendar-style monthly overview

**Filters:**
- Filter by Sport, Venue, or Status (Pending / Confirmed / Cancelled / Completed)
- Use the date picker to jump to any date

**Accepting or Rejecting a Booking:**
1. Click on a booking to open the Booking Details modal.
2. Review the player name, court, time, and payment status.
3. Click **Confirm** to accept or **Cancel** to reject.
4. The player will be notified automatically.

**Bulk Actions:**
- Check multiple bookings using the checkboxes on the left.
- Use the **Bulk Actions** dropdown to confirm or cancel multiple bookings at once.

**Exporting:**
- Click the **Export** button (top right) to download bookings as CSV or PDF.

---

### 4.4 Court Management

Navigate to **Courts** in the sidebar (under your venue).

**Adding a Court:**
1. Click **+ Add Court**.
2. Enter court name, sport type, capacity, and pricing per slot.
3. Set operating hours and available time slots.
4. Save.

**Editing a Court:**
1. Click on an existing court's name.
2. Update details in the Court Management modal.
3. Save changes.

**Blocking Slots:**
- Open a court and select a date/time range.
- Click **Block Slot** to prevent bookings (e.g. for maintenance).

---

### 4.5 Memberships

Navigate to **Memberships** in the sidebar.

**Creating a Membership Plan:**
1. Click **+ Add Plan**.
2. Enter plan name (e.g. "Monthly Badminton"), duration, price, and benefits.
3. Specify which courts the plan applies to.
4. Save. The plan is now visible to players in the mobile app.

**Activating a Member:**
1. In the **Members** tab, find the member with **Pending** status.
2. Click the three-dot menu → **Activate Membership**.
3. The member's status changes to **Active** and they receive a push notification.

**Filtering & Exporting:**
- Filter the member list by plan type or status.
- Export the member list as CSV or PDF.

---

### 4.6 Staff Management

Navigate to **Staff** in the sidebar.

**Adding a Staff Member:**
1. Click **+ Add Staff**.
2. Enter name, role (e.g. Coach, Receptionist, Maintenance), contact details, and salary.
3. Save.

**Tracking Expenses:**
- Each staff entry tracks their monthly salary.
- Add one-off expenses under the **Expenses** tab.
- The Financials page aggregates these for you.

---

### 4.7 Financials

Navigate to **Financials** in the sidebar.

**What you can see:**
- **Booking Revenue** — total confirmed booking income for the selected period
- **Membership Revenue** — income from membership sales
- **Convenience Fee** tracking — the ₹100 first-time fee collected by Play Time
- **Platform Commission** — amount deducted by Play Time
- **Net Payout** — what's settled to your bank account

**Date Range:** Use the date range picker at the top to change the reporting period.

**Exporting Invoices:**
- Click **Export** → **PDF Invoice** or **CSV** to download financial reports.

---

### 4.8 Quick Matches

Navigate to **Quick Matches** in the sidebar.

Quick Matches are casual, open matches that players can discover and join without a full booking.

**Creating a Quick Match:**
1. Click **+ New Quick Match**.
2. Set the sport, court, date/time, number of open slots, and any entry requirements.
3. Publish. Players can see and join from the mobile app.

**Managing Participants:**
- View who has joined and remove/add players from the participants list.

---

### 4.9 Flash Deals

Navigate to **Flash Deals** in the sidebar.

Flash Deals let you offer time-limited discounts on court bookings to attract players during off-peak hours.

**Creating a Flash Deal:**
1. Click **+ New Deal**.
2. Select the court and time slot, set the discounted price and deal expiry time.
3. Publish. Players receive a push notification about the deal.

**Managing Active Deals:**
- View all live deals and their redemption count.
- Click a deal to edit or deactivate it early.

---

### 4.10 Support

Navigate to **Support** in the sidebar.

View support tickets raised by players about your venue. Respond to queries directly from the admin panel.

**Ticket Statuses:**
- **Open** — awaiting a response
- **In Progress** — being handled
- **Resolved** — issue closed

Click any ticket to view the full conversation and reply.

---

### 4.11 Notifications

Navigate to **Notifications** in the sidebar.

Send push notifications to your venue's members or all players in your area.

**Sending a Notification:**
1. Click **+ New Notification**.
2. Choose the audience (All Members / Specific Plan Members / All Nearby Players).
3. Write the notification title and message.
4. Tap **Send Now** or schedule for a specific date and time.

---

## 5. Admin Panel — Super Admin Guide

Super Admins have access to all sections of the admin panel across all venues.

### 5.1 Venue Management & Onboarding

Navigate to **Venues** in the sidebar.

**Viewing All Venues:**
- See the full list of registered venues with status (Active / Pending / Suspended).

**Approving a New Venue:**
1. Venues with **Pending** status are awaiting approval.
2. Click the venue name to open its detail page.
3. Review the submitted information (location, courts, documents).
4. Click **Approve** or **Reject** with a reason.

**Editing a Venue:**
- Open the venue detail page and update name, location, status, or assigned managers.

---

### 5.2 User Management

Navigate to **Users** in the sidebar.

**Viewing Users:**
- Search by name, phone, or email.
- Filter by role (Player / Venue Manager / Super Admin).

**User Detail:**
Click a user to see their full profile, booking history, memberships, and activity.

**Actions:**
- Suspend or ban a user.
- Change a user's role.
- View their activity log.

---

### 5.3 Tournaments

Navigate to **Tournaments** in the sidebar.

**Creating a Tournament:**
1. Click **+ New Tournament**.
2. Enter tournament name, sport, venue, dates, format (knockout / round-robin), and registration fee.
3. Set the maximum number of teams.
4. Save and publish.

**Managing Teams:**
- Once players register, view all registered teams under the tournament.
- Use the Team Registration modal to add teams manually if needed.

**Scheduling Matches:**
- Open a tournament → **Matches** tab.
- Use the Match Management modal to set fixture dates, times, courts, and scores.
- Published schedules are visible to players in the mobile app.

**Tournament Detail:**
Navigate to **Tournaments** → click a tournament name for the full detail view including bracket, results, and team standings.

---

### 5.4 Leaderboards & Polls

**Leaderboards** (navigate to **Leaderboards** in sidebar):
- View and manage player/team rankings across sports.
- Rankings are calculated from match results.

**Polls** (navigate to **Polls** in sidebar):
- Create polls visible to all app users (e.g. "Which sport should we add next?").
- Click **+ New Poll**, add the question and options, and set an expiry date.
- View results once the poll closes.

---

### 5.5 Marketplace Management

Navigate to **Marketplace** in the sidebar.

**Adding a Product:**
1. Click **+ Add Product**.
2. Enter product name, category, description, price, stock quantity, and photos.
3. Save. The product is now visible to players.

**Managing Orders:**
- View all incoming orders in the **Orders** tab.
- Open an order to view details and update fulfilment status (Pending → Processing → Shipped → Delivered).

**Categories:**
- Manage product categories from the Category Management modal.

---

### 5.6 Moderation

Navigate to **Moderation** in the sidebar.

**Reviewing Reports:**
- See all player-reported posts from the social feed.
- Click a report to view the original post and the reason given.

**Actions:**
- **Dismiss** — mark as safe, no action.
- **Remove Post** — delete the post from the feed.
- **Ban User** — suspend the user's account.

All moderation actions are logged in the Activity Log.

---

### 5.7 CRM & Analytics

**CRM** (navigate to **CRM** in sidebar):
- View all registered users, their booking history, membership status, and lifetime value.
- Manage venue onboarding and dispute resolution.
- Tag and segment users for targeted notifications.

**Analytics** (navigate to **Analytics** in sidebar):
- Platform-wide revenue charts (booking vs membership vs marketplace).
- Venue performance comparison.
- User growth and retention metrics.
- Date range selector for custom reporting periods.

---

### 5.8 Payments

Navigate to **Payments** in the sidebar.

- View all platform-level payment transactions.
- Filter by payment method, venue, date range, or status.
- Track convenience fees and platform commission separately.
- Initiate or view settlement status for venue payouts.

---

### 5.9 Marketing

Navigate to **Marketing** in the sidebar.

- Create and manage promotional banners shown on the app home screen.
- Set up referral campaigns and promo codes.
- Track campaign performance (impressions, redemptions, revenue impact).

---

### 5.10 Frontend CMS

Navigate to **Frontend CMS** in the sidebar.

Manage the content shown on the public landing page (the page visitors see before logging in).

- Edit page sections (hero text, feature descriptions, testimonials).
- Update images and call-to-action buttons.
- Preview changes before publishing.
- Manage static pages (Privacy Policy, Terms of Service, etc.) accessible via `/page/:slug`.

---

### 5.11 Role & Permission Management

**Roles** (navigate to **Users** → **Roles**):
- Create custom roles with specific sets of permissions.
- Assign roles to admin panel users.

**Permissions** (navigate to **Users** → **Permissions**):
- Fine-grained control over which actions each role can perform (e.g. a "Finance Viewer" role with read-only access to Financials).
- Changes take effect immediately on next login.

---

### 5.12 Settings

Navigate to **Settings** in the sidebar. (Super Admin only)

Configure platform-wide settings:

| Section | What to configure |
|---------|-------------------|
| **General** | App name, logo, description, timezone, currency, support email/phone |
| **Business Rules** | Convenience fee (₹), platform commission (%), cancellation window (hours), booking buffer (minutes) |
| **Booking Settings** | Max advance booking days, min/max booking duration, auto-confirm bookings, require venue approval, same-day bookings toggle, refund policy & percentage |
| **Payment Settings** | Razorpay API keys, settlement frequency, minimum payout amount, auto-settlement toggle, tax rate, GST toggle |
| **Integrations** | Razorpay configuration, WhatsApp Business API |

**Saving Settings:**
Make changes in any section and click **Save Settings** at the bottom of the page.

---

### 5.13 Activity Log

Navigate to **Activity Log** in the sidebar. (Super Admin only)

A full audit trail of all admin actions across the platform:
- Which admin did what action
- Timestamp
- Affected record (booking ID, user ID, etc.)

Use this for compliance audits, debugging, or investigating disputes.

---

## 6. Payments & Business Rules

### How Payments Work

| Flow | Who receives it |
|------|----------------|
| Booking amount | Venue's account |
| Membership fee | Venue's account |
| Platform commission | Play Time (deducted from venue payout) |
| Convenience fee (₹100 on first booking) | Play Time |
| Marketplace sales | Play Time (venue/supplier settlement per agreement) |

**Payment Gateway:** Razorpay (configured by Super Admin in Settings)

### Cancellation & Refund Policy

The exact refund percentages are configured by the Super Admin in **Settings → Business Rules**. The default policy:

- Cancel **> cancellation window hours** before the slot → full refund
- Cancel **within the cancellation window** → partial or no refund (as configured)
- **No-show** → no refund

### Convenience Fee

A ₹100 convenience fee is charged on a player's **first-ever booking** on the platform. This goes to Play Time.

### Settlement

Venue payouts are settled on the frequency configured in Settings (e.g. weekly or monthly). The minimum payout amount is also configurable.

---

## 7. FAQ

**Q: I didn't receive my OTP. What do I do?**
A: Wait 30 seconds and tap **Resend OTP**. Make sure you have network connectivity. If the problem persists, check that you entered the correct 10-digit mobile number.

**Q: My membership shows "Pending". When will it be activated?**
A: The venue manager must manually activate your membership. This typically happens within 24 hours. If it's been longer, contact the venue directly or raise a support ticket in the app under **Profile → Help & Support**.

**Q: Can I cancel a booking?**
A: Yes. Open the booking in the **Bookings** screen and tap **Cancel Booking**. Refund eligibility depends on the cancellation window configured by the venue.

**Q: How do I join a Team-Up slot?**
A: On the booking screen for a court, look for slots with a **Team-Up** badge. Tap the slot, see the open positions, and tap **Join**. You'll pay only your share of the total slot cost.

**Q: I can't log in to the admin panel.**
A: Make sure you're using the email and password set up by the Play Time team. If you've forgotten your password, use the **Forgot Password** link on the login page. If you don't have access at all, contact the Play Time support team.

**Q: How do I add a new admin user for my venue?**
A: Only Super Admins can create new admin accounts. Contact the Play Time team to add a staff member as a Venue Manager.

**Q: A player reported incorrect match results on the social feed. Can I fix it?**
A: As a Venue Manager, you can't directly edit posts. Ask the player who created the post to delete and re-post. If the post is harmful or misleading, report it yourself or use the Moderation panel (Super Admins only).

**Q: How do I export my monthly revenue report?**
A: Go to **Financials** → set the date range to the desired month → click **Export → PDF Invoice** or **CSV**.

**Q: Is there a Tamil language option?**
A: Tamil language support is planned for a future release. The current app is in English only.

---

## 8. Troubleshooting

### Mobile App

| Problem | Solution |
|---------|---------|
| App won't open / crashes on launch | Force-close the app and reopen. If it persists, uninstall and reinstall. |
| Location not working / venues not showing | Ensure location permissions are enabled for Play Time in your phone settings. |
| Payment failed | Check your internet connection. Try again. If your account was charged but the booking wasn't created, the refund will be processed automatically within 5–7 business days. Contact support if it doesn't arrive. |
| Push notifications not arriving | Check that notifications are enabled for Play Time in your phone settings. Also check **Profile → Settings → Notifications** in the app. |
| Offline / "No connection" banner | The app shows an offline banner when there's no internet. Most features require connectivity. Booking passes are cached locally and viewable offline. |
| OTP not received | Check network signal. Ensure the number you entered is correct. Try the Resend OTP button after 30 seconds. |

### Admin Panel

| Problem | Solution |
|---------|---------|
| Blank page / nothing loading | Refresh the browser. Clear your browser cache (Ctrl+Shift+R on Windows). |
| "Session expired" message | Your session timed out. Refresh and log in again. |
| Bookings not updating in real-time | The panel uses live Firestore data. If data looks stale, refresh the page. |
| Export (CSV/PDF) not downloading | Ensure your browser allows file downloads from the admin panel domain. Check your browser's download settings. |
| Can't access a page (redirected away) | You may not have permission for that page. Contact a Super Admin to check your role permissions. |
| Settings not saving | Ensure all required fields are filled. Check for validation errors highlighted in red. |

### Checking Logs (Super Admin)
- Use the **Activity Log** in the sidebar for a record of all admin actions.
- For technical issues, check the Firebase Console or contact the Play Time development team.

---

## 9. Glossary

| Term | Meaning |
|------|---------|
| **Slot** | A specific time block at a court available for booking (e.g. 6:00 PM – 7:00 PM) |
| **Full Court Booking** | Renting the entire court for exclusive use during a time slot |
| **Team-Up** | A feature that lets multiple players share a court by booking individual positions |
| **Team Box** | A group of open player positions in a Team-Up slot |
| **Membership** | A recurring subscription at a specific venue giving discounted or unlimited access |
| **Flash Deal** | A time-limited discounted court booking created by a venue manager |
| **Quick Match** | A casual open match created by the venue that players can discover and join |
| **Venue Manager** | An admin panel user who manages a specific venue |
| **Super Admin** | A Play Time team member with full access to the platform |
| **Convenience Fee** | A ₹100 one-time fee charged to a player on their first booking |
| **Platform Commission** | A percentage of booking/membership revenue retained by Play Time |
| **OTP** | One-Time Password — the 6-digit code sent to your phone to verify identity |
| **Firestore** | The cloud database that powers Play Time (Firebase / Google) |
| **Razorpay** | The payment gateway used for processing bookings and membership payments |
| **CMS** | Content Management System — the tool for editing the public landing page content |
| **CRM** | Customer Relationship Management — tools for managing and analysing user data |

---

*Play Time — Built to Play, Connect, and Compete*

*For support, contact the Play Time team via the Help & Support section in the app or the Support page in the admin panel.*
