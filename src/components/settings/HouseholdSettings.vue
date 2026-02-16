<template>
  <section class="space-y-4">
    <article class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
        <h2 class="card-title">Shared Household</h2>

        <div v-if="!householdStore.household" class="space-y-3">
          <p class="text-sm opacity-70">
            Create a shared household workspace to manage members and role-based access.
          </p>
          <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="createHousehold">
            <input
              v-model.trim="householdName"
              type="text"
              class="input input-bordered w-full"
              placeholder="Household name"
              required
            />
            <button class="btn btn-primary" :class="{ loading: isSaving }" type="submit">
              Create household
            </button>
          </form>
        </div>

        <div v-else class="space-y-4">
          <div class="rounded-lg border border-base-300 p-3">
            <p class="font-medium">{{ householdStore.household.name }}</p>
            <p class="text-xs opacity-65">Your role: <span class="badge badge-outline">{{ householdStore.currentRole }}</span></p>
          </div>

          <form v-if="householdStore.canManageMembers" class="grid gap-2 sm:grid-cols-3" @submit.prevent="sendInvite">
            <input
              v-model.trim="inviteForm.email"
              type="email"
              class="input input-bordered sm:col-span-2"
              placeholder="member@email.com"
              required
            />
            <div class="flex gap-2">
              <select v-model="inviteForm.role" class="select select-bordered w-full">
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="owner">Owner</option>
              </select>
              <button class="btn btn-primary" type="submit">Invite</button>
            </div>
          </form>
          <p v-else class="text-xs opacity-65">Only owners can invite or manage members.</p>

          <div>
            <h3 class="text-sm font-semibold">Members</h3>
            <ul class="mt-2 space-y-2 text-sm">
              <li
                v-for="member in householdStore.activeMembers"
                :key="member.id"
                class="rounded-lg border border-base-300 p-3"
              >
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p class="font-medium">{{ member.displayName || member.email || 'Member' }}</p>
                    <p class="text-xs opacity-65">{{ member.email || 'Local member' }}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <select
                      v-if="householdStore.canManageMembers"
                      :value="member.role"
                      class="select select-bordered select-sm"
                      @change="updateRole(member.id, $event.target.value)"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="owner">Owner</option>
                    </select>
                    <span v-else class="badge badge-outline">{{ member.role }}</span>
                    <button
                      v-if="householdStore.canManageMembers"
                      class="btn btn-ghost btn-xs text-error"
                      @click="removeMember(member.id)"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h3 class="text-sm font-semibold">Pending invites</h3>
            <ul class="mt-2 space-y-2 text-sm">
              <li
                v-for="invite in householdStore.pendingInvites"
                :key="invite.id"
                class="rounded-lg border border-base-300 p-3"
              >
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p class="font-medium">{{ invite.email }}</p>
                    <p class="text-xs opacity-65">Role: {{ invite.role }}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      v-if="canAcceptInvite(invite)"
                      class="btn btn-success btn-xs"
                      @click="acceptInvite(invite.id)"
                    >
                      Accept
                    </button>
                    <button
                      v-if="householdStore.canManageMembers"
                      class="btn btn-ghost btn-xs"
                      @click="revokeInvite(invite.id)"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              </li>
              <li v-if="!householdStore.pendingInvites.length" class="text-xs opacity-65">No pending invites.</li>
            </ul>
          </div>
        </div>

        <p v-if="statusMessage" class="text-xs" :class="statusKind === 'error' ? 'text-error' : 'text-success'">
          {{ statusMessage }}
        </p>
      </div>
    </article>

    <article class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title">Audit Events</h2>
        <ul class="space-y-2 text-sm">
          <li
            v-for="event in householdStore.recentAuditEvents"
            :key="event.id"
            class="rounded-lg border border-base-300 p-3"
          >
            <p class="font-medium">{{ event.message }}</p>
            <p class="text-xs opacity-65">
              {{ formatDateTime(event.createdAt) }}
              <span v-if="event.actor?.displayName"> by {{ event.actor.displayName }}</span>
            </p>
          </li>
          <li v-if="!householdStore.recentAuditEvents.length" class="text-xs opacity-65">
            No audit events yet.
          </li>
        </ul>
      </div>
    </article>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useHouseholdStore } from '@/stores/household';

const householdStore = useHouseholdStore();
if (!householdStore.initialized) {
  householdStore.init();
}

const householdName = ref('');
const isSaving = ref(false);
const statusMessage = ref('');
const statusKind = ref('success');
const inviteForm = reactive({
  email: '',
  role: 'viewer'
});

function setStatus(kind, message) {
  statusKind.value = kind;
  statusMessage.value = message;
}

function formatDateTime(value) {
  if (!value) return 'Unknown';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

async function createHousehold() {
  try {
    isSaving.value = true;
    householdStore.createHousehold({ name: householdName.value });
    householdName.value = '';
    setStatus('success', 'Household created successfully.');
  } catch (error) {
    setStatus('error', error.message ?? 'Failed to create household.');
  } finally {
    isSaving.value = false;
  }
}

function sendInvite() {
  try {
    householdStore.inviteMember({
      email: inviteForm.email,
      role: inviteForm.role
    });
    inviteForm.email = '';
    inviteForm.role = 'viewer';
    setStatus('success', 'Invite created.');
  } catch (error) {
    setStatus('error', error.message ?? 'Failed to invite member.');
  }
}

function canAcceptInvite(invite) {
  const actor = householdStore.actor();
  return actor.email && actor.email === invite.email;
}

function acceptInvite(inviteId) {
  try {
    householdStore.acceptInvite(inviteId);
    setStatus('success', 'Invite accepted.');
  } catch (error) {
    setStatus('error', error.message ?? 'Unable to accept invite.');
  }
}

function revokeInvite(inviteId) {
  try {
    householdStore.revokeInvite(inviteId);
    setStatus('success', 'Invite revoked.');
  } catch (error) {
    setStatus('error', error.message ?? 'Unable to revoke invite.');
  }
}

function updateRole(memberId, role) {
  try {
    householdStore.setMemberRole(memberId, role);
    setStatus('success', 'Member role updated.');
  } catch (error) {
    setStatus('error', error.message ?? 'Failed to update role.');
  }
}

function removeMember(memberId) {
  try {
    householdStore.removeMember(memberId);
    setStatus('success', 'Member removed.');
  } catch (error) {
    setStatus('error', error.message ?? 'Failed to remove member.');
  }
}
</script>
