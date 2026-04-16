# 外部集成

**分析日期：** 2025-05-13

## API 与外部服务

**后端 API：**
- RuoYi-Vue-Plus 后端 - 核心业务逻辑、PKI 管理和行政服务。
  - SDK/客户端：`src/utils/request.ts` 中的 `axios`。
  - 身份验证：来自 `.env` 的 `Authorization: Bearer <token>` 和 `clientid`。

**硬件/令牌接口：**
- SKF 服务（本地代理）- 运行在 `ws://127.0.0.1:9001` 的 WebSocket 服务，用于通过 SKF 库与 U-Key 和 HSM 交互。
  - 实现：`src/api/skf/skf_api.js`。

**可视化：**
- ECharts - 监控和仪表板视图中的数据图表和报告。

**富文本：**
- Vue Quill - 系统管理模块中的内容编辑。

## 数据存储

**数据库：**
- 由后端（RuoYi-Vue-Plus）处理。

**文件存储：**
- OSS（对象存储服务）- 通过后端 API `/resource/oss/*` 管理。
  - 实现：`src/api/system/oss/index.ts`。

**缓存：**
- LocalStorage / SessionStorage - 通过自定义缓存插件用于应用状态（令牌、UI 首选项、会话数据）。
  - 实现：`src/plugins/cache.ts`。

## 身份验证与识别

**认证提供者：**
- 由 RuoYi-Vue-Plus 后端提供的自定义基于 JWT 的身份验证。
  - 实现：`src/utils/auth.ts`、`src/store/modules/user.ts`。

**社交登录：**
- 通过后端集成支持。
  - 实现：`src/api/system/social/auth.ts`。

## 监控与可观测性

**错误追踪：**
- 标准的 axios 拦截器将错误记录到控制台，并通过 `ElementPlus` 显示 UI 通知。

**日志：**
- 通过系统监控 API 管理操作日志和登录日志（`src/api/monitor/operlog/`、`src/api/monitor/loginInfo/`）。

## CI/CD 与部署

**托管：**
- 标准静态 Web 托管（推荐使用 Nginx）。

**CI 流水线：**
- 前端仓库中未检测到（可能在后端仓库或外部）。

## 环境配置

**必需的环境变量：**
- `VITE_APP_BASE_API` - 后端 API 基础 URL。
- `VITE_APP_CLIENT_ID` - 客户端标识符。
- `VITE_APP_ENCRYPT` - 请求/响应有效载荷加密开关。

**机密信息位置：**
- 通过 `.env` 文件管理（不包含在源码控制中）。

## 安全与 PKI

**载荷加密：**
- RSA + AES - 前后端之间的安全载荷交换。
  - 实现：`src/utils/crypto.ts`、`src/utils/jsencrypt.ts`、`src/utils/request.ts`。

**国密算法：**
- 支持 SM2/SM3/SM4 国密标准，常用于中国 PKI 系统。
  - 实现：`src/utils/sm2.ts`。

---

*集成审计：2025-05-13*
