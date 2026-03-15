# 📁 File Organization

**Date**: 2024-12-19 (updated for component subfolders)  
**Status**: ✅ Complete

---

## Overview

All project files have been organized into a logical directory structure for better maintainability and navigation.

---

## 📂 Directory Structure

### Root Directory
Contains essential configuration and source files:
- `package.json` - Project dependencies
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Vite build configuration
- `tailwind.config.cjs` - Tailwind CSS configuration
- `firebase.json` - Firebase project configuration
- `firestore.rules` - Firestore security rules
- `firestore.indexes.json` - Firestore database indexes
- `storage.rules` - Firebase Storage security rules
- `index.html` - HTML entry point
- `index.tsx` - React entry point
- `App.tsx` - Main app component
- `types.ts` - TypeScript type definitions
- `README.md` - Project README

### `/components/`
React UI components, grouped into subfolders:

#### `/components/layout/`
Layout and app shell:
- `Sidebar.tsx`, `Header.tsx` - Main layout
- `ProtectedRoute.tsx`, `VenueProtectedRoute.tsx` - Route guards
- `ErrorBoundary.tsx`, `ToastContainer.tsx` - Error and toast UI

#### `/components/modals/`
All modal/dialog components (30 files):
- BookingDetailsModal, VenueFormModal, UserFormModal, CourtFormModal
- CreateInvoiceModal, TournamentFormModal, SportManagementModal, etc.

#### `/components/shared/`
Reusable UI and form primitives:
- `DatePicker.tsx`, `DateRangePicker.tsx` - Date inputs
- `GoogleMapPicker.tsx` - Map location picker
- `ImageUpload.tsx`, `LoadingSpinner.tsx` - Common UI

### `/pages/`
Page components (routes):
- Dashboard, Bookings, Venues, Memberships
- Financials, Staff, Users
- Settings, Notifications, Payments
- CRM, Analytics, Marketing, etc.

### `/hooks/`
Custom React hooks:
- Data fetching hooks (useBookings, useVenues, etc.)
- Feature hooks (useAnalytics, useFCMToken, etc.)
- Utility hooks (useErrorHandler, useGoogleMaps, etc.)

### `/services/`
Service layer:
- `firebase.ts` - Firebase service
- `paymentService.ts` - Payment processing
- `razorpayService.ts` - Razorpay integration
- `notificationService.ts` - Notification handling
- `whatsappService.ts` - WhatsApp integration
- `invoiceService.ts` - Invoice management

### `/contexts/`
React Context providers:
- `AuthContext.tsx` - Authentication context
- `ToastContext.tsx` - Toast notifications context
- `HeaderActionsContext.tsx` - Header actions context

### `/utils/`
Utility functions:
- `formatUtils.ts` - Formatting utilities
- `dateUtils.ts` - Date manipulation utilities
- `errorUtils.ts` - Error handling utilities
- `exportUtils.ts` - Export functionality (CSV, PDF)
- `imageUtils.ts` - Image processing utilities
- `analyticsUtils.ts` - Analytics calculation utilities
- `serviceWorkerRegistration.ts` - Service worker registration

### `/config/`
Configuration files:
- `firebase.config.ts` - Firebase configuration helper

### `/public/`
Public assets:
- `firebase-messaging-sw.js` - Firebase Cloud Messaging service worker

### `/scripts/`
Utility scripts:
- `create-admin-user.js` - Create admin user script
- `list-users.js` - List users script
- `update-user-role.js` - Update user role script

### `/docs/`
**All documentation organized by category:**

#### `/docs/implementations/`
Feature implementation documentation (18 files):
- AUTH_IMPLEMENTATION.md
- BOOKINGS_IMPLEMENTATION.md
- COURT_MANAGEMENT_IMPLEMENTATION.md
- DASHBOARD_IMPLEMENTATION.md
- ERROR_HANDLING_IMPLEMENTATION.md
- EXPORT_FUNCTIONALITY_IMPLEMENTATION.md
- FCM_IMPLEMENTATION.md
- FINANCIALS_IMPLEMENTATION.md
- IMAGE_UPLOAD_IMPLEMENTATION.md
- INVOICE_PDF_IMPLEMENTATION.md
- MEMBERSHIPS_IMPLEMENTATION.md
- MODERATION_IMPLEMENTATION.md
- PAYMENT_SYSTEM_IMPLEMENTATION.md
- STAFF_MANAGEMENT_IMPLEMENTATION.md
- TOURNAMENTS_IMPLEMENTATION.md
- VENUES_IMPLEMENTATION.md
- WHATSAPP_INTEGRATION.md
- ADVANCED_ANALYTICS_IMPLEMENTATION.md

#### `/docs/guides/`
Setup and how-to guides (10 files):
- CREATE_ADMIN_USER.md
- ENV_SETUP.md
- FIREBASE_DEPLOYMENT.md
- FIREBASE_ERRORS_FIX.md
- get-firebase-config.md
- README_ENV.md
- ROLE_BASED_ACCESS.md
- SETUP_INSTRUCTIONS.md
- VENUE_PAYMENT_SETTINGS_GUIDE.md
- RAZORPAY_INTEGRATION.md

#### `/docs/planning/`
Planning and progress tracking (6 files):
- ACTION_PLAN_SUMMARY.md
- COMPREHENSIVE_MISSING_FEATURES_PLAN.md
- IMPLEMENTATION_PROGRESS.md
- IMPLEMENTATION_SUMMARY.md
- MISSING_FEATURES_ANALYSIS.md
- PAYMENT_SYSTEM_PLAN.md

#### `/docs/firebase/`
Firebase-specific documentation (2 files):
- FIREBASE_DEPLOYMENT_SUMMARY.md
- INDEX_BUILD_STATUS.md

#### `/docs/from-root/`
Legacy copies of docs that were previously in the project root (see `from-root/README.md`). Prefer the canonical versions in `implementations/`, `guides/`, etc.

#### `/docs/README.md`
Documentation index and navigation guide

---

## 📊 File Count Summary

- **Implementation Docs**: 18 files
- **Setup Guides**: 10 files
- **Planning Docs**: 6 files
- **Firebase Docs**: 2 files
- **Total Documentation**: 36 files organized

---

## 🔍 Finding Files

### Looking for Implementation Details?
→ Check `/docs/implementations/`

### Need Setup Instructions?
→ Check `/docs/guides/`

### Want to See Project Status?
→ Check `/docs/planning/`

### Firebase Configuration?
→ Check `/docs/firebase/`

---

## ✅ Benefits of Organization

1. **Clear Structure**: Easy to find relevant documentation
2. **Better Navigation**: Logical grouping by purpose
3. **Maintainability**: Easier to update and manage docs
4. **Onboarding**: New developers can quickly find what they need
5. **Clean Root**: Root directory is clean and focused

---

## 📝 Notes

- All documentation files have been moved from root to `/docs/`
- Root directory now only contains essential project files
- Documentation structure is self-documenting
- All file paths in documentation have been preserved (relative paths work)

---

**Organization Status**: ✅ Complete  
**Total Files Organized**: 36 documentation files

