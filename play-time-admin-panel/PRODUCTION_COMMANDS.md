# Production commands – Play Time Admin Panel

Use these on your **live server** or for **deploying** backend Firebase resources.

---

## Build (production)

Create the production bundle (output in `dist/`):

```bash
npm run build
```

- Uses **Vite** to build.
- Output: `dist/` — deploy this folder to your own server/domain (e.g. `playtime.jodtech.in`).
- Firebase Hosting is **not** used for the admin UI.

---

## Preview production build locally

Build and serve the production build on your machine:

```bash
npm run preview
```

Or build then preview:

```bash
npm run preview:prod
```

- Default URL: `http://localhost:4173` (or the port Vite prints).
- Use this to test the production build before deploying to your server.

---

## Deploy Firebase backend only

**Firestore rules + Storage rules + Functions:**

```bash
npm run deploy
```

**Only rules** (Firestore + Storage):

```bash
npm run deploy:rules
```

**Only Cloud Functions:**

```bash
npm run deploy:functions
```

- These do **not** deploy the admin website.
- Requires Firebase CLI: `npm i -g firebase-tools` and `firebase login`.

### Required Cloud Function secrets

Before deploying `functions`, set env vars in `functions/.env` (or Secret Manager), for example:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `ALLOWED_ORIGINS` (optional CORS allow-list for admin endpoints)

---

## Run on your production server

Serve the **built** files. Do **not** run `npm run dev` in production.

1. Build:

   ```bash
   npm run build
   ```

2. Serve `dist/` with your server (Nginx, Apache, IIS, PM2 + static server, etc.):

   ```bash
   npx serve -s dist -l 3000
   ```

---

## Summary table

| Command                    | Purpose                                              |
|----------------------------|------------------------------------------------------|
| `npm run build`            | Production build → `dist/` (for your own host)       |
| `npm run preview`          | Serve `dist/` locally (no build)                     |
| `npm run preview:prod`     | Build then serve `dist/` locally                     |
| `npm run deploy`           | Deploy Firestore rules, Storage rules, Functions     |
| `npm run deploy:rules`     | Deploy only Firestore + Storage rules                |
| `npm run deploy:functions` | Deploy only Cloud Functions                          |

---

## Development (reference)

```bash
npm run dev
```
