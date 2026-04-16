# 技术栈

**分析日期：** 2025-05-13

## 语言

**主要：**
- TypeScript 5.9.3 - 核心应用逻辑和全库类型定义。

**次要：**
- Vue 3.5.22 - 组件框架（使用 `<script setup lang="ts">` 的 SFC）。
- SCSS 1.93.3 - 样式和主题定制。

## 运行环境

**环境：**
- Node.js >=18.18.0 - 开发和构建环境。

**包管理器：**
- yarn 1.22.19
- 锁定文件：存在 `yarn.lock`。

## 框架

**核心：**
- Vue 3.5.22 - 主要前端框架。
- Element Plus 2.11.7 - UI 组件库。
- Pinia 3.0.3 - 状态管理。

**测试：**
- Vitest 3.2.4 - 单元和组件测试。

**构建/开发：**
- Vite 6.4.1 - 构建工具和开发服务器。
- UnoCSS 66.5.4 - 原子化 CSS 引擎。

## 关键依赖

**核心依赖：**
- `axios` 1.13.1 - 用于 API 通信的 HTTP 客户端。
- `jsrsasign` 11.1.0 - 用于 RSA、ECC 和 X.509 操作的 PKI 库。
- `node-forge` 1.3.1 - 用于 TLS 和 PKI 的密码学工具。
- `sm-crypto` 0.3.13 - 符合中国标准的国密（SM2/SM3/SM4）算法。
- `jsencrypt` 3.5.4 - RSA 加密和解密。
- `crypto-js` 4.2.0 - 标准密码学算法（AES、DES 等）。

**基础设施：**
- `vue-router` 4.6.3 - 应用路由。
- `vue-i18n` 11.1.12 - 国际化支持。
- `echarts` 5.6.0 - 数据可视化。
- `@vueuse/core` 13.9.0 - Composition API 工具库。

## 配置

**环境配置：**
- 通过 `.env`、`.env.development` 和 `.env.production` 进行配置。
- 关键配置：`VITE_APP_BASE_API`、`VITE_APP_CLIENT_ID`、`VITE_APP_ENCRYPT`。

**构建配置：**
- `vite.config.ts` - 主要 Vite 配置，包括代理和插件设置。
- `tsconfig.json` - TypeScript 编译器配置。

## 平台要求

**开发环境：**
- Node.js >=18.18.0
- Yarn 或 NPM

**生产环境：**
- 现代浏览器（Chrome >= 87, Edge >= 88, Safari >= 14, Firefox >= 78）。
- 后端：兼容 RuoYi-Vue-Plus 的 API。

---

*技术栈分析：2025-05-13*
