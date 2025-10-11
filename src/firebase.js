import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

if (!firebaseConfig.apiKey) {
  console.warn('Firebase configuration is missing. Populate the .env file to enable data sync.');
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.useDeviceLanguage();

let db;
let persistenceStatus = 'disabled';

if (typeof window !== 'undefined') {
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
    persistenceStatus = 'enabled';
  } catch (error) {
    if (error.code === 'failed-precondition') {
      try {
        db = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentSingleTabManager()
          })
        });
        persistenceStatus = 'enabled';
      } catch (singleError) {
        console.warn('IndexedDB persistence unavailable; falling back to memory cache.', singleError);
        db = initializeFirestore(app, {
          localCache: memoryLocalCache()
        });
        persistenceStatus = 'disabled';
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

// Check for redirect result on app load
if (typeof window !== 'undefined') {
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        console.log('[Auth] Redirect sign-in completed:', {
          uid: result.user?.uid,
          email: result.user?.email,
          displayName: result.user?.displayName
        });
      } else {
        console.log('[Auth] No redirect result found (normal for popup flow or first load)');
      }
    })
    .catch((error) => {
      console.error('[Auth] Redirect sign-in error:', {
        code: error.code,
        message: error.message,
        details: error
      });
    });
}

export { app, auth, db };
export function getPersistenceStatus() {
  return persistenceStatus;
}

export async function signInWithGoogle() {
  console.log('[Auth] Starting Google sign-in...');
  console.log('[Auth] Environment check:', {
    apiKey: firebaseConfig.apiKey ? '✓ Present' : '✗ Missing',
    authDomain: firebaseConfig.authDomain || '✗ Missing',
    projectId: firebaseConfig.projectId || '✗ Missing',
    standalone: window.matchMedia('(display-mode: standalone)').matches,
    windowWidth: window.innerWidth,
    userAgent: navigator.userAgent
  });

  const useRedirect = window.matchMedia('(display-mode: standalone)').matches || window.innerWidth < 768;
  console.log(`[Auth] Using ${useRedirect ? 'redirect' : 'popup'} flow`);

  try {
    if (useRedirect) {
      console.log('[Auth] Initiating redirect sign-in...');
      await signInWithRedirect(auth, provider);
      console.log('[Auth] Redirect initiated (user will be redirected)');
      return;
    }

    console.log('[Auth] Initiating popup sign-in...');
    const result = await signInWithPopup(auth, provider);
    console.log('[Auth] Popup sign-in successful:', {
      uid: result.user?.uid,
      email: result.user?.email,
      displayName: result.user?.displayName
    });
  } catch (error) {
    console.error('[Auth] Sign-in failed:', {
      code: error.code,
      message: error.message,
      details: error
    });
    throw error;
  }
}

export async function signOutUser() {
  await signOut(auth);
}
