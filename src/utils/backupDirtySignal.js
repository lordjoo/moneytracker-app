const listeners = new Set();

export function subscribeBackupDirty(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyBackupDirty(reason = 'change') {
  for (const listener of listeners) {
    try {
      listener(reason);
    } catch (error) {
      console.error('[BackupDirtySignal] listener failed', error);
    }
  }
}
