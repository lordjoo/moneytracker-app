<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    :aria-label="title"
  >
    <title>{{ title }}</title>
    <!-- Tile uses the theme primary token, so it tracks light/dark automatically. -->
    <rect width="48" height="48" :rx="tileRadius" class="fill-primary" />
    <!-- Wallet body -->
    <rect x="8.5" y="14.5" width="28" height="19" rx="5.5" :fill="walletColor" />
    <!-- Card slot hint -->
    <rect x="13" y="21" width="12.5" height="2.2" rx="1.1" :fill="slotColor" />
    <!-- Coin tucked at the wallet's edge -->
    <circle cx="33.5" cy="24" r="5.6" :fill="coinColor" />
    <circle cx="33.5" cy="24" r="2.8" fill="none" :stroke="walletColor" stroke-width="1.5" />
  </svg>
</template>

<script setup>
// The wallet + coin colours are the only brand constants in the UI that aren't
// DaisyUI tokens; keeping them here means the whole mark is editable in one file.
const WALLET_COLOR = '#FFF7F3';
const SLOT_COLOR = '#E9D6C9';
const COIN_COLOR = '#E3963A';

defineProps({
  size: { type: [Number, String], default: 36 },
  tileRadius: { type: [Number, String], default: 13 },
  title: { type: String, default: 'MyMoney' }
});

const walletColor = WALLET_COLOR;
const slotColor = SLOT_COLOR;
const coinColor = COIN_COLOR;
</script>
