# 测试规范：PKI-UI

## 测试框架
- **Vitest：** 用于单元测试和组件测试的主要测试框架。
- **配置：** 通过 `vite.config.ts` 管理。

## 当前状态
- **覆盖率：** 非常低。目前大多数功能缺乏自动化测试。
- **手动测试：** 根目录下存在一些手动脚本（如 `test_x509.js`），用于密码学校验。

## 测试策略
- **单元测试：** 重点关注工具函数 (`src/utils/`) 和密码学逻辑。
- **组件测试：** 使用 `@vue/test-utils` 结合 Vitest 测试关键 UI 组件（如 `X509Cert`、`CertSubject`）。
- **API 模拟：** 使用 `msw` 或简单的 `vi.mock` 测试依赖 API 的逻辑。

## 执行方式
- **运行测试：** `npx vitest`（如果 `package.json` 中没有脚本，虽然 `vitest` 在 devDependencies 中）。
- **监听模式：** `npx vitest watch`。

## 规范
- **文件命名：** `[name].test.ts` 或 `[name].spec.ts`。
- **存放位置：** 测试文件应放在源文件旁边或 `__tests__` 目录下。
