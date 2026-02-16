import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { generateId, parseDate, readJson, writeJson } from '@/utils/storage';
import { notifyBackupDirty } from '@/utils/backupDirtySignal';
import { useAuthStore } from '@/stores/auth';
import { useMonthClosuresStore } from '@/stores/monthClosures';
import {
  findHouseholdsForUser,
  isConflictError,
  loadHouseholdBundle,
  mergeHouseholdBundles,
  saveHouseholdBundle
} from '@/utils/householdFirestore';

const STORAGE_KEY = 'household';
const VALID_ROLES = ['owner', 'editor', 'viewer'];
const MAX_AUDIT_EVENTS = 400;
const FIREBASE_ENV = import.meta.env ?? {};
const CLOUD_SYNC_ENABLED = Boolean(FIREBASE_ENV.VITE_FIREBASE_API_KEY && FIREBASE_ENV.VITE_FIREBASE_PROJECT_ID);

function normalizeRole(role, fallback = 'viewer') {
  return VALID_ROLES.includes(role) ? role : fallback;
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function serialiseMember(member) {
  return {
    ...member,
    role: normalizeRole(member.role, 'viewer'),
    email: normalizeEmail(member.email),
    invitedAt: toIso(member.invitedAt),
    joinedAt: toIso(member.joinedAt),
    updatedAt: toIso(member.updatedAt)
  };
}

function deserialiseMember(member) {
  return {
    ...member,
    role: normalizeRole(member.role, 'viewer'),
    email: normalizeEmail(member.email),
    invitedAt: parseDate(member.invitedAt),
    joinedAt: parseDate(member.joinedAt),
    updatedAt: parseDate(member.updatedAt)
  };
}

function serialiseInvite(invite) {
  return {
    ...invite,
    role: normalizeRole(invite.role, 'viewer'),
    email: normalizeEmail(invite.email),
    createdAt: toIso(invite.createdAt),
    acceptedAt: toIso(invite.acceptedAt),
    revokedAt: toIso(invite.revokedAt),
    updatedAt: toIso(invite.updatedAt)
  };
}

function deserialiseInvite(invite) {
  return {
    ...invite,
    role: normalizeRole(invite.role, 'viewer'),
    email: normalizeEmail(invite.email),
    createdAt: parseDate(invite.createdAt),
    acceptedAt: parseDate(invite.acceptedAt),
    revokedAt: parseDate(invite.revokedAt),
    updatedAt: parseDate(invite.updatedAt)
  };
}

function serialiseAuditEvent(event) {
  return {
    ...event,
    createdAt: toIso(event.createdAt)
  };
}

function deserialiseAuditEvent(event) {
  return {
    ...event,
    createdAt: parseDate(event.createdAt)
  };
}

function serialiseHousehold(household) {
  if (!household) return null;
  return {
    ...household,
    createdAt: toIso(household.createdAt),
    updatedAt: toIso(household.updatedAt)
  };
}

function deserialiseHousehold(household) {
  if (!household) return null;
  return {
    ...household,
    createdAt: parseDate(household.createdAt),
    updatedAt: parseDate(household.updatedAt)
  };
}

function serialiseMonthClosure(closure) {
  return {
    ...closure,
    closedAt: toIso(closure.closedAt),
    reopenedAt: toIso(closure.reopenedAt),
    updatedAt: toIso(closure.updatedAt)
  };
}

function canEditRole(role) {
  return role === 'owner' || role === 'editor';
}

export const useHouseholdStore = defineStore('household', () => {
  const household = ref(null);
  const members = ref([]);
  const invites = ref([]);
  const auditEvents = ref([]);
  const status = ref('idle');
  const initialized = ref(false);
  const cloudStatus = ref('idle');
  const syncError = ref('');
  const lastSyncedAt = ref(null);
  let cloudSyncQueue = Promise.resolve();

  function actor() {
    const authStore = useAuthStore();
    const user = authStore.user;
    return {
      uid: user?.uid ?? 'local-device',
      email: normalizeEmail(user?.email),
      displayName: user?.displayName ?? user?.email ?? 'This device',
      isAuthenticated: Boolean(user)
    };
  }

  function monthClosuresStore() {
    const store = useMonthClosuresStore();
    if (!store.initialized) {
      store.init();
    }
    return store;
  }

  function buildSyncBundle() {
    const monthStore = monthClosuresStore();
    return {
      household: serialiseHousehold(household.value),
      members: members.value.map(serialiseMember),
      invites: invites.value.map(serialiseInvite),
      auditEvents: auditEvents.value.map(serialiseAuditEvent),
      monthClosures: monthStore.closures.map(serialiseMonthClosure)
    };
  }

  function applyBundle(payload) {
    household.value = deserialiseHousehold(payload?.household ?? null);
    members.value = Array.isArray(payload?.members) ? payload.members.map(deserialiseMember) : [];
    invites.value = Array.isArray(payload?.invites) ? payload.invites.map(deserialiseInvite) : [];
    auditEvents.value = Array.isArray(payload?.auditEvents)
      ? payload.auditEvents.map(deserialiseAuditEvent)
      : [];
    status.value = 'ready';
    initialized.value = true;
    persist();
    monthClosuresStore().replaceAll(payload?.monthClosures ?? []);
  }

  async function syncFromCloud({ syncBack = true } = {}) {
    const currentActor = actor();
    if (!CLOUD_SYNC_ENABLED || !currentActor.isAuthenticated) return null;

    cloudStatus.value = 'syncing';
    syncError.value = '';
    try {
      const candidateIds = [];
      if (household.value?.id) {
        candidateIds.push(household.value.id);
      }

      const discovered = await findHouseholdsForUser(currentActor);
      for (const householdId of discovered) {
        if (householdId && !candidateIds.includes(householdId)) {
          candidateIds.push(householdId);
        }
      }
      if (!candidateIds.length) {
        cloudStatus.value = 'ready';
        lastSyncedAt.value = new Date();
        return null;
      }

      let remoteBundle = null;
      for (const householdId of candidateIds) {
        remoteBundle = await loadHouseholdBundle(householdId);
        if (remoteBundle?.household?.id) break;
      }
      if (!remoteBundle?.household?.id) {
        cloudStatus.value = 'ready';
        lastSyncedAt.value = new Date();
        return null;
      }

      const localBundle = buildSyncBundle();
      const shouldMerge = localBundle?.household?.id && localBundle.household.id === remoteBundle.household.id;
      const resolvedBundle = shouldMerge ? mergeHouseholdBundles(localBundle, remoteBundle) : remoteBundle;
      applyBundle(resolvedBundle);
      lastSyncedAt.value = new Date();
      cloudStatus.value = 'ready';

      if (syncBack && shouldMerge) {
        await syncToCloud({ reason: 'post-pull-merge' });
      }
      return resolvedBundle;
    } catch (error) {
      cloudStatus.value = 'error';
      syncError.value = error?.message ?? 'Cloud sync failed';
      throw error;
    }
  }

  async function syncToCloud({ reason = 'manual' } = {}) {
    const currentActor = actor();
    if (!CLOUD_SYNC_ENABLED || !currentActor.isAuthenticated || !household.value?.id) {
      return null;
    }

    cloudStatus.value = 'syncing';
    syncError.value = '';
    try {
      const localBundle = buildSyncBundle();
      const result = await saveHouseholdBundle(localBundle, currentActor);
      if (household.value) {
        household.value.syncRevision = Number(result?.syncRevision ?? household.value.syncRevision ?? 0);
        household.value.updatedAt = new Date();
      }
      persist();
      lastSyncedAt.value = new Date();
      cloudStatus.value = 'ready';
      return result;
    } catch (error) {
      if (isConflictError(error)) {
        const remoteBundle = await loadHouseholdBundle(household.value.id);
        if (!remoteBundle?.household?.id) {
          throw error;
        }
        const mergedBundle = mergeHouseholdBundles(buildSyncBundle(), remoteBundle);
        applyBundle(mergedBundle);

        const retryBundle = buildSyncBundle();
        if (retryBundle.household) {
          retryBundle.household.syncRevision = Number(remoteBundle.household.syncRevision ?? 0);
        }
        const retryResult = await saveHouseholdBundle(retryBundle, currentActor, {
          allowRevisionOverride: true
        });
        if (household.value) {
          household.value.syncRevision = Number(retryResult?.syncRevision ?? household.value.syncRevision ?? 0);
          household.value.updatedAt = new Date();
        }
        persist();
        lastSyncedAt.value = new Date();
        cloudStatus.value = 'ready';
        return retryResult;
      }

      cloudStatus.value = 'error';
      syncError.value = `${reason}: ${error?.message ?? 'Cloud sync failed'}`;
      throw error;
    }
  }

  function queueCloudSync(reason = 'change') {
    const currentActor = actor();
    if (!CLOUD_SYNC_ENABLED || !currentActor.isAuthenticated || !household.value?.id) {
      return Promise.resolve(null);
    }
    cloudSyncQueue = cloudSyncQueue
      .catch(() => null)
      .then(() => syncToCloud({ reason }))
      .catch((error) => {
        cloudStatus.value = 'error';
        syncError.value = error?.message ?? 'Cloud sync failed';
        return null;
      });
    return cloudSyncQueue;
  }

  async function handleAuthStateChanged() {
    const currentActor = actor();
    if (!CLOUD_SYNC_ENABLED || !currentActor.isAuthenticated) {
      cloudStatus.value = 'idle';
      syncError.value = '';
      lastSyncedAt.value = null;
      return;
    }
    await syncFromCloud();
  }

  function resolveCurrentMember() {
    if (!household.value) return null;
    const currentActor = actor();
    return (
      members.value.find((member) => {
        if (member.status !== 'active') return false;
        if (member.uid && member.uid === currentActor.uid) return true;
        if (member.email && member.email === currentActor.email) return true;
        return false;
      }) ?? null
    );
  }

  const activeHousehold = computed(() => household.value);
  const activeMembers = computed(() =>
    [...members.value]
      .filter((member) => member.status === 'active')
      .sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''))
  );
  const pendingInvites = computed(() =>
    [...invites.value]
      .filter((invite) => invite.status === 'pending')
      .sort((a, b) => (b.createdAt ?? new Date(0)).getTime() - (a.createdAt ?? new Date(0)).getTime())
  );
  const currentMember = computed(() => resolveCurrentMember());
  const currentRole = computed(() => {
    if (!household.value) return 'owner';
    return currentMember.value?.role ?? 'viewer';
  });
  const canManageMembers = computed(() => currentRole.value === 'owner');
  const canEditFinancialData = computed(() => canEditRole(currentRole.value));
  const canReopenMonths = computed(() => currentRole.value === 'owner');
  const recentAuditEvents = computed(() =>
    [...auditEvents.value]
      .sort((a, b) => (b.createdAt ?? new Date(0)).getTime() - (a.createdAt ?? new Date(0)).getTime())
      .slice(0, 60)
  );

  function persist() {
    writeJson(STORAGE_KEY, {
      household: serialiseHousehold(household.value),
      members: members.value.map(serialiseMember),
      invites: invites.value.map(serialiseInvite),
      auditEvents: auditEvents.value.map(serialiseAuditEvent)
    });
    notifyBackupDirty('household');
  }

  function init() {
    if (initialized.value) return;
    status.value = 'loading';
    const payload = readJson(STORAGE_KEY, {
      household: null,
      members: [],
      invites: [],
      auditEvents: []
    });
    household.value = deserialiseHousehold(payload?.household ?? null);
    members.value = Array.isArray(payload?.members) ? payload.members.map(deserialiseMember) : [];
    invites.value = Array.isArray(payload?.invites) ? payload.invites.map(deserialiseInvite) : [];
    auditEvents.value = Array.isArray(payload?.auditEvents)
      ? payload.auditEvents.map(deserialiseAuditEvent)
      : [];
    status.value = 'ready';
    initialized.value = true;
  }

  function logEvent(type, message, meta = {}) {
    const currentActor = actor();
    auditEvents.value.unshift({
      id: generateId('audit'),
      type: String(type ?? 'event'),
      message: String(message ?? ''),
      actor: {
        uid: currentActor.uid,
        email: currentActor.email,
        displayName: currentActor.displayName
      },
      meta: { ...meta },
      createdAt: new Date()
    });
    if (auditEvents.value.length > MAX_AUDIT_EVENTS) {
      auditEvents.value = auditEvents.value.slice(0, MAX_AUDIT_EVENTS);
    }
    persist();
    void queueCloudSync('audit-event');
  }

  function ensureCanEditFinancialData(action = 'modify financial data') {
    if (!canEditFinancialData.value) {
      throw new Error(`You do not have permission to ${action}.`);
    }
  }

  function ensureCanManageMembers(action = 'manage household members') {
    if (!canManageMembers.value) {
      throw new Error(`Only household owners can ${action}.`);
    }
  }

  function ensureCanReopenMonths(action = 'reopen a closed month') {
    if (!canReopenMonths.value) {
      throw new Error(`Only household owners can ${action}.`);
    }
  }

  function createHousehold({ name }) {
    const trimmedName = String(name ?? '').trim();
    if (!trimmedName) {
      throw new Error('Household name is required');
    }
    if (household.value) {
      throw new Error('A household already exists');
    }
    const now = new Date();
    const currentActor = actor();
    household.value = {
      id: generateId('household'),
      name: trimmedName,
      ownerUid: currentActor.uid,
      syncRevision: 0,
      createdAt: now,
      updatedAt: now
    };
    members.value = [
      {
        id: generateId('member'),
        uid: currentActor.uid,
        email: currentActor.email,
        displayName: currentActor.displayName,
        role: 'owner',
        status: 'active',
        invitedAt: now,
        joinedAt: now,
        updatedAt: now
      }
    ];
    invites.value = [];
    persist();
    logEvent('household.created', `Created household "${trimmedName}"`);
  }

  function inviteMember({ email, role = 'viewer' }) {
    ensureCanManageMembers('invite members');
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('A valid email is required');
    }
    if (activeMembers.value.some((member) => member.email === normalizedEmail)) {
      throw new Error('That email is already a member');
    }
    if (pendingInvites.value.some((invite) => invite.email === normalizedEmail)) {
      throw new Error('That email already has a pending invite');
    }

    const now = new Date();
    const invite = {
      id: generateId('invite'),
      email: normalizedEmail,
      role: normalizeRole(role, 'viewer'),
      status: 'pending',
      createdAt: now,
      createdByUid: actor().uid,
      acceptedAt: null,
      acceptedByMemberId: null,
      revokedAt: null,
      updatedAt: now
    };
    invites.value.push(invite);
    persist();
    logEvent('household.invite.sent', `Invited ${normalizedEmail} as ${invite.role}`, {
      inviteId: invite.id
    });
    return invite.id;
  }

  function acceptInvite(inviteId) {
    const invite = invites.value.find((entry) => entry.id === inviteId);
    if (!invite || invite.status !== 'pending') {
      throw new Error('Invite not found');
    }
    const currentActor = actor();
    if (!currentActor.email || currentActor.email !== invite.email) {
      throw new Error('Sign in with the invited email to accept this invite');
    }

    const now = new Date();
    const existingMember = members.value.find((member) => member.email === invite.email);
    if (existingMember) {
      existingMember.uid = currentActor.uid;
      existingMember.displayName = currentActor.displayName;
      existingMember.role = invite.role;
      existingMember.status = 'active';
      existingMember.joinedAt = existingMember.joinedAt ?? now;
      existingMember.updatedAt = now;
      invite.acceptedByMemberId = existingMember.id;
    } else {
      const member = {
        id: generateId('member'),
        uid: currentActor.uid,
        email: currentActor.email,
        displayName: currentActor.displayName,
        role: invite.role,
        status: 'active',
        invitedAt: invite.createdAt ?? now,
        joinedAt: now,
        updatedAt: now
      };
      members.value.push(member);
      invite.acceptedByMemberId = member.id;
    }
    invite.status = 'accepted';
    invite.acceptedAt = now;
    invite.updatedAt = now;

    persist();
    logEvent('household.invite.accepted', `${currentActor.displayName} joined as ${invite.role}`, {
      inviteId
    });
  }

  function revokeInvite(inviteId) {
    ensureCanManageMembers('revoke invites');
    const invite = invites.value.find((entry) => entry.id === inviteId);
    if (!invite || invite.status !== 'pending') return;
    const now = new Date();
    invite.status = 'revoked';
    invite.revokedAt = now;
    invite.updatedAt = now;
    persist();
    logEvent('household.invite.revoked', `Revoked invite for ${invite.email}`, {
      inviteId
    });
  }

  function setMemberRole(memberId, role) {
    ensureCanManageMembers('change member roles');
    const member = members.value.find((entry) => entry.id === memberId && entry.status === 'active');
    if (!member) {
      throw new Error('Member not found');
    }
    const nextRole = normalizeRole(role, member.role);
    if (member.role === nextRole) return;

    if (member.role === 'owner' && nextRole !== 'owner') {
      const ownerCount = activeMembers.value.filter((entry) => entry.role === 'owner').length;
      if (ownerCount <= 1) {
        throw new Error('At least one owner is required');
      }
    }

    member.role = nextRole;
    member.updatedAt = new Date();
    persist();
    logEvent('household.member.role.updated', `Updated ${member.displayName || member.email} to ${nextRole}`, {
      memberId
    });
  }

  function removeMember(memberId) {
    ensureCanManageMembers('remove members');
    const member = members.value.find((entry) => entry.id === memberId && entry.status === 'active');
    if (!member) return;

    if (member.role === 'owner') {
      const ownerCount = activeMembers.value.filter((entry) => entry.role === 'owner').length;
      if (ownerCount <= 1) {
        throw new Error('Cannot remove the last owner');
      }
    }

    member.status = 'removed';
    member.updatedAt = new Date();
    persist();
    logEvent('household.member.removed', `Removed ${member.displayName || member.email}`, {
      memberId
    });
  }

  function replaceAll(payload) {
    household.value = deserialiseHousehold(payload?.household ?? null);
    members.value = Array.isArray(payload?.members) ? payload.members.map(deserialiseMember) : [];
    invites.value = Array.isArray(payload?.invites) ? payload.invites.map(deserialiseInvite) : [];
    auditEvents.value = Array.isArray(payload?.auditEvents)
      ? payload.auditEvents.map(deserialiseAuditEvent)
      : [];
    status.value = 'ready';
    initialized.value = true;
    persist();
  }

  function clear() {
    household.value = null;
    members.value = [];
    invites.value = [];
    auditEvents.value = [];
    status.value = 'idle';
    initialized.value = false;
    cloudStatus.value = 'idle';
    syncError.value = '';
    lastSyncedAt.value = null;
    cloudSyncQueue = Promise.resolve();
    persist();
  }

  return {
    household: activeHousehold,
    members,
    invites,
    auditEvents,
    status,
    initialized,
    cloudStatus,
    syncError,
    lastSyncedAt,
    activeMembers,
    pendingInvites,
    currentMember,
    currentRole,
    canManageMembers,
    canEditFinancialData,
    canReopenMonths,
    recentAuditEvents,
    actor,
    init,
    persist,
    logEvent,
    ensureCanEditFinancialData,
    ensureCanManageMembers,
    ensureCanReopenMonths,
    createHousehold,
    inviteMember,
    acceptInvite,
    revokeInvite,
    setMemberRole,
    removeMember,
    syncFromCloud,
    syncToCloud,
    queueCloudSync,
    handleAuthStateChanged,
    replaceAll,
    clear
  };
});
