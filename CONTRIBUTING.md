# Contributing

Thanks for helping improve MyMoney Tracker. This project is intentionally local-first, so data safety matters more than clever abstractions.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Use your own Firebase web app values in `.env`. Do not commit `.env`, production secrets, exported backups, screenshots, or generated browser profiles.

## Before Opening A PR

Run the full local check:

```bash
npm run lint
npm run test
npm run build
```

For UI changes, also open the app in a browser and check a desktop width and a mobile width around 390px.

## Code Guidelines

- Keep changes scoped to the bug or feature.
- Prefer small Pinia store helpers over duplicating data rules inside views.
- Add or update Vitest coverage for balance math, dates, sync, backup payloads, or household permissions.
- Keep Firebase auth domain handling runtime-friendly; the app may run on more than one domain.
- Do not add `.old`, `.backup`, generated, or AI-dump files to `src/`.
- Do not silently replace local data from cloud data. Sync conflict paths must remain explicit.

## PWA Checklist

When changing install behavior, verify:

- `npm run build` generates `dist/manifest.webmanifest` and `dist/sw.js`.
- Manifest icons are real PNG files at 192px and 512px or larger.
- The browser receives a service worker controller on localhost or HTTPS.
- The install card in `More` shows the prompt when `beforeinstallprompt` is available.
