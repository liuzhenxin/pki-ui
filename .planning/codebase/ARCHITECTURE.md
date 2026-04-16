# 系统架构

**分析日期：** 2025-03-05

## 模式概述

**总体：** 基于 RuoYi-Vue-Plus 模板架构，使用 Vue 3、Vite 和 Element Plus 构建的单页面应用 (SPA)。

**核心特征：**
- **动态路由：** 根据后端菜单配置和用户权限动态生成路由。
- **模块化设计：** API 层、状态层 (Pinia) 和视图层清晰分离。
- **密码学安全：** 集成支持 CA 管理、载荷加密 (AES/RSA) 以及多种密码学库 (`jsrsasign`, `node-forge`, `sm-crypto`)。

## 分层架构

**视图层 (View Layer)：**
- 职责：UI 实现和局部状态管理。
- 位置：`src/views/`
- 内容：使用 `<script setup lang="ts">` 的 Vue SFC（单文件组件）。
- 依赖：`src/api/`、`src/store/`、`src/components/`、`src/hooks/`。
- 调用方：Vue Router。

**状态管理层 (State Management Layer)：**
- 职责：全局应用状态和跨组件通信。
- 位置：`src/store/`
- 内容：Pinia store 模块。
- 依赖：`src/api/`、`src/utils/`。
- 调用方：`src/views/`、`src/permission.ts`、`src/layout/`。

**API 层 (API Layer)：**
- 职责：后端通信和数据获取。
- 位置：`src/api/`
- 内容：定义请求函数的模块化 TypeScript 文件。
- 依赖：`src/utils/request.ts`。
- 调用方：`src/views/`、`src/store/`。

**工具层 (Utility Layer)：**
- 职责：共享助手函数和全局配置。
- 位置：`src/utils/`
- 内容：认证助手、加密函数、请求拦截器和常用校验器。
- 依赖：外部库 (`axios`, `js-cookie`, `crypto-js`)。
- 调用方：所有其他层级。

## 数据流

**标准请求流程：**

1. **用户交互：** 用户在 `src/views/` 组件中触发操作。
2. **API 调用：** 组件调用 `src/api/` 中的函数。
3. **请求拦截器：** `src/utils/request.ts` 添加认证头，处理载荷加密（如果开启），并记录请求。
4. **后端处理：** 请求发送至后端。
5. **响应拦截器：** `src/utils/request.ts` 解密响应（如果需要），处理全局错误码（如 401 登出），并提取数据。
6. **状态更新：** 组件更新局部状态，或调用 `src/store/` 动作更新全局状态。
7. **UI 更新：** Vue 的响应式系统更新 UI。

**状态管理：**
- **Pinia Stores：** 用于用户信息、权限、应用设置和共享数据（如字典）。
- **持久化状态：** 部分状态（如令牌）通过 `src/utils/auth.ts` 和 `src/plugins/cache.ts` 持久化在 Cookies 或 LocalStorage 中。

## 核心抽象

**Axios 实例：**
- 职责：集中的 HTTP 客户端配置。
- 示例：`src/utils/request.ts`
- 模式：带拦截器的单例 axios 实例。

**自定义组件：**
- 职责：封装 PKI 特定特性的 UI 逻辑。
- 示例：`src/components/X509Cert/index.vue`、`src/components/CertProfile/index.vue`。
- 模式：带 props 和 events 的可复用 Vue 组件。

## 入口点

**主入口：**
- 位置：`src/main.ts`
- 触发：浏览器页面加载。
- 职责：挂载 Vue 应用，注册插件（Pinia, Router, Element Plus, I18n），并加载全局 CSS。

**权限守卫：**
- 位置：`src/permission.ts`
- 触发：路由跳转（Vue Router）。
- 职责：检查 JWT 令牌，获取用户信息/权限，并动态生成路由表。

## 错误处理

**策略：** 全局拦截器结合局部 try-catch 以提供特定的 UI 反馈。

**模式：**
- **全局拦截器：** `src/utils/request.ts` 处理常见的 HTTP 状态码（401, 403, 500），并通过 `ElMessage` 或 `ElNotification` 显示通知。
- **字典/常量错误码：** `src/utils/errorCode.ts` 将状态码映射为人类可读的消息。

## 横向关注点

**日志：** 开发环境下通过控制台处理；关键错误通过 UI 通知显示。
**校验：** 视图中使用 Element Plus 表单校验；`src/utils/validate.ts` 中定义模块化校验规则。
**身份验证：** 基于 JWT。令牌存储在 cookies 中，通过 `src/store/modules/user.ts` 管理。
**国际化：** 使用 `vue-i18n`。语言文件存储在 `src/lang/`。

---

*架构分析：2025-03-05*
