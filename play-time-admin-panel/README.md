# Play Time Admin Panel

Admin panel for managing Play Time sports booking platform.

## 📚 Documentation

All documentation has been organized in the `/docs` directory:

- **Implementation Docs**: `/docs/implementations/` - Feature implementation details
- **Setup Guides**: `/docs/guides/` - Setup and configuration guides
- **Planning Docs**: `/docs/planning/` - Project planning and progress tracking
- **Firebase Docs**: `/docs/firebase/` - Firebase-specific documentation

See [Documentation README](./docs/README.md) for complete documentation index.

## 🚀 Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment**:
   - See [Environment Setup](./docs/guides/ENV_SETUP.md)
   - Create `.env` file with Firebase credentials

3. **Create admin user**:
   - See [Create Admin User](./docs/guides/CREATE_ADMIN_USER.md)

4. **Start development**:
   ```bash
   npm run dev
   ```

## 🚢 Production

- **Build**: `npm run build` → output in `dist/`
- **Preview build locally**: `npm run preview` or `npm run preview:prod`
- **Deploy to Firebase**: `npm run deploy` (full) or `npm run deploy:hosting` (app only)

See **[PRODUCTION_COMMANDS.md](./PRODUCTION_COMMANDS.md)** for full production and deploy commands.

## 🔄 CI/CD (GitHub Actions)

From the **repository root** (Playtime):

- **CI** (`.github/workflows/ci.yml`): On every push/PR to `main` or `develop`, runs:
  - **Admin**: `npm ci` and `npm run build` in `play-time-admin-panel`
  - **Mobile**: `flutter pub get`, `flutter analyze`, `flutter test` in `play_time_mobile`
- **Deploy** (`.github/workflows/deploy.yml`): On push to `main`, builds the admin panel and deploys to Firebase Hosting. Requires repo secrets: `FIREBASE_TOKEN` (from `firebase login:ci`) and all `VITE_FIREBASE_*` vars (same as `.env.example`). Add them in GitHub → Settings → Secrets and variables → Actions.

## 📋 Project Status

See [Implementation Progress](./docs/planning/IMPLEMENTATION_PROGRESS.md) for current status.

## 🏗️ Project Structure

```
play-time-admin-panel/
├── components/          # React components
│   ├── layout/          # Sidebar, Header, ProtectedRoute, ErrorBoundary, Toast
│   ├── modals/          # All modal/dialog components
│   └── shared/         # DatePicker, ImageUpload, GoogleMapPicker, LoadingSpinner
├── contexts/            # React contexts (Auth, Toast, etc.)
├── hooks/               # Custom React hooks
├── pages/               # Page components (routes)
├── services/            # Service layer (Firebase, APIs)
├── utils/               # Utility functions
├── config/              # Configuration files
├── public/              # Public assets
├── scripts/             # Utility scripts
├── docs/                # Documentation
│   ├── implementations/ # Feature implementation docs
│   ├── guides/          # Setup and how-to guides
│   ├── planning/        # Planning and progress docs
│   ├── firebase/        # Firebase-specific docs
│   └── from-root/       # Legacy copies moved from root
├── firestore.rules      # Firestore security rules
├── firestore.indexes.json # Firestore indexes
├── storage.rules        # Storage security rules
└── firebase.json        # Firebase configuration
```

See **[FILE_ORGANIZATION.md](./FILE_ORGANIZATION.md)** for a full map of where to put and find files.

## 🔑 Key Features

- ✅ Authentication (Email/Password, Google, Phone OTP)
- ✅ Role-Based Access Control (Super Admin, Venue Manager)
- ✅ Bookings Management
- ✅ Venues & Courts Management
- ✅ Memberships Management
- ✅ Financials & Payments
- ✅ Staff Management
- ✅ Push Notifications (FCM)
- ✅ WhatsApp Integration
- ✅ Advanced Analytics
- ✅ Export Functionality (CSV, PDF) — Bookings, Users, Memberships, CRM, Financials; exports are **download-only** (generated in the browser, no server storage).
- ✅ Invoice PDF Generation
- ✅ Image Upload & Management

## ⌨️ Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+N** / **Cmd+N** | New booking (on Bookings page) |
| **Ctrl+S** / **Cmd+S** | Save form (in User form modal when open) |
| **Escape** | Close modal (User form modal) |

*More shortcuts may be added in modals (e.g. save with Ctrl+S).*

## 📖 Documentation Quick Links

### Getting Started
- [Setup Instructions](./docs/guides/SETUP_INSTRUCTIONS.md)
- [Environment Setup](./docs/guides/ENV_SETUP.md)
- [Create Admin User](./docs/guides/CREATE_ADMIN_USER.md)

### Implementation Status
- [Implementation Progress](./docs/planning/IMPLEMENTATION_PROGRESS.md)
- [Action Plan Summary](./docs/planning/ACTION_PLAN_SUMMARY.md)

### Feature Documentation
- [Authentication](./docs/implementations/AUTH_IMPLEMENTATION.md)
- [Bookings](./docs/implementations/BOOKINGS_IMPLEMENTATION.md)
- [Venues](./docs/implementations/VENUES_IMPLEMENTATION.md)
- [Payments](./docs/implementations/PAYMENT_SYSTEM_IMPLEMENTATION.md)
- [FCM Notifications](./docs/implementations/FCM_IMPLEMENTATION.md)
- [WhatsApp Integration](./docs/implementations/WHATSAPP_INTEGRATION.md)
- [Advanced Analytics](./docs/implementations/ADVANCED_ANALYTICS_IMPLEMENTATION.md)
- [Image Upload](./docs/implementations/IMAGE_UPLOAD_IMPLEMENTATION.md)

### Firebase
- [Firebase Deployment](./docs/guides/FIREBASE_DEPLOYMENT.md)
- [Deployment Summary](./docs/firebase/FIREBASE_DEPLOYMENT_SUMMARY.md)

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Firestore, Storage, Auth, FCM)
- **Charts**: Recharts
- **PDF**: jsPDF
- **Build**: Vite

## 📝 License

Proprietary - Play Time Platform
