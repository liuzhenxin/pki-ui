# OPS 操作进度 UI 发布与验证记录

## 1. 变更范围

本次优化 OPS 容器操作进度体验，涉及：

- `src/views/ops/components/OpsTaskProgressDrawer.vue`
- `src/views/ops/container/index.vue`

主要能力：

- 操作进度由弹窗改为右侧抽屉
- 展示操作编号、目标容器、服务器、耗时、当前步骤
- 展示步骤时间线和状态摘要
- 展示失败原因和处理建议
- 接入容器日志，支持刷新与复制
- 失败/完成/执行中状态下支持快捷查看日志和容器详情
- 支持在有权限时重试当前操作
- 日志与重试按钮按权限控制显示

## 2. 权限控制

抽屉内新增按钮遵循现有权限：

| 功能 | 权限 |
|---|---|
| 查看完整日志 / 刷新日志 / 复制日志 | `ops:container:logs` |
| 重试启动 | `ops:container:start` |
| 重试停止 | `ops:container:stop` |
| 重试重启 | `ops:container:restart` |
| 重试升级 | `ops:container:upgrade` |

后端仍应作为最终权限边界，前端权限仅用于交互隐藏。

## 3. 已执行验证

### 3.1 本地验证

```bash
cd pki-ui
npm run lint:eslint -- --fix=false src/views/ops/components/OpsTaskProgressDrawer.vue src/views/ops/container/index.vue
npm run build:ops
```

结果：通过。`build:ops` 存在项目既有 chunk size / 动态导入警告，不影响构建。

### 3.2 128 环境部署

服务器：`10.10.10.128`

容器：`pki-ui-ops`

部署方式：替换容器内 `/usr/share/nginx/html` 静态文件并 reload nginx。

验证：

```bash
curl -I http://127.0.0.1:9080/
```

结果：`HTTP/1.1 200 OK`

### 3.3 页面验证

使用 OPS 管理账号登录，验证码从 Redis 获取。

已验证：

- 登录 OPS 平台成功
- `/ops/containers` 容器管理页可访问
- 容器详情抽屉可打开
- 实时日志弹窗可打开
- 操作进度抽屉可打开
- 抽屉内日志区域可展示
- 快捷入口可展示

### 3.4 真实操作验证

执行操作：重启 `pki-nacos`

结果：成功。

操作记录：

```text
operationNo: OPS-0CFF5C136EA247649805BCCB5756C804
operationType: RESTART
containerName: pki-nacos
status: SUCCESS
currentStep: completed
steps: precheck -> restart -> completed
```

## 4. 128 环境备份与快照

已生成静态文件备份：

```text
/opt/pki-ui-backups/pki-ui-ops-html-20260913152235.tar.gz
/opt/pki-ui-backups/pki-ui-ops-html-20260913190825.tar.gz
```

已生成当前容器快照：

```text
pki-ui-ops:ops-progress-ui-20260913-final
10.10.10.178:5006/pki/pki-ui-ops:3.0.6
sha256:e7a01ab4b896629bdb94be9ea3d246058efc81537f6a09b6bdbb7ac79331877f
```

## 5. 回滚命令

如需回滚到某个备份：

```bash
BACKUP=/opt/pki-ui-backups/pki-ui-ops-html-YYYYMMDDHHMMSS.tar.gz

rm -rf /tmp/pki-ui-ops-rollback
mkdir -p /tmp/pki-ui-ops-rollback
tar -xzf "$BACKUP" -C /tmp/pki-ui-ops-rollback

docker exec pki-ui-ops sh -c 'rm -rf /usr/share/nginx/html/*'
docker cp /tmp/pki-ui-ops-rollback/. pki-ui-ops:/usr/share/nginx/html/
docker exec pki-ui-ops nginx -s reload

curl -I http://127.0.0.1:9080/
```

## 6. 上生产前建议

当前状态：已按生产版本 `pki-ui-ops:3.0.6` 发布到 178/128，并生成一汽大众离线包。

正式生产全量前建议补充：

1. 使用非管理员账号验证日志与重试按钮是否按权限隐藏。
2. 选择低风险容器执行一次重启验证。
3. 发布前备份生产 `pki-ui-ops` 静态文件。
4. 发布后观察 OPS 容器管理页与操作记录至少 1 天。

## 7. 离线交付产物

一汽大众离线目录：`liuzx-docker/offline-dist/`

```text
pki-ui-ops-3.0.6.tar.gz
pki-ui-ops-3.0.6-250.tar.gz
SHA256SUMS-ui-ops-3.0.6-20260913
```

镜像 digest：

```text
sha256:87a89a0caafbbfd40afe9fba5cf08647c5383d60330de64e84a2de23962a9355
```

