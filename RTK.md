# RTK.md - pki-ui

## 1. 项目用途

`pki-ui` 是 PKI 平台管理前端，基于 Vue 3、TypeScript、Pinia、Element Plus、Vite、UnoCSS 和 RuoYi/Vben/Soybean 相关生态改造，承载 CA、RA、KMC、OCSP、License、平台管理等后台操作界面。

## 2. 目录结构说明

```text
pki-ui/
├── src/                 # 业务源码
├── src/assets           # 静态资源
├── src/store/modules    # Pinia 状态模块
├── public/              # 公共静态资源
├── package.json         # 脚本和依赖
└── vite.config.*        # Vite 构建配置
```

组件命名使用 `PascalCase`，组合式逻辑和状态按现有目录约定放置。

## 3. 如何安装依赖

`package.json` 要求 Node.js `>=18.18.0`、npm `>=8.9.0`，项目标注 Yarn 1.x。

```bash
npm install --registry=https://registry.npmmirror.com
```

优先沿用仓库已有锁文件和团队实际包管理器。

## 4. 如何运行项目

```bash
npm run dev
```

生产构建：

```bash
npm run build:prod
```

本地预览：

```bash
npm run preview
```

## 5. 如何测试

```bash
npm run lint:eslint
npm run build:prod
```

复杂组件逻辑可使用项目已有 `vitest` 依赖补充单元测试。

## 6. 主要模块说明

- `src/views`: 业务页面。
- `src/components`: 可复用组件。
- `src/api`: 后端接口封装。
- `src/store/modules`: Pinia 状态模块。
- `src/router`: 路由与权限入口。
- `src/assets`: 图片、样式和静态资源。

## 7. 常见开发注意事项

- 延续 Vue 3 + TypeScript + Element Plus 现有写法，避免引入不必要 UI 框架。
- 接口字段、权限标识、路由 path 和菜单编码需与后端保持一致。
- 不提交 `node_modules/`、`dist/` 或本地环境文件。
- 涉及证书、密钥、PIN、token 的界面要避免日志输出和明文持久化。
