import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { writeJson } from '@/utils/storage';
import { useAuthStore } from './auth';
import { useHouseholdStore } from './household';

function resetStorage() {
  writeJson('household', undefined);
}

describe('household store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetStorage();
  });

  it('creates household with owner role and active member', () => {
    const authStore = useAuthStore();
    authStore.user = {
      uid: 'owner-1',
      email: 'owner@example.com',
      displayName: 'Owner'
    };

    const householdStore = useHouseholdStore();
    householdStore.init();
    householdStore.createHousehold({ name: 'Home' });

    expect(householdStore.household.name).toBe('Home');
    expect(householdStore.currentRole).toBe('owner');
    expect(householdStore.activeMembers).toHaveLength(1);
    expect(householdStore.activeMembers[0].email).toBe('owner@example.com');
  });

  it('supports invite and accept flow with role assignment', () => {
    const authStore = useAuthStore();
    authStore.user = {
      uid: 'owner-1',
      email: 'owner@example.com',
      displayName: 'Owner'
    };

    const householdStore = useHouseholdStore();
    householdStore.init();
    householdStore.createHousehold({ name: 'Home' });

    const inviteId = householdStore.inviteMember({
      email: 'viewer@example.com',
      role: 'viewer'
    });

    authStore.user = {
      uid: 'viewer-1',
      email: 'viewer@example.com',
      displayName: 'Viewer'
    };

    householdStore.acceptInvite(inviteId);

    expect(householdStore.activeMembers).toHaveLength(2);
    const viewerMember = householdStore.activeMembers.find((member) => member.email === 'viewer@example.com');
    expect(viewerMember.role).toBe('viewer');
    expect(householdStore.currentRole).toBe('viewer');
    expect(() => householdStore.ensureCanManageMembers()).toThrow('Only household owners');
  });
});
