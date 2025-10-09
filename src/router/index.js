import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from '@/views/DashboardView.vue';
import AccountsView from '@/views/AccountsView.vue';
import AccountDetailView from '@/views/AccountDetailView.vue';
import TransactionsView from '@/views/TransactionsView.vue';
import CategoriesView from '@/views/CategoriesView.vue';
import SettingsView from '@/views/SettingsView.vue';
import OnboardingView from '@/views/OnboardingView.vue';
import { usePreferencesStore } from '@/stores/preferences';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/accounts', name: 'accounts', component: AccountsView },
    {
      path: '/accounts/:id',
      name: 'account-detail',
      component: AccountDetailView,
      props: true
    },
    { path: '/transactions', name: 'transactions', component: TransactionsView },
    { path: '/categories', name: 'categories', component: CategoriesView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/welcome', name: 'onboarding', component: OnboardingView, meta: { fullscreen: true } }
  ]
});

router.beforeEach((to) => {
  const preferences = usePreferencesStore();
  if (!preferences.initialized) {
    preferences.init();
  }

  if (!preferences.hasCompletedOnboarding && to.name !== 'onboarding') {
    return { name: 'onboarding', replace: true };
  }

  if (preferences.hasCompletedOnboarding && to.name === 'onboarding') {
    return { name: 'dashboard' };
  }

  return true;
});

export default router;
