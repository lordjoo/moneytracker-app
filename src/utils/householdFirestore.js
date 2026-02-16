import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/firebase';

const CONFLICT_CODE = 'household-conflict';

function toMillis(value) {
  if (!value) return 0;
  if (value?.toMillis) return value.toMillis();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function lowerEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function serialiseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (value?.toDate) return value.toDate().toISOString();
  return value;
}

function memberDocId(householdId, uid) {
  return `${householdId}_${uid}`;
}

function inviteDocId(householdId, email) {
  return `${householdId}_invite_${lowerEmail(email)}`;
}

function monthClosureDocId(householdId, monthKey) {
  return `${householdId}_${monthKey}`;
}

function isConflictError(error) {
  return error?.code === CONFLICT_CODE;
}

function inviteVersion(invite) {
  return Math.max(
    toMillis(invite?.createdAt),
    toMillis(invite?.acceptedAt),
    toMillis(invite?.revokedAt),
    toMillis(invite?.updatedAt)
  );
}

function monthClosureVersion(closure) {
  return Math.max(
    toMillis(closure?.updatedAt),
    toMillis(closure?.reopenedAt),
    toMillis(closure?.closedAt)
  );
}

function resolveNewest(left, right, updatedAtKey = 'updatedAt') {
  if (!left) return right;
  if (!right) return left;
  return toMillis(left[updatedAtKey]) >= toMillis(right[updatedAtKey]) ? left : right;
}

function mergeById(
  localList = [],
  remoteList = [],
  {
    idKey = 'id',
    updatedAtKey = 'updatedAt',
    resolve = (left, right) => resolveNewest(left, right, updatedAtKey)
  } = {}
) {
  const map = new Map();
  for (const item of remoteList) {
    map.set(item[idKey], item);
  }
  for (const localItem of localList) {
    const existing = map.get(localItem[idKey]);
    map.set(localItem[idKey], resolve(localItem, existing));
  }
  return Array.from(map.values());
}

export function mergeHouseholdBundles(localBundle, remoteBundle) {
  const localHousehold = localBundle?.household ?? null;
  const remoteHousehold = remoteBundle?.household ?? null;
  const mergedHousehold = resolveNewest(localHousehold, remoteHousehold, 'updatedAt');

  return {
    household: mergedHousehold,
    members: mergeById(localBundle?.members ?? [], remoteBundle?.members ?? [], {
      idKey: 'id',
      updatedAtKey: 'updatedAt'
    }),
    invites: mergeById(localBundle?.invites ?? [], remoteBundle?.invites ?? [], {
      idKey: 'id',
      resolve: (left, right) => (inviteVersion(left) >= inviteVersion(right) ? left : right)
    }),
    auditEvents: mergeById(localBundle?.auditEvents ?? [], remoteBundle?.auditEvents ?? [], {
      idKey: 'id',
      updatedAtKey: 'createdAt'
    }),
    monthClosures: mergeById(localBundle?.monthClosures ?? [], remoteBundle?.monthClosures ?? [], {
      idKey: 'monthKey',
      resolve: (left, right) => (monthClosureVersion(left) >= monthClosureVersion(right) ? left : right)
    })
  };
}

export async function findHouseholdsForUser({ uid, email }) {
  const householdIds = new Set();
  if (uid) {
    const memberSnap = await getDocs(
      query(collection(db, 'household_members'), where('uid', '==', uid))
    );
    for (const snap of memberSnap.docs) {
      const data = snap.data();
      if (data?.recordType === 'member' && data?.status === 'active' && data?.householdId) {
        householdIds.add(data.householdId);
      }
    }
  }
  const normalizedEmail = lowerEmail(email);
  if (normalizedEmail) {
    const inviteSnap = await getDocs(
      query(collection(db, 'household_members'), where('email', '==', normalizedEmail))
    );
    for (const snap of inviteSnap.docs) {
      const data = snap.data();
      if (data?.householdId && data?.recordType === 'invite') {
        householdIds.add(data.householdId);
      }
    }
  }
  return Array.from(householdIds);
}

export async function loadHouseholdBundle(householdId) {
  const householdRef = doc(db, 'households', householdId);
  const householdSnap = await getDoc(householdRef);
  if (!householdSnap.exists()) {
    return null;
  }

  const householdData = householdSnap.data();
  const members = [];
  const invites = [];
  const memberDocs = await getDocs(
    query(collection(db, 'household_members'), where('householdId', '==', householdId))
  );
  for (const snap of memberDocs.docs) {
    const data = snap.data();
    if (data.recordType === 'invite') {
      invites.push({
        id: data.id ?? data.inviteId ?? snap.id,
        email: lowerEmail(data.email),
        role: data.role,
        status: data.status,
        createdAt: toDate(data.createdAt),
        createdByUid: data.createdByUid ?? '',
        acceptedAt: toDate(data.acceptedAt),
        acceptedByMemberId: data.acceptedByMemberId ?? null,
        revokedAt: toDate(data.revokedAt),
        updatedAt: toDate(data.updatedAt),
        cloudDocId: snap.id
      });
      continue;
    }
    members.push({
      id: data.id ?? snap.id,
      uid: data.uid ?? '',
      email: lowerEmail(data.email),
      displayName: data.displayName ?? '',
      role: data.role,
      status: data.status,
      invitedAt: toDate(data.invitedAt),
      joinedAt: toDate(data.joinedAt),
      updatedAt: toDate(data.updatedAt),
      cloudDocId: snap.id
    });
  }

  const auditEvents = [];
  const auditDocs = await getDocs(
    query(collection(db, 'audit_events'), where('householdId', '==', householdId))
  );
  for (const snap of auditDocs.docs) {
    const data = snap.data();
    auditEvents.push({
      ...data,
      id: data.id ?? snap.id,
      createdAt: toDate(data.createdAt)
    });
  }

  const monthClosures = [];
  const monthDocs = await getDocs(
    query(collection(db, 'month_closures'), where('householdId', '==', householdId))
  );
  for (const snap of monthDocs.docs) {
    const data = snap.data();
    monthClosures.push({
      ...data,
      monthKey: data.monthKey,
      closedAt: toDate(data.closedAt),
      reopenedAt: toDate(data.reopenedAt),
      updatedAt: toDate(data.updatedAt)
    });
  }

  return {
    household: {
      ...householdData,
      id: householdData.id ?? householdSnap.id,
      createdAt: toDate(householdData.createdAt),
      updatedAt: toDate(householdData.updatedAt),
      syncRevision: Number(householdData.syncRevision ?? 0)
    },
    members,
    invites,
    auditEvents: auditEvents.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    monthClosures: monthClosures.sort((a, b) => (b.monthKey || '').localeCompare(a.monthKey || ''))
  };
}

export async function saveHouseholdBundle(bundle, actor, { allowRevisionOverride = false } = {}) {
  const household = bundle?.household;
  if (!household?.id) {
    throw new Error('Cannot sync household: missing household id');
  }

  const actorMeta = {
    uid: actor?.uid ?? '',
    email: lowerEmail(actor?.email),
    displayName: actor?.displayName ?? actor?.email ?? 'Unknown'
  };
  const actorMember = (bundle?.members ?? []).find((member) => {
    if (member?.status !== 'active') return false;
    if (member?.uid && member.uid === actorMeta.uid) return true;
    if (member?.email && lowerEmail(member.email) === actorMeta.email) return true;
    return false;
  });
  const actorRole = actorMember?.role ?? 'viewer';
  const canManageMembers = actorRole === 'owner';

  const householdRef = doc(db, 'households', household.id);
  let nextRevision = Number(household.syncRevision ?? 0);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(householdRef);
    const remoteRevision = Number(snap.data()?.syncRevision ?? 0);
    const localRevision = Number(household.syncRevision ?? 0);

    if (snap.exists() && localRevision < remoteRevision && !allowRevisionOverride) {
      const error = new Error('Household version conflict');
      error.code = CONFLICT_CODE;
      throw error;
    }

    nextRevision = Math.max(localRevision, remoteRevision) + 1;
    transaction.set(
      householdRef,
      {
        ...household,
        id: household.id,
        ownerUid: household.ownerUid ?? actorMeta.uid,
        updatedBy: actorMeta,
        syncRevision: nextRevision,
        createdAt: snap.exists() ? snap.data()?.createdAt ?? serverTimestamp() : serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  });

  const batch = writeBatch(db);

  for (const member of bundle.members ?? []) {
    const isSelfMember =
      (member?.uid && member.uid === actorMeta.uid) ||
      (!member?.uid && lowerEmail(member?.email) === actorMeta.email);
    if (!canManageMembers && !isSelfMember) {
      continue;
    }
    const docId = member.uid ? memberDocId(household.id, member.uid) : (member.cloudDocId || member.id);
    batch.set(
      doc(db, 'household_members', docId),
      {
        householdId: household.id,
        recordType: 'member',
        id: member.id,
        uid: member.uid ?? '',
        email: lowerEmail(member.email),
        displayName: member.displayName ?? '',
        role: member.role,
        status: member.status,
        invitedAt: serialiseDate(member.invitedAt),
        joinedAt: serialiseDate(member.joinedAt),
        updatedAt: serverTimestamp(),
        updatedBy: actorMeta
      },
      { merge: true }
    );
  }

  for (const invite of bundle.invites ?? []) {
    const isSelfInvite = lowerEmail(invite?.email) === actorMeta.email;
    if (!canManageMembers && !isSelfInvite) {
      continue;
    }
    const docId = invite.cloudDocId || inviteDocId(household.id, invite.email);
    batch.set(
      doc(db, 'household_members', docId),
      {
        householdId: household.id,
        recordType: 'invite',
        id: invite.id,
        inviteId: invite.id,
        email: lowerEmail(invite.email),
        role: invite.role,
        status: invite.status,
        createdByUid: invite.createdByUid ?? actorMeta.uid,
        createdAt: serialiseDate(invite.createdAt) ?? new Date().toISOString(),
        acceptedAt: serialiseDate(invite.acceptedAt),
        acceptedByMemberId: invite.acceptedByMemberId ?? null,
        revokedAt: serialiseDate(invite.revokedAt),
        updatedAt: serverTimestamp(),
        updatedBy: actorMeta
      },
      { merge: true }
    );
  }

  for (const event of bundle.auditEvents ?? []) {
    batch.set(
      doc(db, 'audit_events', event.id),
      {
        ...event,
        id: event.id,
        householdId: household.id,
        createdAt: serialiseDate(event.createdAt) ?? new Date().toISOString()
      },
      { merge: true }
    );
  }

  for (const closure of bundle.monthClosures ?? []) {
    if (!closure?.monthKey) continue;
    const docId = monthClosureDocId(household.id, closure.monthKey);
    batch.set(
      doc(db, 'month_closures', docId),
      {
        ...closure,
        householdId: household.id,
        monthKey: closure.monthKey,
        closedAt: serialiseDate(closure.closedAt),
        reopenedAt: serialiseDate(closure.reopenedAt),
        updatedBy: actorMeta,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  await batch.commit();
  return { syncRevision: nextRevision };
}

export { isConflictError };
