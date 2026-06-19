import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  persistentSingleTabManager
} from 'firebase/firestore';

const env = import.meta.env ?? {};
const projectId = env.VITE_FIREBASE_PROJECT_ID;

const CONFIGURED_AUTH_DOMAIN =
  env.VITE_FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : undefined);

// Extra domains (beyond the Firebase defaults) that serve both this app and the
// Firebase /__/auth/ helper — typically custom domains connected to this Hosting
// project. Comma-separated, e.g. "app.example.com,money.example.com".
const APP_DOMAINS = String(env.VITE_FIREBASE_APP_DOMAINS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

/**
 * Resolve the authDomain to use for Google popup/redirect sign-in.
 *
 * Firebase serves the /__/auth/ handler on EVERY Hosting domain of the project
 * (the default *.web.app and *.firebaseapp.com domains, plus any connected
 * custom domain). `signInWithPopup` only works reliably when that handler is
 * SAME-ORIGIN as the app: otherwise the popup is cross-origin and modern
 * browsers (Chrome third-party storage partitioning, Safari ITP) break the
 * handshake, leaving the user signed in on the authDomain origin instead of the
 * origin they are actually using — exactly the "logged in on the firebase
 * domain only" / "popup shows the app with no sign-up" symptoms.
 *
 * So when the app is being served from one of the project's Firebase-hosted
 * domains, use that current host as the authDomain (same-origin handler). Fall
 * back to the statically configured authDomain for localhost/dev or any host we
 * can't vouch for.
 *
 * NOTE: every host returned here must be listed under Firebase Authentication →
 * Settings → Authorized domains. The default *.web.app / *.firebaseapp.com
 * domains are authorized automatically; custom domains in VITE_FIREBASE_APP_DOMAINS
 * must be added there too.
 */
function resolveAuthDomain() {
  if (typeof window === 'undefined') return CONFIGURED_AUTH_DOMAIN;
  const host = window.location.hostname.toLowerCase();
  const isFirebaseDefaultDomain = host.endsWith('.web.app') || host.endsWith('.firebaseapp.com');
  if (isFirebaseDefaultDomain || APP_DOMAINS.includes(host)) {
    // window.location.host keeps any port (none in production).
    return window.location.host;
  }
  return CONFIGURED_AUTH_DOMAIN;
}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: resolveAuthDomain(),
  projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID
};

if (!firebaseConfig.apiKey) {
  console.warn('Firebase configuration is missing. Populate the .env file to enable data sync.');
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
let auth;
if (typeof window === 'undefined') {
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
      popupRedirectResolver: browserPopupRedirectResolver
    });
  } catch (error) {
    if (error?.code !== 'auth/already-initialized') {
      throw error;
    }
    auth = getAuth(app);
  }
}
auth.useDeviceLanguage();

let db;
let persistenceStatus = 'disabled';

function isFirestoreAlreadyInitialized(error) {
  return String(error?.message ?? '').includes('initializeFirestore() has already been called');
}

if (typeof window !== 'undefined') {
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
    persistenceStatus = 'enabled';
  } catch (error) {
    if (isFirestoreAlreadyInitialized(error)) {
      db = getFirestore(app);
      persistenceStatus = 'enabled';
    } else if (error.code === 'failed-precondition') {
      try {
        db = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentSingleTabManager()
          })
        });
        persistenceStatus = 'enabled';
      } catch (singleError) {
        if (isFirestoreAlreadyInitialized(singleError)) {
          db = getFirestore(app);
          persistenceStatus = 'enabled';
        } else {
          console.warn('IndexedDB persistence unavailable; falling back to memory cache.', singleError);
          db = initializeFirestore(app, {
            localCache: memoryLocalCache()
          });
          persistenceStatus = 'disabled';
        }
      }
    } else if (error.code === 'unimplemented') {
      console.warn('Browser does not support IndexedDB persistence. Using in-memory cache.');
      db = initializeFirestore(app, {
        localCache: memoryLocalCache()
      });
      persistenceStatus = 'disabled';
    } else {
      console.error('Failed to configure Firestore persistence, using default settings.', error);
      db = getFirestore(app);
      persistenceStatus = 'disabled';
    }
  }
} else {
  db = getFirestore(app);
}

const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: 'select_account'
});
const EMAIL_LINK_STORAGE_KEY = 'mymoney:emailForSignIn';
const AUTH_RETURN_PATH = '/settings/backup';

function currentOrigin() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function authReturnUrl() {
  const origin = currentOrigin();
  return origin ? new URL(AUTH_RETURN_PATH, origin).toString() : AUTH_RETURN_PATH;
}

function cleanAuthUrl() {
  if (typeof window === 'undefined') return;
  window.history.replaceState({}, document.title, AUTH_RETURN_PATH);
}

export { app, auth, db };
export function getPersistenceStatus() {
  return persistenceStatus;
}

// Popups can't be used in some environments (blocked, or in-app/embedded
// browsers like Instagram/Facebook webviews). Fall back to a full-page redirect
// there; the result is consumed on the next load by resolveGoogleRedirect().
const POPUP_TO_REDIRECT_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment'
]);

export async function signInWithGoogle() {
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (POPUP_TO_REDIRECT_CODES.has(error?.code)) {
      await signInWithRedirect(auth, provider);
      return null; // sign-in completes after the redirect returns
    }
    throw error;
  }
}

export async function resolveGoogleRedirect() {
  return getRedirectResult(auth);
}

export async function sendPasswordlessSignInLink(email) {
  const normalizedEmail = String(email ?? '').trim();
  if (!normalizedEmail) {
    throw new Error('Enter your email address.');
  }
  const actionCodeSettings = {
    url: authReturnUrl(),
    handleCodeInApp: true
  };
  await sendSignInLinkToEmail(auth, normalizedEmail, actionCodeSettings);
  window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, normalizedEmail);
}

export function hasEmailSignInLink(url = window.location.href) {
  return isSignInWithEmailLink(auth, url);
}

export async function completePasswordlessSignIn(url = window.location.href) {
  if (!hasEmailSignInLink(url)) return null;
  let email = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
  if (!email) {
    email = window.prompt('Confirm the email address you used for sign-in');
  }
  if (!email) {
    throw new Error('Email is required to complete sign-in.');
  }
  const result = await signInWithEmailLink(auth, email, url);
  window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
  cleanAuthUrl();
  return result;
}

export async function signOutUser() {
  await signOut(auth);
}
