import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import Page from '../../src/views/system/businessApplications/index.vue';
createApp(Page).use(ElementPlus).mount('#app');
