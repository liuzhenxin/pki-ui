import { createApp } from 'vue';
import { ElButton, ElInput } from 'element-plus';
import 'element-plus/theme-chalk/base.css';
import 'element-plus/theme-chalk/el-button.css';
import 'element-plus/theme-chalk/el-input.css';
import App from './App.vue';
import './style.css';

createApp(App).component('ElButton', ElButton).component('ElInput', ElInput).mount('#app');
