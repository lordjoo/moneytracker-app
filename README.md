# MyMoney Tracker

A mobile-first Progressive Web App built with Vue 3, Pinia, and Firebase for tracking spending, savings, and transfers across multiple accounts. Tailwind CSS + DaisyUI provide rapid styling, while Headless UI powers accessible overlays. Firestore persists accounts, transactions, and category metadata; Google Sign-In handles authentication.

## Features

- 📱 **Mobile-first** layout with responsive navigation and bottom action bar.
- 🔐 **Google Sign-In** via Firebase Authentication; per-user Firestore data isolation.
- 🧾 **Accounts & cycles**: create multiple accounts with opening balance auto-transaction, editable names/cycles, and safe closing when finished.
- 💸 **Transactions**: credit, debit, and transfer flows update account balances atomically using Firestore transactions.
- 🗂️ **Categories**: default income/expense categories with CRUD management and customizable icons (preset library or emoji).
- 📊 **Dashboard insights**: total net worth, monthly spend vs. last month, savings delta, top spending categories, and recent activity.
- 🔄 **Background sync + offline** thanks to Firestore polling (no long-lived listeners), queued writes, and the PWA service worker.

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure Firebase**
   - Create a Firebase project with Authentication (Google provider) and Firestore enabled.
   - Copy `.env.example` to `.env` and populate the `VITE_FIREBASE_*` values from the Firebase console.

3. **Run locally**
   ```bash
   npm run dev
   ```
   Vite will print a local development URL. Open it in a browser, sign in with Google, and start adding accounts.

4. **Build for production**
   ```bash
   npm run build
   npm run preview
   ```

## Project Structure

```
src/
  firebase.js          # Firebase initialization + auth helpers
  main.js              # Vite entry: mounts app, registers PWA
  pwa.js               # Service worker registration helper
  layouts/AppShell.vue # Application shell with navigation + theme toggle
  router/index.js      # Route definitions + auth guard
  stores/              # Pinia stores: auth, accounts, transactions, categories
  views/               # Feature views (Dashboard, Accounts, Transactions, etc.)
  styles.css           # Tailwind entry file
public/
  icons/               # Placeholder PWA icons (replace with branded artwork)
```

## Firebase Data Model

_All documents live under `users/{uid}/...` to ensure per-user isolation._

- `accounts/{accountId}`: `{ name, balance, cycleDay, isClosed, closedAt, createdAt, updatedAt }`
- `transactions/{transactionId}`: `{ type, direction?, accountId, counterpartyAccountId?, amount, categoryId, note, occurredAt, createdAt, updatedAt }`
- `categories/{categoryId}`: `{ name, type ('income' | 'expense'), icon, createdAt, updatedAt }`

Opening balances are stored as `type: 'credit', subtype: 'opening-balance'` transactions for auditing.

## Theming & Styling

- Tailwind CSS 3.4 with DaisyUI theme `mymoney` plus light/dark fallbacks.
- Theme toggle switches between custom theme and dark mode by mutating `data-theme` (DaisyUI convention).
- Headless UI dialogs deliver accessible modals for account, transaction, and category forms.

## Offline & PWA Notes

- Firestore IndexedDB persistence caches data locally; writes enqueue while offline and sync automatically when reconnected.
- Background polling (15s for accounts/transactions, 30s for categories) replaces realtime listeners to avoid WebChannel errors.
- UI surfaces offline/queued states so you know when balances or transactions are still syncing.
- Configured via `vite-plugin-pwa` with auto-updating service worker.
- Replace placeholder icons in `public/icons/` with 64/192/512px PNGs.
- When testing in development, install prompts require HTTPS or localhost.

## Next Steps

- Configure Firestore security rules to scope reads/writes to the authenticated user ID.
- Add unit tests (e.g., Vitest + Vue Test Utils) for store logic, especially transaction balancing.
- Extend dashboards with charts (e.g., Chart.js) for spend/savings visualisations.
- Add sync error handling/notifications for rare Firestore rejection cases.
- Optionally create composite indexes (e.g., `transactions` ordered by `occurredAt/createdAt`) once data volume grows.

## License

MIT
