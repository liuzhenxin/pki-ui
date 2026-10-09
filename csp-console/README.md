# CSP 最小控制台入口

复用现有 Vue/Vite/Element Plus 依赖及已批准 CSP 品牌资产，独立入口只编译本目录，不导入旧多产品登录页、NAS 导航或旧令牌存储。不是完整 Phase 08 管理控制台，也不替代后续共享布局/动态菜单集成。

```sh
./node_modules/.bin/vite build --config csp-console/vite.config.ts
./node_modules/.bin/vue-tsc --noEmit -p csp-console/tsconfig.json
./node_modules/.bin/eslint csp-console --max-warnings 0
node csp-console/ui-check.mjs
```

产物 `dist-csp-console/` 不提交。BFF 源码和容器构建文件在同级 liuzx-csp 的 `scripts/console/`；浏览器不接收 OAuth 客户端秘密或令牌，不使用 localStorage/sessionStorage。初始化状态仅 GET，不实现初始化写入。

HTTP 非 localhost 仅预览，登录禁用。真实测试使用 localhost SSH 隧道或 HTTPS；没有 root 挂载客户端凭据时 BFF 拒绝登录。状态接口由 CSP 服务端验签及授权，前端显示不能作为发布验收证据。
