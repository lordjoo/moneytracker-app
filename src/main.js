import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './styles.css';
import { registerSW } from './pwa';

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.mount('#app');

if ('serviceWorker' in navigator) {
  registerSW();
}
