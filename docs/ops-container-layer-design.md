# OPS 容器管理 · 分层视图改造设计

> 状态：已评审（设计定稿，尚未实施）。
> 目标：把当前扁平的"容器管理"大列表改造为**按资源栈分层**的运维视图，
> 不改权限/白名单语义与升级规则。

## 1. 分层模型（对齐六层 + 工具/支撑类）

| 层 | 容器 | 说明 |
|---|---|---|
| 基础资源 | mysql、redis、kafka、syslog、log-forwarder、ops-agent/executor、socket-proxy | 数据面与控制面支撑，通常只读监控 |
| 服务发现 | nacos | |
| 网关 | gateway | |
| 平台服务 | snowflake-id、admin、auth、ops | |
| 业务领域 | crypto、ca、kmc、ra、ocsp | 密码机相关（可加 HSM `/ready` 角标） |
| Web 前端 | ui-ops、ui-ca、ui-kmc、ui-ra、(ui-ocsp) | |

- **分层键**：优先用容器标签 `com.docker.compose.project.working_dir` 的路径段
  （`/opt/pki-docker/pki-domain-stack/…` → 业务领域），前端再用「服务名 → 层」映射兜底
  （兼容无标签的裸容器）。后端无需新增库字段。
- **权限不变**：可见 = agent 监控白名单；可操作 = executor 操作白名单
  （`manageable(row)` 才显示 停止/重启/升级，其余行灰显"仅监控"）。
- **升级规则不变**：只认纯 `x.y.z` 正式版本（沿用现有仓库扫描缓存）。

## 2. 页面形态

- 折叠式分组列表（层头可折叠/展开，折叠状态存 `localStorage`），层顺序 = 启动顺序；
- 层头聚合：**服务数 / 异常数 / 可升级数**（异常层红/黄点）；
- 顶部工具栏：搜索（容器/镜像/tag）、筛选 chips（只看异常 / 只看可升级 / 只看可操作）、刷新；
- 行保留字段：健康圆点+容器名、镜像 tag、版本/提示列（可升级、HSM 失败等角标）、操作列；
- 行内可选：展开抽屉显示 compose 组合、版本扫描状态/错误、HSM ready（crypto/kmc）。

## 3. 实施文件规划（里程碑 1）

```
src/views/ops/container/
├── index.vue                  # 改：容器管理入口 → 分层视图
├── ContainerLayerList.vue     # 新：分层折叠列表（层头聚合 + 行）
├── ContainerLayerHead.vue     # 新：层头（名称/聚合 badge/折叠箭头）
└── ContainerRowActions.vue    # 新：行操作（manageable 控制按钮）
```

- 数据/状态沿用现有接口与结构不变；
- 新增纯前端派生 `groupByLayer(containers)`（标签 → 层，映射兜底）；
- 层常量与顺序维护在 container 目录常量中；
- 升级对话框、详情抽屉、日志入口复用现有实现。

## 4. 明确不做（本期）

- 后端/接口零改动；不为 layer 加库字段；
- 不改权限/白名单语义；不改升级的版本规则。

## 5. 里程碑拆分

1. 前端分组 + 折叠 + 层头聚合（后端不动）
2. 搜索/筛选/状态徽标打磨
3. （可选）HSM `/ready` 角标、升级向导增强、按层告警订阅（需后端加 layer 字段）

## 6. 验收

1. 各层容器数 = `docker ps` 按 compose 路径归类一致；
2. 折叠/聚合/筛选与原型一致；白名单外容器始终无操作按钮；
3. `yarn build:ops` 通过；单容器升级、详情、日志入口回归可用。

> 交互原型（临时）：`ops-container-layer-ui.html`（不入库）。
