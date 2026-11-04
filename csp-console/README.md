# CSP 最小控制台入口

复用现有 Vue/Vite/Element Plus 依赖及已批准 CSP 品牌资产，独立入口只编译本目录，不导入旧多产品登录页、NAS 导航或旧令牌存储。不是完整 Phase 08 管理控制台，也不替代后续共享布局/动态菜单集成。

```sh
./node_modules/.bin/vite build --config csp-console/vite.config.ts
./node_modules/.bin/vue-tsc --noEmit -p csp-console/tsconfig.json
./node_modules/.bin/eslint csp-console --max-warnings 0
node csp-console/ui-check.mjs
node csp-console/http-test-check.mjs
```

产物 `dist-csp-console/` 不提交。BFF 源码和容器构建文件在同级 liuzx-csp 的 `scripts/console/`；浏览器不接收 OAuth 客户端秘密或令牌，不使用 localStorage/sessionStorage。

2026-10-11：参考 KMC 的分步卡片交互，增加环境检查 → 初始化确认 → 完成并重新登录。只支持后端既有最小初始化范围，POST 请求严格为 `{"confirm":true}`；不接收账号密码、版本/环境覆盖或设备索引。身份认证仍由 Auth 完成。BFF 再次核查状态和环境，CSP 后端负责 setup 权限、claim/CAS、事务审计、幂等及 A/B 收口。

必须人工明确确认，不自动提交或重试。提交结果不明时只查询状态，当前会话不再次提交；异常需运维核查。完成页显式退出清理 BFF 会话并请求 Auth 撤销，然后重新通过 Auth 登录；不能由 UI 退出成功推断上游撤销缓存全部即时失效。页面无重置按钮，不执行真实首次初始化测试。

默认 HTTP 非 localhost 仅预览，登录禁用。用户批准的128测试例外必须同时配置 `CSP_CONSOLE_ENVIRONMENT=test`、`CSP_CONSOLE_HTTP_TEST_ENABLED=true` 及精确 `CSP_CONSOLE_ORIGIN=http://10.10.10.128:9085`，否则开启组合启动失败。前端只接受该精确 origin 的服务端 session 标志，并显示非阻断的“128 HTTP 测试入口”提示；传输未加密，不用于生产。证书登录不享受该HTTP例外。

生产使用 HTTPS；原 localhost SSH 隧道仍可使用。没有 root 挂载客户端凭据时 BFF 拒绝登录。Auth、人工验证码、Host/Origin、CSRF、初始化确认及权限仍必须通过，令牌只存服务端。HTTP浏览器测试拦截所有页面/API请求并使用合成数据，不连接真实128或Auth。状态接口由 CSP 服务端验签及授权，前端显示不能作为发布验收证据。
