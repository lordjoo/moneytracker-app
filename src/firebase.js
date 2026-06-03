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
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : undefined),
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

export async function signInWithGoogle() {
  return signInWithPopup(auth, provider);
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
