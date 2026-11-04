# 业务应用接入页面实现
2026-11-04：完成平台页面和API封装，包含列表、注册、轮换、停用及一次凭据内存展示。直接入口/business-applications；动态菜单组件system/businessApplications/index，权限sys:business-application:manage仍须受控登记。后端最终校验平台管理员身份。未部署128。

定向ESLint通过；npm run build:portal退出0。修复用户store命名导入。未执行浏览器交互测试或真实后端联调，不能视为联合验收完成。构建生成的自动导入配置恢复原值，其他任务target及test-results未纳入提交。

## 浏览器验收补充
2026-11-04：真实页面组件和API封装在隔离Vite中挂载，使用本机Chrome及Playwright，4项测试全部通过（20.5秒），无跳过。覆盖无权限不请求、失败后同requestId重试、长整数负责人ID、一次凭据关闭清除和不落本地存储、轮换/停用版本及停用后禁用按钮、列表失败刷新恢复。测试请求响应由Playwright模拟，不是后端联调。测试代码定向ESLint检查另见执行结果。

复核命令：
```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npx playwright test --config tests/business-onboarding/playwright.config.ts
```

当前未找到可确认的本地Admin/Auth联调环境；常见本地端口探测未响应，仅凭端口探测不能证明全部服务不存在。没有登录或修改128，未执行现场迁移、赋权或部署。下一步需准备隔离Admin/Auth运行环境，再进行真实登录到登记、发令牌、轮换、停用的端到端联合验收。
