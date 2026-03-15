# 📁 File organization – Play Time Admin Panel

Quick reference for where everything lives. Full details: [docs/FILE_ORGANIZATION.md](./docs/FILE_ORGANIZATION.md).

---

## Root

| Item | Purpose |
|------|--------|
| `App.tsx`, `index.tsx`, `index.html`, `index.css` | App entry and shell |
| `types.ts` | Shared TypeScript types |
| `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.cjs`, `postcss.config.js` | Build and tool config |
| `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `storage.rules` | Firebase config |
| `README.md`, `PRODUCTION_COMMANDS.md` | Docs (root) |

---

## Source folders

| Folder | Contents |
|--------|----------|
| **`components/layout/`** | Sidebar, Header, ProtectedRoute, ErrorBoundary, ToastContainer |
| **`components/modals/`** | All modal/dialog components (30 files) |
| **`components/shared/`** | DatePicker, DateRangePicker, ImageUpload, GoogleMapPicker, LoadingSpinner |
| **`pages/`** | Route page components (Dashboard, Bookings, Venues, …) |
| **`hooks/`** | Custom React hooks (useBookings, useVenues, …) |
| **`services/`** | Firebase, payments, notifications, invoice, WhatsApp |
| **`contexts/`** | Auth, Toast, Theme, HeaderActions, VenueTwoStepAuth |
| **`utils/`** | formatUtils, dateUtils, imageUtils, exportUtils, etc. |
| **`config/`** | firebase.config.ts |

---

## Other

| Folder | Contents |
|--------|----------|
| **`public/`** | Static assets, firebase-messaging-sw.js |
| **`scripts/`** | create-admin-user, initialize-sports, list-users, update-user-role |
| **`functions/`** | Firebase Cloud Functions |
| **`docs/`** | All documentation (guides, implementations, planning, firebase, from-root) |

---

**Where to put new files**

- New modal → `components/modals/`
- New layout piece → `components/layout/`
- New reusable UI (dates, uploads, etc.) → `components/shared/`
- New page/route → `pages/`
- New data hook → `hooks/`
- New API or backend logic → `services/`
- New doc → `docs/guides/` or `docs/implementations/` (see docs/README.md)
