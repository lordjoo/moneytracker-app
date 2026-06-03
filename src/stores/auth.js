import { defineStore } from 'pinia';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  completePasswordlessSignIn,
  hasEmailSignInLink,
  resolveGoogleRedirect,
  sendPasswordlessSignInLink,
  signInWithGoogle,
  signOutUser
} from '@/firebase';

let initPromise = null;
const AUTH_INIT_TIMEOUT_MS = 8000;

function authErrorMessage(error, fallback = 'Authentication failed.') {
  if (error?.code === 'auth/unauthorized-domain') return 'This domain must be added to Firebase Authentication authorized domains.';
  if (error?.code === 'auth/operation-not-allowed') return 'Enable this sign-in method in Firebase Authentication.';
  if (error?.code === 'auth/network-request-failed') return 'Network error. Please check your connection and try again.';
  if (error?.code === 'auth/popup-blocked') return 'Your browser blocked the Google sign-in popup. Allow popups for this site and try again.';
  if (error?.code === 'auth/popup-closed-by-user') return 'Google sign-in was closed before it finished.';
  if (error?.code === 'auth/cancelled-popup-request') return 'Another Google sign-in attempt was already in progress.';
  if (error?.code === 'auth/web-storage-unsupported') return 'This browser mode blocks the storage Firebase needs for sign-in.';
  if (error?.code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (error?.code === 'auth/invalid-action-code') return 'This sign-in link has expired. Send a new link and try again.';
  if (error?.code === 'auth/expired-action-code') return 'This sign-in link has expired. Send a new link and try again.';
  if (error?.code === 'auth/too-many-requests') return 'Too many attempts. Please wait a bit and try again.';
  return error?.message ?? fallback;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    status: 'idle',
    initialized: false,
    lastError: '',
    _unsubscribe: null
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user),
    displayName: (state) => state.user?.displayName ?? 'Guest',
    photoURL: (state) => state.user?.photoURL
  },
  actions: {
    async init() {
      if (this.initialized) return this.user;
      if (initPromise) return initPromise;

      initPromise = this.initAuth();
      return initPromise;
    },
    async initAuth() {
      if (this._unsubscribe) {
        this._unsubscribe();
        this._unsubscribe = null;
      }

      this.status = 'loading';
      this.lastError = '';

      try {
        if (typeof window !== 'undefined' && hasEmailSignInLink(window.location.href)) {
          this.status = 'authenticating';
          await completePasswordlessSignIn(window.location.href);
        }

        await resolveGoogleRedirect();
      } catch (error) {
        console.error('[AuthStore] Pending auth completion failed:', error);
        this.lastError = authErrorMessage(error, 'Could not complete sign-in.');
      }

      return new Promise((resolve) => {
        let settled = false;
        const finish = (user = null) => {
          if (settled) return;
          settled = true;
          this.user = user;
          this.status = 'ready';
          this.initialized = true;
          resolve(user);
        };
        const timeoutId = setTimeout(() => {
          console.warn('[AuthStore] Auth state observer timed out; continuing without a signed-in user.');
          this.lastError = 'Sign-in is taking longer than expected. You can keep using local data and try again from Settings.';
          finish(null);
        }, AUTH_INIT_TIMEOUT_MS);
        this._unsubscribe = onAuthStateChanged(
          auth,
          (user) => {
            clearTimeout(timeoutId);
            finish(user);
          },
          (error) => {
            clearTimeout(timeoutId);
            console.error('[AuthStore] Auth state observer failed:', error);
            this.lastError = authErrorMessage(error);
            finish(null);
          }
        );
      }).finally(() => {
        initPromise = null;
      });
    },
    async completePendingSignIn() {
      this.status = 'authenticating';
      this.lastError = '';
      try {
        if (typeof window !== 'undefined' && hasEmailSignInLink(window.location.href)) {
          await completePasswordlessSignIn(window.location.href);
        } else {
          await resolveGoogleRedirect();
        }
      } catch (error) {
        console.error('[AuthStore] Pending sign-in error:', error);
        this.lastError = authErrorMessage(error, 'Could not complete sign-in.');
        throw error;
      } finally {
        this.status = 'ready';
      }
    },
    async waitForReady() {
      if (this.initialized) return this.user;
      return this.init();
    },
    async signIn() {
      this.status = 'authenticating';
      this.lastError = '';
      try {
        await signInWithGoogle();
      } catch (error) {
        console.error('[AuthStore] Google sign-in error:', error);
        this.lastError = authErrorMessage(error, 'Google sign-in failed.');
        this.status = 'ready';
        throw error;
      }
    },
    async sendEmailLink(email) {
      this.status = 'authenticating';
      this.lastError = '';
      try {
        await sendPasswordlessSignInLink(email);
      } catch (error) {
        console.error('[AuthStore] Passwordless email link error:', error);
        this.lastError = authErrorMessage(error, 'Could not send sign-in link.');
        throw error;
      } finally {
        this.status = 'ready';
      }
    },
    async signOut() {
      this.lastError = '';
      await signOutUser();
      this.user = null;
    },
    teardown() {
      if (this._unsubscribe) {
        this._unsubscribe();
        this._unsubscribe = null;
      }
      initPromise = null;
      this.initialized = false;
      this.user = null;
      this.status = 'idle';
    }
  }
});
