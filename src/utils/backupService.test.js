import { describe, expect, it } from 'vitest';
import {
  BACKUP_EXPORT_KIND,
  BACKUP_VERSION,
  computeBackupFingerprint,
  createBackupPayload,
  createLocalExport
} from './backupService';

const sampleData = {
  accounts: [
    {
      id: 'acct_1',
      name: 'Wallet',
      balance: 120,
      createdAt: new Date('2026-02-01T10:00:00.000Z'),
      updatedAt: new Date('2026-02-02T10:00:00.000Z')
    }
  ],
  categories: [],
  transactions: [
    {
      id: 'tx_1',
      type: 'debit',
      amount: 20,
      occurredAt: new Date('2026-02-03T10:00:00.000Z'),
      createdAt: new Date('2026-02-03T11:00:00.000Z'),
      updatedAt: new Date('2026-02-03T12:00:00.000Z')
    }
  ],
  budgets: [],
  recurring: { rules: [], instances: [] },
  goals: [],
  household: { household: null, members: [], invites: [], auditEvents: [] },
  monthClosures: []
};

describe('backup service', () => {
  it('creates stable fingerprints for equivalent payloads', () => {
    const first = createBackupPayload(sampleData);
    const second = createBackupPayload({
      ...sampleData,
      accounts: [{ ...sampleData.accounts[0] }]
    });

    expect(computeBackupFingerprint(first)).toBe(computeBackupFingerprint(second));
  });

  it('wraps local exports with app metadata and serialized data', () => {
    const exported = createLocalExport(sampleData, { deviceId: 'device_1' });

    expect(exported.kind).toBe(BACKUP_EXPORT_KIND);
    expect(exported.version).toBe(BACKUP_VERSION);
    expect(exported.metadata.deviceId).toBe('device_1');
    expect(exported.data.accounts[0].createdAt).toBe('2026-02-01T10:00:00.000Z');
    expect(exported.data.transactions[0].occurredAt).toBe('2026-02-03T10:00:00.000Z');
  });
});
