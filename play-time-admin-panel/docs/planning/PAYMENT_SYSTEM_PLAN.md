# 💳 Payment System Implementation Plan

## Overview

The Play Time platform uses a **dual payment system**:
1. **Online Payments**: Users → Venues (via Razorpay)
2. **Offline Payments**: Venues → Platform (manual settlement)

---

## Payment Flow Architecture

### 1. Online Payment Flow (User → Venue)

```
User Books/Membership
    ↓
Razorpay Payment Gateway
    ↓
Payment Success → Venue Account (Direct)
    ↓
Platform Calculates:
  - Commission (5%)
  - Convenience Fee (₹100 first-time)
    ↓
Invoice Generated for Venue
    ↓
Venue Pays Platform Offline
```

### 2. Offline Payment Flow (Venue → Platform)

```
Platform Generates Invoice
    ↓
Venue Receives Invoice
    ↓
Venue Pays Offline (Bank Transfer/Cash/UPI)
    ↓
Super Admin Confirms Payment
    ↓
Invoice Status: Paid
    ↓
Settlement Recorded
```

---

## Data Models Required

### Payment Record
- Track all payments (online and offline)
- Link to bookings/memberships/invoices
- Store payment method, transaction ID, gateway details

### Payment Settlement
- Track venue-to-platform payments
- Link to invoices
- Store payment confirmation details

---

## Implementation Steps

1. **Create Payment Types & Interfaces**
   - Payment model for online payments
   - Settlement model for offline payments
   - Payment status tracking

2. **Update Booking & Membership Models**
   - Add payment transaction ID
   - Add payment gateway details
   - Add payment method

3. **Create Payment Service**
   - Track online payments
   - Track offline payments
   - Payment status updates

4. **Create Payment Management UI**
   - View all payments
   - Filter by type (online/offline)
   - Payment status management
   - Settlement confirmation

5. **Update Financials Page**
   - Show payment status
   - Link payments to transactions
   - Settlement tracking

6. **Create Settlement Management**
   - Venue payment tracking
   - Payment confirmation
   - Receipt upload (optional)

---

## Business Rules

### Online Payments (User → Venue)
- Payment goes directly to venue Razorpay account
- Platform calculates commission and convenience fee
- Invoice generated automatically
- Payment status: Pending → Paid → Refunded

### Offline Payments (Venue → Platform)
- Invoice generated for commission + convenience fees
- Venue pays via bank transfer/cash/UPI
- Super Admin confirms payment
- Settlement recorded

### Commission Calculation
- Booking: 5% of booking amount
- Membership: 5% of membership price
- Convenience Fee: ₹100 per first-time booking

### Settlement Period
- Can be daily, weekly, or monthly
- Venues receive invoices
- Payments tracked manually

---

## Security Considerations

1. Payment data encryption
2. Transaction ID validation
3. Payment status verification
4. Audit trail for all payments
5. Role-based access (only Super Admin can confirm settlements)

---

## Files to Create/Update

1. `types.ts` - Add Payment and Settlement interfaces
2. `services/firebase.ts` - Add payments and settlements collections
3. `hooks/usePayments.ts` - Payment data fetching
4. `hooks/useSettlements.ts` - Settlement management
5. `pages/Payments.tsx` - Payment management page
6. `components/PaymentDetailsModal.tsx` - Payment details view
7. `components/SettlementConfirmationModal.tsx` - Confirm offline payments
8. `firestore.rules` - Payment access rules
9. `firestore.indexes.json` - Payment query indexes

---

## User Stories

### As a Super Admin:
- I want to see all online payments from users
- I want to generate invoices for venues
- I want to confirm offline payments from venues
- I want to track payment settlements
- I want to view payment reports

### As a Venue Manager:
- I want to see payments for my bookings/memberships
- I want to see invoices I need to pay
- I want to track my payment status

---

## Success Criteria

✅ All online payments tracked with transaction IDs
✅ Offline payments can be confirmed by Super Admin
✅ Invoices generated automatically
✅ Payment status visible in Financials page
✅ Settlement tracking functional
✅ Payment reports exportable

