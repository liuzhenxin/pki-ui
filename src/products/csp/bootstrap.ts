import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { ElButton, ElInput, ElIcon, ElMenu, ElMenuItem, ElBreadcrumb, ElBreadcrumbItem, ElCard, ElTag } from 'element-plus';
import '@/assets/styles/index.scss';
import App from './App.vue';
import { createCspRouter } from '@/router/csp';
import { assertCspProduct } from '@/config/csp';
import './style.css';

assertCspProduct(import.meta.env.VITE_APP_PRODUCT, import.meta.env.VITE_APP_TENANT_IDS);
const pinia = createPinia();
const router = createCspRouter(pinia);
const app = createApp(App).use(pinia).use(router);
for (const component of [ElButton, ElInput, ElIcon, ElMenu, ElMenuItem, ElBreadcrumb, ElBreadcrumbItem, ElCard, ElTag])
  app.component(component.name!, component);
app.mount('#app');
