import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/firebase';

export const BACKUP_VERSION = 3;
export const BACKUP_EXPORT_KIND = 'mymoney.local-backup';
const LEGACY_BACKUP_DOC_ID = 'latest';
const MAX_FINGERPRINT_LEN = 64;

function serialiseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function createBackupPayload({
  accounts,
  categories,
  transactions,
  budgets = [],
  recurring = { rules: [], instances: [] },
  goals = [],
  household = { household: null, members: [], invites: [], auditEvents: [] },
  monthClosures = []
}) {
  return {
    accounts: accounts.map((account) => ({
      ...account,
      createdAt: serialiseDate(account.createdAt),
      updatedAt: serialiseDate(account.updatedAt),
      closedAt: serialiseDate(account.closedAt)
    })),
    categories: categories.map((category) => ({
      ...category,
      createdAt: serialiseDate(category.createdAt),
      updatedAt: serialiseDate(category.updatedAt)
    })),
    transactions: transactions.map((transaction) => ({
      ...transaction,
      occurredAt: serialiseDate(transaction.occurredAt),
      createdAt: serialiseDate(transaction.createdAt),
      updatedAt: serialiseDate(transaction.updatedAt)
    })),
    budgets: budgets.map((budget) => ({
      ...budget,
      createdAt: serialiseDate(budget.createdAt),
      updatedAt: serialiseDate(budget.updatedAt)
    })),
    recurring: {
      rules: (recurring?.rules ?? []).map((rule) => ({
        ...rule,
        createdAt: serialiseDate(rule.createdAt),
        updatedAt: serialiseDate(rule.updatedAt)
      })),
      instances: (recurring?.instances ?? []).map((instance) => ({
        ...instance,
        resolvedAt: serialiseDate(instance.resolvedAt)
      }))
    },
    goals: goals.map((goal) => ({
      ...goal,
      createdAt: serialiseDate(goal.createdAt),
      updatedAt: serialiseDate(goal.updatedAt),
      manualContributions: (goal.manualContributions ?? []).map((entry) => ({
        ...entry,
        createdAt: serialiseDate(entry.createdAt)
      }))
    })),
    household: {
      household: household?.household
        ? {
          ...household.household,
          createdAt: serialiseDate(household.household.createdAt),
          updatedAt: serialiseDate(household.household.updatedAt)
        }
        : null,
      members: (household?.members ?? []).map((member) => ({
        ...member,
        invitedAt: serialiseDate(member.invitedAt),
        joinedAt: serialiseDate(member.joinedAt),
        updatedAt: serialiseDate(member.updatedAt)
      })),
      invites: (household?.invites ?? []).map((invite) => ({
        ...invite,
        createdAt: serialiseDate(invite.createdAt),
        acceptedAt: serialiseDate(invite.acceptedAt),
        revokedAt: serialiseDate(invite.revokedAt)
      })),
      auditEvents: (household?.auditEvents ?? []).map((event) => ({
        ...event,
        createdAt: serialiseDate(event.createdAt)
      }))
    },
    monthClosures: monthClosures.map((closure) => ({
      ...closure,
      closedAt: serialiseDate(closure.closedAt),
      reopenedAt: serialiseDate(closure.reopenedAt)
    }))
  };
}

export function createLocalExport(data, metadata = {}) {
  return {
    kind: BACKUP_EXPORT_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'MyMoney Tracker',
    metadata,
    data: createBackupPayload(data)
  };
}

export function downloadLocalExport(data, metadata = {}) {
  if (typeof document === 'undefined') {
    throw new Error('Local export is only available in the browser.');
  }
  const exportPayload = createLocalExport(data, metadata);
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mymoney-backup-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return exportPayload;
}

function stableStringify(value) {
  if (value == null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}

function hashString(input) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function computeBackupFingerprint(payload) {
  const serialized = stableStringify(payload);
  const h1 = hashString(serialized);
  const h2 = hashString(serialized.slice(0, Math.floor(serialized.length / 2)));
  const h3 = hashString(serialized.slice(Math.floor(serialized.length / 2)));
  const hash = `${h1}${h2}${h3}`.slice(0, MAX_FINGERPRINT_LEN);
  return `v${BACKUP_VERSION}_${hash}`;
}

function buildBackupCounts(payload) {
  return {
    accounts: payload.accounts?.length ?? 0,
    categories: payload.categories?.length ?? 0,
    transactions: payload.transactions?.length ?? 0,
    budgets: payload.budgets?.length ?? 0,
    recurringRules: payload.recurring?.rules?.length ?? 0,
    recurringInstances: payload.recurring?.instances?.length ?? 0,
    goals: payload.goals?.length ?? 0,
    householdMembers: payload.household?.members?.length ?? 0,
    monthClosures: payload.monthClosures?.length ?? 0
  };
}

export async function uploadBackup(uid, data, { deviceId = '', fingerprint = '' } = {}) {
  const snapshot = createBackupPayload(data);
  const resolvedFingerprint = String(fingerprint || computeBackupFingerprint(snapshot)).slice(0, MAX_FINGERPRINT_LEN);
  const ref = doc(db, 'backups', uid);
  const payload = {
    ...snapshot,
    version: BACKUP_VERSION,
    fingerprint: resolvedFingerprint,
    updatedByDevice: String(deviceId ?? ''),
    updatedAt: serverTimestamp()
  };
  await setDoc(ref, payload, { merge: true });

  const metadataRef = doc(db, 'backup_meta', uid);
  await setDoc(
    metadataRef,
    {
      version: BACKUP_VERSION,
      fingerprint: resolvedFingerprint,
      updatedByDevice: String(deviceId ?? ''),
      counts: buildBackupCounts(snapshot),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return {
    fingerprint: resolvedFingerprint
  };
}

export async function downloadBackup(uid) {
  const primaryRef = doc(db, 'backups', uid);
  const primarySnap = await getDoc(primaryRef);
  const legacyRef = doc(db, 'users', uid, 'backups', LEGACY_BACKUP_DOC_ID);
  const legacySnap = primarySnap.exists() ? null : await getDoc(legacyRef);
  const snap = primarySnap.exists() ? primarySnap : legacySnap;
  if (!snap?.exists()) return null;

  const data = snap.data();
  const snapshot = {
    accounts: data.accounts ?? [],
    categories: data.categories ?? [],
    transactions: data.transactions ?? [],
    budgets: data.budgets ?? [],
    recurring: data.recurring ?? { rules: [], instances: [] },
    goals: data.goals ?? [],
    household: data.household ?? { household: null, members: [], invites: [], auditEvents: [] },
    monthClosures: data.monthClosures ?? []
  };
  const resolvedFingerprint =
    String(data.fingerprint ?? '').trim() || computeBackupFingerprint(snapshot);
  return {
    version: data.version ?? BACKUP_VERSION,
    ...snapshot,
    fingerprint: resolvedFingerprint,
    updatedAt: data.updatedAt?.toDate?.() ?? null
  };
}

export async function getBackupMetadata(uid) {
  const metadataRef = doc(db, 'backup_meta', uid);
  const metadataSnap = await getDoc(metadataRef);
  if (metadataSnap.exists()) {
    const data = metadataSnap.data();
    return {
      version: data.version ?? BACKUP_VERSION,
      fingerprint: String(data.fingerprint ?? ''),
      updatedByDevice: String(data.updatedByDevice ?? ''),
      updatedAt: data.updatedAt?.toDate?.() ?? null,
      counts: data.counts ?? {}
    };
  }

  const backupRef = doc(db, 'backups', uid);
  const backupSnap = await getDoc(backupRef);
  if (!backupSnap.exists()) {
    return null;
  }
  const data = backupSnap.data();
  const snapshot = {
    accounts: data.accounts ?? [],
    categories: data.categories ?? [],
    transactions: data.transactions ?? [],
    budgets: data.budgets ?? [],
    recurring: data.recurring ?? { rules: [], instances: [] },
    goals: data.goals ?? [],
    household: data.household ?? { household: null, members: [], invites: [], auditEvents: [] },
    monthClosures: data.monthClosures ?? []
  };
  const resolvedFingerprint =
    String(data.fingerprint ?? '').trim() || computeBackupFingerprint(snapshot);
  return {
    version: data.version ?? BACKUP_VERSION,
    fingerprint: resolvedFingerprint,
    updatedByDevice: String(data.updatedByDevice ?? ''),
    updatedAt: data.updatedAt?.toDate?.() ?? null,
    counts: buildBackupCounts(snapshot)
  };
}
