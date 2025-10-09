import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/firebase';

export const BACKUP_VERSION = 1;

function serialiseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function createBackupPayload({ accounts, categories, transactions }) {
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
    }))
  };
}

export async function uploadBackup(uid, data) {
  const ref = doc(db, 'users', uid, 'backups', 'latest');
  const payload = {
    ...createBackupPayload(data),
    version: BACKUP_VERSION,
    updatedAt: serverTimestamp()
  };
  await setDoc(ref, payload, { merge: true });
}

export async function downloadBackup(uid) {
  const ref = doc(db, 'users', uid, 'backups', 'latest');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return null;
  }
  const data = snap.data();
  return {
    version: data.version ?? 1,
    accounts: data.accounts ?? [],
    categories: data.categories ?? [],
    transactions: data.transactions ?? [],
    updatedAt: data.updatedAt?.toDate?.() ?? null
  };
}
