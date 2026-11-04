---
status: complete
id: 261011-hy4
date: 2026-10-11
commit: 0c23466
---
# KMS 专属控制台已完成

用户要求在 pki-ui 增加 KMS 专属页面，参考其他应用前端。代码提交 `0c23466`，共 19 个文件。仅提交本次 KMS 增量，原有及并行应用改动保留；未推送。

## 交付

- 服务端既有菜单组件 `kms/index` 对应 `/kms/console`；租户 2 首页分发到 KMS，其他产品沿用原首页。
- 沿用 KMC/OCSP 和公共 Element Plus 管理风格，创建主密钥、UUID 查询、版本详情、轮换、启停、7–30 天计划删除及取消删除。
- 加密、解密、生成数据密钥，按现有权限展示并在调用前再次检查，继续由后端负责租户/资源授权和状态校验。
- 修正 KMS 首次登录与后续访问被引导至 CA 初始化的问题，保留其他产品流程和登录拦截。KMS 通过独立安装 SQL 初始化。
- `build:kms` 要求显式提供已注册平台客户端 ID，限定登录租户为 2；未猜测或创建实际客户端。
- 类型化 API 仅使用现有 `/kms/v1` 契约，无虚构列表、分页、审计查询、在线初始化、Provider 切换或健康统计。
- 密码请求不进入公共重复提交 sessionStorage；网络异常不打印包含请求体的 AxiosError。明文结果默认遮蔽；切换操作/密钥、清空、卸载、缓存页面失活时清除；迟到响应不得恢复已清除结果。

## 验证证据

1. 工作区 `vitest run --config vitest.kms.config.ts`：4 个文件、19 项全部通过。覆盖 API 路径/字段、参数边界、真实公共请求拦截器缓存与脱敏、别名固定错误、权限、跨产品阻断、首次登录、生命周期失败、删除等待期、明文遮蔽及缓存页面清理。
2. 对新增源文件和测试的定向 ESLint 通过。共享文件检查存在原有 `src/permission.ts` 的一条长行格式错误，保留用户工作，不据此宣称全仓 lint 通过。
3. 工作区最终 KMS 专属生产构建通过（1m08s），构建使用公开测试客户端标识，只验证打包，不宣称客户端已注册或生产登录成功。
4. `git archive 0c23466` 单独导出至临时目录，并复用已安装 node_modules：相同 19 项测试和定向 ESLint 通过；独立 KMS 生产构建通过（1m22s）。证明提交不依赖工作区未提交的 CSP/KDS 等变更。
5. 浏览器用临时 fixture 验证桌面和 390px 窄屏：查询、版本详情、密码表单、默认隐藏明文、清空及删除确认框。截图为测试数据，未连接真实平台或 HSM；预览服务与测试标签页已关闭。
6. 全仓 vue-tsc 检查未通过：报告 424 条错误，涉及 CA、OPS、公共组件等旧代码；本次 KMS 新增文件无报错，共享文件报错行不属于本次增量。此项不能记为全仓类型通过。

日志保存在本机临时目录：`/tmp/kms-ui-tests.log`、`/tmp/kms-ui-lint.log`、`/tmp/kms-ui-typecheck.log`、`/tmp/kms-ui-build-final.log`、`/tmp/kms-ui-export-tests.log`、`/tmp/kms-ui-export-lint.log`、`/tmp/kms-ui-export-build.log`。

## 使用与边界

见 `src/views/kms/README.md`。网关/反向代理须将 `/kms/v1/...` 转发到 liuzx-kms 的 `/v1/...`。真实 OAuth 登录、网关路由、资源范围授权与 SDF/HSM 运算待部署环境联调。前端不提供本地密码运算降级。

liuzx-kms 后端 Phase 3 讨论仍保留：用户已选全部议题，Locate 排序尚未作答；本任务未将前端建设加入 SCALE 阶段或擅自确认排序决策。
