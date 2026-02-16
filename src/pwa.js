export function registerSW() {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('[PWA] New content available. Applying update...');
        updateSW(true);
      },
      onOfflineReady() {
        console.info('[PWA] MyMoney app is ready to work offline.');
      },
      onRegistered(registration) {
        console.log('[PWA] Service Worker registered successfully');

        // Check for updates periodically (every hour)
        if (registration) {
          registration.update();
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

function emitInstallAvailability(promptEvent = null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('pwa-install-available', {
      detail: {
        prompt: promptEvent,
        isStandalone:
          window.matchMedia('(display-mode: standalone)').matches ||
          Boolean(window.navigator.standalone)
      }
    })
  );
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    console.log('[PWA] Install prompt available');
    window.deferredPrompt = e;
    emitInstallAvailability(e);
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    window.deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  });

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches || Boolean(window.navigator.standalone);
  if (isStandalone) {
    console.log('[PWA] Running as standalone app');
  }

  if (window.navigator.standalone) {
    console.log('[PWA] Running as iOS standalone app');
  }

  emitInstallAvailability(window.deferredPrompt || null);
}
