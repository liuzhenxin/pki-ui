# 代码库结构

**分析日期：** 2025-03-05

## 目录布局

```
pki-ui/
├── .planning/          # GSD 规划和代码库映射
├── profiles/           # PKI 配置模板
├── public/             # 静态资源（favicon 等）
├── src/                # 源代码
│   ├── api/            # API 请求模块
│   ├── assets/         # 静态资源（图片、样式、图标）
│   ├── components/     # 可复用 UI 组件
│   ├── directive/      # 自定义 Vue 指令
│   ├── enums/          # TypeScript 枚举（响应码等）
│   ├── hooks/          # 共享 Composition API hooks
│   ├── lang/           # 国际化 (i18n) 文件
│   ├── layout/         # 应用布局组件
│   ├── plugins/        # Vue 插件和第三方集成
│   ├── router/         # Vue Router 配置
│   ├── store/          # Pinia 状态管理模块
│   ├── types/          # 全局 TypeScript 类型定义
│   ├── utils/          # 工具函数和助手
│   └── views/          # 页面级组件（业务逻辑）
├── vite/               # Vite 配置和插件
├── .env.development    # 开发环境配置
├── .env.production     # 生产环境配置
├── index.html          # HTML 入口点
├── package.json        # 依赖和脚本
├── tsconfig.json       # TypeScript 配置
└── vite.config.ts      # Vite 构建配置
```

## 目录用途

**src/api/:**
- 职责：模块化的后端服务定义。
- 内容：特定功能的子目录（如 `ca/`、`system/`、`monitor/`）。
- 关键文件：`src/api/ca/root.ts`、`src/api/login.ts`。

**src/views/:**
- 职责：主要业务逻辑和页面组件。
- 内容：镜像侧边栏菜单结构的子目录。
- 关键文件：`src/views/ca/root/index.vue`、`src/views/login.vue`。

**src/store/:**
- 职责：使用 Pinia 的集中状态管理。
- 内容：基于模块的功能。
- 关键文件：`src/store/modules/user.ts`、`src/store/modules/permission.ts`。

**src/components/:**
- 职责：可复用 UI 挂件和业务相关的复杂组件。
- 内容：`X509Cert`、`CertProfile`、`FileUpload` 等。

**src/utils/:**
- 职责：共享逻辑和助手函数。
- 内容：`request.ts` (axios 配置)、`crypto.ts` (加密)、`auth.ts` (令牌管理)。

## 关键文件位置

**入口点：**
- `src/main.ts`：应用初始化和挂载。
- `src/permission.ts`：全局导航守卫和路由生成。

**配置：**
- `vite.config.ts`：构建系统和开发服务器配置。
- `src/settings.ts`：全局应用设置（标题、主题等）。

**核心逻辑：**
- `src/utils/request.ts`：全局 API 拦截器和错误处理。
- `src/router/index.ts`：静态路由和路由实例创建。

**测试：**
- `test_x509.js`：用于测试 X509 证书操作的脚本（位于根目录）。

## 命名规范

**文件：**
- Vue 组件：PascalCase (如 `UserSelect/index.vue`)。
- API 模块：camelCase (如 `src/api/ca/cert.ts`)。
- 工具文件：kebab-case 或 camelCase (如 `scroll-to.ts`)。

**目录：**
- 源码文件夹：camelCase (如 `src/views/ca/`)。
- 组件文件夹：PascalCase (如 `src/components/DictTag/`)。

## 如何添加新代码

**新功能 (如 "KMC 审计"):**
1. 在 `src/api/kmc/audit.ts` 中定义 API 端点。
2. (可选) 在 `src/store/modules/kmc.ts` 中创建 Pinia store。
3. 在 `src/views/kmc/audit/index.vue` 中创建页面组件。
4. 在后端添加菜单项（它将被 `src/permission.ts` 自动获取）。

**新的共享组件：**
- 在 `src/components/` 下创建一个新目录，并将 `index.vue` 放在其中。

**新的工具函数：**
- 如果是通用用途，添加到 `src/utils/`；如果使用了 Composition API，添加到 `src/hooks/`。

## 特殊目录

**.planning/codebase/:**
- 职责：包含供 AI 代理使用的代码库映射和架构文档。
- 是否生成：否
- 是否提交：是

**profiles/:**
- 职责：PKI 证书模板配置。
- 是否提交：是

---

*结构分析：2025-03-05*
