# HSM 管理界面

沿用平台 Layout、Element Plus、平台登录和按钮权限，租户固定 7 / hsm。

## 页面

- `/hsm/home`：产品概览；仅查询当前账号获授权的初始化、UKey 接口。
- `/hsm/initialization`：初始化记录查询（hsm:init:view）；写操作仍关闭，证书可后续配置。
- `/hsm/ukeys`：管理员/操作员数量配置、任命、替换、撤销、PIN 登录和登出；沿用 hsm:ukey:view/manage/login。
- `/hsm/audit`：复用 hsm:ukey:view，只筛选接口返回的最近 100 条身份事件，非全量平台审计。

HSM 专属构建提供独立首页与按查询权限过滤的导航，无需增加菜单 ID 或写入线上数据库。普通多应用构建仍使用服务端菜单。

## 构建与验收

```sh
HSM_PLATFORM_CLIENT_ID=<平台已注册的客户端ID> npm run build:hsm
npx vitest run --config vitest.hsm.config.ts
```

构建输出默认 dist。部署端需将 `/api-gateway/hsm/**` 转发至 HSM 服务；生产环境必须提供 HTTPS 才能提交 UKey PIN。浏览器电脑上的 UKey 平台登录不替代主机 UKey 认证。

密钥生命周期、备份恢复、服务启停和 SSL 配置接口尚未开放，概览仅说明其状态，不发送虚构请求。页面构建和模拟数据验收不代表已完成平台 OAuth、网关或真机验收。
