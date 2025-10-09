export function registerSW() {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        if (confirm('New content available. Reload?')) {
          window.location.reload();
        }
      },
      onOfflineReady() {
        console.info('MyMoney app is ready to work offline.');
      }
    });
  }).catch((error) => {
    console.error('SW registration failed', error);
  });
}
