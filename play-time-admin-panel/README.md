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

## 📋 Project Status

See [Implementation Progress](./docs/planning/IMPLEMENTATION_PROGRESS.md) for current status.

## 🏗️ Project Structure

```
play-time-admin-panel/
├── components/          # React components
├── contexts/            # React contexts (Auth, Toast, etc.)
├── hooks/               # Custom React hooks
├── pages/               # Page components
├── services/            # Service layer (Firebase, APIs)
├── utils/               # Utility functions
├── config/              # Configuration files
├── public/              # Public assets
├── scripts/             # Utility scripts
├── docs/                # Documentation
│   ├── implementations/ # Feature implementation docs
│   ├── guides/          # Setup and how-to guides
│   ├── planning/        # Planning and progress docs
│   └── firebase/        # Firebase-specific docs
├── firestore.rules      # Firestore security rules
├── firestore.indexes.json # Firestore indexes
├── storage.rules        # Storage security rules
└── firebase.json        # Firebase configuration
```

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
- ✅ Export Functionality (CSV, PDF)
- ✅ Invoice PDF Generation
- ✅ Image Upload & Management

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
