# CSP 管理前端

CSP 使用 `pki-ui` 的共享登录页、图形验证码和平台令牌。独立 CSP 构建固定到产品租户 10（`csp`）。门户也可选择 CSP 租户。登录后，前端通过网关读取 CSP 账号权限和安装状态，再进入相应页面。

在 `pki-ui` 根目录，用已注册的平台浏览器客户端 ID 设置 `CSP_PLATFORM_CLIENT_ID`，然后执行 `npm run build:csp`。产物位于 `dist-csp/`。构建 Nginx 镜像时传入 `BUILD_TARGET=csp` 和 `CSP_PLATFORM_CLIENT_ID` 两个构建参数。

部署时，使用平台浏览器客户端的现有认证配置。该客户端签发的令牌受众需与 CSP 资源服务器的校验配置一致。网关需转发 `/api-gateway/auth/**`、`/api-gateway/admin/**` 和 `/api-gateway/csp/**`。CSP 管理页面通过 HTTPS 提供。

若已有部署的审计员角色或部门与初始化数据不同，构建时设置 `VITE_APP_CSP_AUDITOR_ROLE_ID` 和 `VITE_APP_CSP_AUDITOR_DEPARTMENT_ID`。默认值分别为 702 和 701。审计员管理仍由平台 Admin 的 ENFORCE 策略裁决。开启安装向导的可选证书绑定输入时，设置 `VITE_APP_CSP_CERTIFICATE_BINDING=true` 并启用对应后端能力。

```sh
node csp-console/product-build-check.mjs
npm run typecheck:csp
npx vitest run --config vitest.csp-product.config.ts
CSP_TEST_BROWSER_CHANNEL=chrome npx playwright test --config playwright.csp.config.ts tests/csp/e2e
```

浏览器回归使用模拟网关验证共享验证码登录、安装跳转、角色菜单和管理动作。真实环境的客户端注册、令牌受众、网关路由和后端权限需要在部署环境联调。
