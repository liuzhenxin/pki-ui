# 项目上下文：PKI-UI (基于 RuoYi-Vue-Plus)

本项目是一个专门的公钥基础设施 (PKI) 管理界面，基于 **RuoYi-Vue-Plus** (Vue 3 + TS) 模板构建。它提供证书颁发机构 (CA) 管理、证书签发和配置文件配置等工具。

## 项目愿景
提供一个安全、模块化且易于使用的 PKI 管理界面，支持 CA 声明周期管理、证书签发和密钥管理中心 (KMC) 操作，重点支持国密算法和双密钥策略。

## 核心技术栈
- **前端框架:** Vue 3 (Composition API), TypeScript, Vite
- **UI 组件库:** Element Plus
- **状态管理:** Pinia
- **样式:** UnoCSS, SCSS
- **密码学库:** `jsrsasign`, `node-forge`, `sm-crypto`, `jsencrypt`

## 核心业务领域
- **CA 管理:** 根 CA 和子 CA 的生命周期管理。
- **证书管理:** 各种模板（TLS、SMIME 等）的证书签发与吊销。
- **KMC 管理:** 密钥存档、预留和恢复。
- **配置管理:** 证书策略（Profiles）和主题（Subjects）配置。

## 现有约定
- **API 通信:** 使用 `@/utils/request.ts`，支持自动认证、加密和多语言。
- **编码标准:** 严格 TypeScript 类型，使用 `<script setup lang="ts">`。
- **国际化:** 自动设置 `Language` 请求头。

## 里程碑概览
1. **核心 PKI 生命周期管理:** CA、证书和 KMC 的基础功能。
2. **安全与运营:** 高级安全特性、审计日志和精细 RBAC。
3. **质量与性能:** 测试覆盖、性能优化和全面国际化。
