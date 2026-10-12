# CSP 四步初始化前端

顺序：协议 → 环境检查 → 账号初始化 → 完成。公共协议复用 Agreement 组件，源文件摘要固定于 `src/products/csp/agreement.ts`。部署版本与权利主体必须由后端配置；不使用公共组件缺省公司替代配置。

进度、同意范围、核验证据和提交尝试由 CSP 主库保存。浏览器不接收平台身份ID、角色ID、租户或设备内部引用，不存 Auth 令牌。系统管理员、安全管理员、审计管理员分别绑定现有平台账号，本向导不修改账号/密码。

最终提交使用同源 BFF `setup-complete`，携带服务端草稿版本和明确确认。未知响应仅查询，不自动重发；BFF会话防重与服务端持久尝试共同保护刷新和重登录。明确的参数/权限/前提拒绝后必须刷新服务端状态，持久尝试仍存在时保持锁定。

需同时发布支持 `/v2/setup` 的 CSP 和对应 BFF。缺失接口、协议配置、三角色配置或平台发布策略时失败关闭，不回退到仅confirm的旧初始化流程。已有初始化成功记录不重新打开。

后端合同及部署准备位于 liuzx-csp 的 `doc/api/v2/setup.md`。设备状态本向导未核验，真实设备、自测、业务密钥与信任配置在初始化后完成。

## 本地验证

在 pki-ui 根目录：

```sh
npm run build:csp
npx vue-tsc --noEmit -p tsconfig.csp-product.json
npx vitest run --config vitest.csp-product.config.ts
npx eslint src/api/csp/console.ts src/store/modules/cspConsole.ts src/views/csp/setup/index.vue src/products/csp/agreement.ts tests/csp-product/setup.test.ts
CSP_BROWSER_CHANNEL=chrome node csp-console/ui-check.mjs
CSP_BROWSER_CHANNEL=chrome node csp-console/http-test-check.mjs
```

浏览器测试使用拦截的合成接口数据，覆盖1440/375宽度、协议同意、前提失败、刷新恢复、结果未知防重、重新登录、传输限制和Axe。未连接真实Auth/Admin或密码设备。没有系统Chrome时去掉CSP_BROWSER_CHANNEL并使用已安装的Playwright浏览器。可选 `CSP_UI_SCREENSHOTS=true` 保存截图；默认验证布局与可访问性，不等待截图渲染。
