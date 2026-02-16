import { describe, expect, it } from 'vitest';
import { isConflictError, mergeHouseholdBundles } from './householdFirestore';

describe('householdFirestore merge', () => {
  it('keeps the newest invite state instead of original createdAt', () => {
    const createdAt = new Date('2026-02-01T10:00:00.000Z');
    const acceptedAt = new Date('2026-02-02T10:00:00.000Z');

    const localBundle = {
      invites: [
        {
          id: 'invite_1',
          email: 'viewer@example.com',
          role: 'viewer',
          status: 'accepted',
          createdAt,
          acceptedAt
        }
      ]
    };
    const remoteBundle = {
      invites: [
        {
          id: 'invite_1',
          email: 'viewer@example.com',
          role: 'viewer',
          status: 'pending',
          createdAt
        }
      ]
    };

    const merged = mergeHouseholdBundles(localBundle, remoteBundle);
    expect(merged.invites).toHaveLength(1);
    expect(merged.invites[0].status).toBe('accepted');
  });

  it('keeps the newest month closure state by updatedAt', () => {
    const localBundle = {
      monthClosures: [
        {
          monthKey: '2026-02',
          status: 'reopened',
          closedAt: new Date('2026-03-01T00:00:00.000Z'),
          reopenedAt: new Date('2026-03-02T00:00:00.000Z'),
          updatedAt: new Date('2026-03-02T00:00:00.000Z')
        }
      ]
    };
    const remoteBundle = {
      monthClosures: [
        {
          monthKey: '2026-02',
          status: 'closed',
          closedAt: new Date('2026-03-01T00:00:00.000Z'),
          updatedAt: new Date('2026-03-01T01:00:00.000Z')
        }
      ]
    };

    const merged = mergeHouseholdBundles(localBundle, remoteBundle);
    expect(merged.monthClosures).toHaveLength(1);
    expect(merged.monthClosures[0].status).toBe('reopened');
  });

  it('detects conflict code helper', () => {
    const error = Object.assign(new Error('conflict'), { code: 'household-conflict' });
    expect(isConflictError(error)).toBe(true);
    expect(isConflictError(new Error('other'))).toBe(false);
  });
});
