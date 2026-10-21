# KDS 管理后台模块

> 由 Phase 12 交付。所有请求经平台 BFF `/platform/kds/**`，前端不接触私钥、PIN、Token 或签名材料。
> 契约见 `liuzx-kds/doc/contracts/KDS-BFF-CONTRACT.md`。

## 页面

| 目录 | 页面 | 数据来源 |
|------|------|----------|
| `ops/status` | 依赖健康、维护/销毁态、集群节点 | `/ops/status` |
| `ops/alerts` | 告警配置（脱敏）、测试发送、事件列表 | `/ops/alerts/*` |
| `device` | 设备分页列表与详情（元数据） | `/device/list`、`/device/detail` |
| `key` | 密钥与通道快照（元数据） | `/key/snapshot`、`/channel/status` |
| `sbox` | S 盒版本历史、立即激活、通道回滚上一版本 | `/sbox/history`、`/sbox/activate`、`/channel/rollback` |
| `restore` | 恢复任务创建、状态与回滚结果 | `/restore/create`、`/restore/status` |
| `destruction` | 销毁状态、执行、只读安全态 | `/ops/destruction`、`/ops/destruction/status` |
| `audit` | 审计导出/校验、证据登记与查询 | `/audit/*`、`/ops/evidence/*` |

## 角色与权限标识

前端使用 `v-hasPermi` 控制按钮可见性；后端（BFF 与 KDS）仍强制校验。

| 权限标识 | 用途 | 角色 |
|----------|------|------|
| `kds:ops:view` | 运营状态与告警查看 | ADMIN |
| `kds:ops:test` | 发送测试告警 | ADMIN |
| `kds:device:list` | 设备列表/详情 | ADMIN |
| `kds:key:view` | 密钥与通道查询 | ADMIN / KEY_ADMIN |
| `kds:sbox:manage` | S 盒激活、通道回滚 | ADMIN / KEY_ADMIN |
| `kds:restore:manage` | 创建恢复任务 | ADMIN |
| `kds:destruction:execute` | 执行应急销毁 | ADMIN |
| `kds:audit:view` | 审计链校验、证据查询 | ADMIN / AUDITOR |
| `kds:audit:export` | 审计导出 | ADMIN |
| `kds:evidence:manage` | 证据登记 | ADMIN |

角色矩阵：`ADMIN` 全量；`KEY_ADMIN` 仅设备/密钥/通道/S 盒；`AUDITOR` 仅审计与证据只读。

## 安全约束

- 破坏性操作（销毁、通道回滚、S 盒激活、恢复）必须输入确认词。
- 页面不渲染私钥、PIN、Token、密钥明文、包装密文、S 盒参数明文、完整 webhook URL 或证书正文。
- 告警配置仅显示主机与掩码，不提供复制完整地址入口。
- 通道回滚仅提供「上一版本」，无任意版本选择。

## 构建

```bash
cd pki-ui
npm run lint:eslint
npm run build:kds      # VITE_APP_TENANT_IDS=21
```

## UI-01..06 验收映射

| 需求 | 证据 |
|------|------|
| UI-01 | `src/api/kds/client.ts`、`src/types/kds/index.ts`、`build:kds` |
| UI-02 | `views/kds/device`、`views/kds/key`、`views/kds/sbox` |
| UI-03 | `views/kds/restore` |
| UI-04 | `views/kds/destruction` |
| UI-05 | `views/kds/ops/status`、`views/kds/ops/alerts` |
| UI-06 | 本 README 角色矩阵 + 各页 `v-hasPermi` + 确认词 |
