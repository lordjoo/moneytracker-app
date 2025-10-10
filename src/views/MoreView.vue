<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-semibold">More</h1>
      <p class="text-sm opacity-70">
        Access additional features and app settings.
      </p>
    </header>

    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <!-- Settings Card -->
      <RouterLink
        to="/settings"
        class="card bg-base-100 shadow hover:shadow-lg transition-shadow cursor-pointer"
      >
        <div class="card-body">
          <div class="flex items-center gap-3">
            <div class="p-3 rounded-lg bg-primary/10">
              <Cog6ToothIcon class="w-6 h-6 text-primary" />
            </div>
            <div class="flex-1">
              <h2 class="card-title text-lg">Settings</h2>
              <p class="text-sm opacity-70">Backup, account & currency</p>
            </div>
            <ChevronRightIcon class="w-5 h-5 opacity-50" />
          </div>
        </div>
      </RouterLink>

      <!-- About Card -->
      <div class="card bg-base-100 shadow hover:shadow-lg transition-shadow cursor-pointer opacity-60">
        <div class="card-body">
          <div class="flex items-center gap-3">
            <div class="p-3 rounded-lg bg-info/10">
              <InformationCircleIcon class="w-6 h-6 text-info" />
            </div>
            <div class="flex-1">
              <h2 class="card-title text-lg">About</h2>
              <p class="text-sm opacity-70">App info & version</p>
            </div>
            <ChevronRightIcon class="w-5 h-5 opacity-50" />
          </div>
          <div class="badge badge-sm badge-ghost">Coming soon</div>
        </div>
      </div>

      <!-- Help & Support Card -->
      <div class="card bg-base-100 shadow hover:shadow-lg transition-shadow cursor-pointer opacity-60">
        <div class="card-body">
          <div class="flex items-center gap-3">
            <div class="p-3 rounded-lg bg-success/10">
              <QuestionMarkCircleIcon class="w-6 h-6 text-success" />
            </div>
            <div class="flex-1">
              <h2 class="card-title text-lg">Help & Support</h2>
              <p class="text-sm opacity-70">Get help & FAQs</p>
            </div>
            <ChevronRightIcon class="w-5 h-5 opacity-50" />
          </div>
          <div class="badge badge-sm badge-ghost">Coming soon</div>
        </div>
      </div>
    </section>

    <!-- App Info Section -->
    <section class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title">App Information</h2>
        <div class="grid gap-3 text-sm">
          <div class="flex justify-between items-center py-2 border-b border-base-200">
            <span class="opacity-70">Version</span>
            <span class="font-medium">1.0.0</span>
          </div>
          <div class="flex justify-between items-center py-2 border-b border-base-200">
            <span class="opacity-70">Storage</span>
            <span class="font-medium">Browser local storage</span>
          </div>
          <div class="flex justify-between items-center py-2">
            <span class="opacity-70">Built with</span>
            <span class="font-medium">Vue 3 + Vite + DaisyUI</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router';
import {
  Cog6ToothIcon,
  InformationCircleIcon,
  QuestionMarkCircleIcon,
  ChevronRightIcon
} from '@heroicons/vue/24/outline';
</script>
