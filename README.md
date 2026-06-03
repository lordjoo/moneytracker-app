# MyMoney Tracker

MyMoney Tracker is a local-first Vue 3 PWA for tracking accounts, spending, transfers, budgets, recurring items, goals, and household money rules. Data lives in browser storage first. Firebase Authentication and Firestore provide optional account sign-in and whole-app backup sync.

## Features

- Mobile-first PWA with install prompts, offline service worker caching, and real 64/180/192/512px app icons.
- Firebase Authentication with passwordless email links and Google sign-in.
- Manual Firebase backup sync with metadata checks, conflict detection, and explicit force actions.
- Local JSON export from Settings so users can keep a device-owned copy before cloud operations.
- Accounts, categories, transactions, recurring rules, budgets, goals, household roles, and month close controls.
- Currency conversion via ExchangeRate-API latest rates, using a user-provided API key stored locally.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure Firebase:

   ```bash
   cp .env.example .env
   ```

   Fill the `VITE_FIREBASE_*` values from your Firebase web app. Enable Firestore, Google sign-in, and Email link sign-in in Firebase Authentication.

3. Run locally:

   ```bash
   npm run dev
   ```

4. Build and preview production output:

   ```bash
   npm run build
   npm run preview
   ```

## Scripts

- `npm run dev` starts Vite.
- `npm run lint` runs ESLint.
- `npm run test` runs Vitest store and utility tests.
- `npm run build` builds the production PWA and service worker.

## Project Map

```text
src/
  firebase.js                  Firebase app, Auth, Firestore, and sign-in helpers
  pwa.js                       Service worker registration and install prompt events
  layouts/AppShell.vue         Shared navigation, theme, sync banner
  stores/                      Pinia stores for app domains
  utils/backupService.js       Firebase backup payloads, fingerprints, local export
  views/                       Route-level screens
  components/settings/         Backup, currency, household, and month settings
public/icons/                  PWA icon assets used by the manifest
```

## Sync Model

The app is local-first. Store changes are written to browser storage immediately and marked dirty. Firebase sync is a manual backup flow:

- `Push to Firebase` uploads the full local backup.
- `Pull from Firebase` replaces local data with the cloud backup.
- If local and cloud fingerprints both changed, normal push/pull is blocked.
- In a conflict, export local JSON first, then use the explicit force action in Settings.

## Currency Conversion

Currency settings live in the app under `Settings -> Currency`. The app calls:

```text
https://v6.exchangerate-api.com/v6/{key}/latest/USD
```

Rates are cached in browser storage for one hour.

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR. The short version: keep changes focused, add tests for store/data behavior, run lint/test/build, and avoid adding generated backup files or large rewrites that are not tied to a bug or feature.

## License

MIT
