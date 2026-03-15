# Production commands – Play Time Admin Panel

Use these on your **live server** or for **deploying** the admin panel.

---

## Build (production)

Create the production bundle (output in `dist/`):

```bash
npm run build
```

- Uses **Vite** to build.
- Output: `dist/` (used by Firebase Hosting).

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
- Use this to test the production build before deploying.

---

## Deploy to Firebase

**Full deploy** (Hosting + Firestore rules + Storage rules + Functions):

```bash
npm run deploy
```

**Only Hosting** (admin panel app):

```bash
npm run deploy:hosting
```

- Both commands run `npm run build` first, then deploy.
- Requires Firebase CLI: `npm i -g firebase-tools` and `firebase login`.

---

## Run in production mode on the server (Node)

To run the app in “production” on the server (e.g. with PM2 or plain Node), you still serve the **built** files. You do **not** run `npm run dev` in production.

1. Build once (or after each update):

   ```bash
   npm run build
   ```

2. Serve the `dist/` folder with a static server, e.g.:

   ```bash
   npx serve -s dist -l 3000
   ```

   Or use your server’s static hosting (Nginx, Apache, etc.) pointing to `dist/`.

---

## Summary table

| Command                 | Purpose                                      |
|-------------------------|----------------------------------------------|
| `npm run build`         | Production build → `dist/`                   |
| `npm run preview`       | Serve `dist/` locally (no build)             |
| `npm run preview:prod`  | Build then serve `dist/` locally             |
| `npm run deploy`        | Build + deploy everything to Firebase        |
| `npm run deploy:hosting`| Build + deploy only Hosting (admin app)     |

---

## Development (reference)

- **Local dev**: `npm run dev` (Vite dev server, e.g. http://localhost:3000)
- **One-off scripts**: `npm run create-admin`, `npm run initialize-sports`, etc. (see `package.json` scripts).
