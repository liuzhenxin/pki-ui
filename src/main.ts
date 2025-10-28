import { createApp } from 'vue'
import { createPinia } from 'pinia'

// global css
import 'virtual:uno.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import '@/assets/styles/index.scss'

import App from './App.vue'
import router from './router'

// 高亮组件
// import 'highlight.js/styles/a11y-light.css';
import 'highlight.js/styles/atom-one-dark.css'
import 'highlight.js/lib/common'
import HighLight from '@highlightjs/vue-plugin'

// svg图标
import 'virtual:svg-icons-register'
import ElementIcons from '@/plugins/svgicon'

const app = createApp(App)
const pinia = createPinia()

app.use(HighLight)
app.use(ElementIcons)
app.use(pinia)
app.use(router)

app.mount('#app')
