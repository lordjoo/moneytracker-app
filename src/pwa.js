export function registerSW() {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('[PWA] New content available. Prompting user to update...');
        if (confirm('New content available. Reload?')) {
          updateSW(true);
        }
      },
      onOfflineReady() {
        console.info('[PWA] MyMoney app is ready to work offline.');
      },
      onRegistered(registration) {
        console.log('[PWA] Service Worker registered successfully');
        
        // Check for updates periodically (every hour)
        if (registration) {
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);
        }
      },
      onRegisterError(error) {
        console.error('[PWA] Service Worker registration failed:', error);
      }
    });
  }).catch((error) => {
    console.error('[PWA] Failed to load SW registration module:', error);
  });
}

// Log PWA installation status
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('[PWA] Install prompt available');
    // Store the event for later use
    window.deferredPrompt = e;
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
  });

  // Detect if running as standalone PWA
  if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('[PWA] Running as standalone app');
  }
  
  // Detect if running on iOS in standalone mode
  if (window.navigator.standalone) {
    console.log('[PWA] Running as iOS standalone app');
  }
}
