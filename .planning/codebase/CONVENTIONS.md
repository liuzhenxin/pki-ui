# 编码规范：PKI-UI

## TypeScript
- **严格模式：** 已启用。
- **类型定义：** 尽可能使用严格类型。避免使用 `any`。
- **API 类型：** API 响应类型应定义在 `src/api/types.ts` 或本地的 `types.ts` 文件中。
- **类型转换：** 尽量减少 `as any` 的使用。如果使用了，请说明原因。

## Vue 3
- **Composition API：** 始终使用 `<script setup lang="ts">`。
- **组件命名：** 组件文件使用 PascalCase（如 `X509Cert.vue`）。
- **状态管理：** 使用 Pinia 管理全局状态。Store 模块应放在 `src/store/modules/` 下。
- **响应式：** 基础类型优先使用 `ref`，对象/数组在合适时使用 `reactive`，但为了保持一致性，通常首选 `ref`。

## 样式
- **UnoCSS：** 使用原子化 CSS 进行布局、间距和简单样式设置。
- **SCSS：** 用于复杂的、可复用的样式以及覆盖 Element Plus 的默认样式。全局样式位于 `src/assets/styles/`。
- **Element Plus：** 主要 UI 库。使用其组件和设计令牌 (Design Tokens)。
- **图标：** 使用 `unplugin-icons` 和 `<svg-icon />` 组件。

## API 通信
- **Axios：** 使用 `src/utils/request.ts` 中的共享实例。
- **模块化 API：** 按功能在 `src/api/` 中组织 API 调用。
- **加密：** 注意 `request.ts` 中配置的加密层 (AES/SM2)。
- **错误处理：** 使用全局拦截器处理标准的错误响应。

## 代码质量
- **代码检查 (Linting)：** 使用 ESLint。提交前运行 `npm run lint:eslint`。
- **格式化：** 使用 Prettier。运行 `npm run prettier` 以格式化代码库。
