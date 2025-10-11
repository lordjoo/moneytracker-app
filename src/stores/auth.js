import { defineStore } from 'pinia';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser } from '@/firebase';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    status: 'idle',
    initialized: false,
    _unsubscribe: null
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user),
    displayName: (state) => state.user?.displayName ?? 'Guest',
    photoURL: (state) => state.user?.photoURL
  },
  actions: {
    async init() {
      if (this.initialized) return;

      console.log('[AuthStore] Initializing auth store...');
      this.status = 'loading';

      await new Promise((resolve) => {
        this._unsubscribe = onAuthStateChanged(auth, (user) => {
          console.log('[AuthStore] Auth state changed:', {
            uid: user?.uid,
            email: user?.email,
            isAuthenticated: !!user
          });
          this.user = user;
          this.status = 'ready';
          this.initialized = true;
          resolve(user);
        });
      });
    },
    async signIn() {
      console.log('[AuthStore] Sign-in requested');
      this.status = 'authenticating';
      try {
        await signInWithGoogle();
        console.log('[AuthStore] Sign-in completed');
      } catch (error) {
        console.error('[AuthStore] Sign-in error:', error);
        throw error;
      } finally {
        this.status = 'ready';
      }
    },
    async signOut() {
      await signOutUser();
      this.user = null;
    },
    teardown() {
      if (this._unsubscribe) {
        this._unsubscribe();
        this._unsubscribe = null;
      }
      this.initialized = false;
      this.user = null;
    }
  }
});
