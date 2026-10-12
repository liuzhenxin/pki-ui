# 应用授权 UI 验证

`node node_modules/vitest/vitest.mjs run --config tests/application-authorization/vitest.config.ts`
验证当前能力解析、候选组合及原子请求字段白名单。

`node node_modules/@playwright/test/cli.js test --config tests/application-authorization/playwright.config.ts`
通过本机 Vite 挂载真实 Vue/Element Plus 组件，在浏览器中验证模式失败关闭、创建候选、独立资料写入、拒绝后关闭/刷新、空表、移动端及安装完成/不确定状态。HTTP 由明确的测试夹具拦截，分页组件使用轻量夹具；不等于连接真实后端的端到端或硬件验收。测试应用/角色 ID 故意独立于产品固定角色。

默认使用 Playwright 安装的 Chromium。已有本机 Chrome 时可设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指向其可执行文件。输出位于 `/tmp/authz-p6-ui-browser-results`；移动端截图 `/tmp/authz-p6-ui-mobile.png`。不访问预生产，不包含真实凭据。

2026-10-12 本地结果：21项单元和12项浏览器测试通过，KMC/CA/OCSP在902文件固定快照构建通过。源码范围定向ESLint通过，全项目类型/lint门禁仍未通过；真实网关/后端/硬件联合验收未完成。公共平台候选4.2.11-authz.1未远程发布，P6完整后端验证因Docker不响应而待恢复；不能作为产品发布许可。
