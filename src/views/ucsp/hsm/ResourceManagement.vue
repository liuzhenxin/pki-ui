<template>
  <main class="app-container hsm-management">
    <header class="page-heading">
      <h1>{{ title }}</h1>
      <div class="heading-actions">
        <el-button :loading="loading" @click="reload">刷新</el-button>
        <el-button v-hasPermi="[write]" type="primary" :disabled="loading || failed" @click="open()">{{ addLabel }}</el-button>
      </div>
    </header>

    <el-alert v-if="failed" title="密码资源加载失败，请刷新重试" type="error" show-icon :closable="false" />
    <el-card v-else shadow="never">
      <el-table v-if="mode === 'agents'" v-loading="loading" :data="directory.agents" row-key="key" empty-text="暂无已登记的 SDF Agent">
        <el-table-column prop="key" label="Agent 标识" min-width="180" />
        <el-table-column label="启用状态" min-width="108">
          <template #default="{ row }"
            ><el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '已启用' : '已停用' }}</el-tag></template
          >
        </el-table-column>
        <el-table-column label="上报状态" min-width="110">
          <template #default="{ row }"
            ><el-tag :type="health[row.health]?.type">{{ health[row.health]?.label }}</el-tag></template
          >
        </el-table-column>
        <el-table-column label="最近上报" min-width="165">
          <template #default="{ row }">{{ row.reportedAt ? new Date(row.reportedAt).toLocaleString() : '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template #default="{ row }"><el-button v-hasPermi="[write]" link type="primary" @click="open(row)">编辑</el-button></template>
        </el-table-column>
      </el-table>

      <el-table v-else-if="mode === 'devices'" v-loading="loading" :data="directory.devices" row-key="key" empty-text="暂无已绑定的密码机">
        <el-table-column prop="key" label="密码机标识" min-width="180" />
        <el-table-column prop="agentKey" label="SDF Agent" min-width="160" />
        <el-table-column prop="poolKey" label="资源池" min-width="160" />
        <el-table-column label="调度状态" min-width="110">
          <template #default="{ row }">
            <el-tag :type="row.available ? 'success' : 'info'">{{ row.available ? '可调度' : row.enabled ? '暂不可用' : '已停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template #default="{ row }"><el-button v-hasPermi="[write]" link type="primary" @click="open(row)">编辑</el-button></template>
        </el-table-column>
      </el-table>

      <el-table v-else v-loading="loading" :data="directory.pools" row-key="key" empty-text="暂无已配置的密码机资源池">
        <el-table-column prop="key" label="资源池标识" min-width="155" />
        <el-table-column prop="serviceName" label="密码机服务名称" min-width="170" />
        <el-table-column prop="region" label="区域" min-width="100" />
        <el-table-column label="可调度密码机" min-width="125">
          <template #default="{ row }">{{ memberCount(row.key, true) }} / {{ memberCount(row.key, false) }}</template>
        </el-table-column>
        <el-table-column label="每种能力池配额" min-width="125">
          <template #default="{ row }">{{ row.maxRequests }} 次 / {{ row.windowSeconds }} 秒</template>
        </el-table-column>
        <el-table-column label="服务状态" min-width="105">
          <template #default="{ row }"
            ><el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '已启用' : '已停用' }}</el-tag></template
          >
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template #default="{ row }"><el-button v-hasPermi="[write]" link type="primary" @click="open(row)">编辑</el-button></template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="editing ? '编辑' + resourceName : addLabel" width="min(520px, calc(100vw - 24px))" destroy-on-close>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item :label="keyLabel" required>
          <el-input v-if="editing" :model-value="form.key" disabled />
          <el-select v-else v-model="form.key" :placeholder="'选择' + resourceName" filterable>
            <el-option v-for="option in options" :key="option" :label="option" :value="option" />
          </el-select>
        </el-form-item>
        <p v-if="!editing && !options.length" class="field-hint">{{ emptyOptions }}</p>
        <template v-if="mode === 'pools'">
          <el-form-item label="区域" required><el-input v-model="form.region" maxlength="64" /></el-form-item>
          <el-form-item label="密码机服务名称" required><el-input v-model="form.serviceName" maxlength="120" /></el-form-item>
          <div class="quota-fields">
            <el-form-item label="每种能力的请求上限（次）" required
              ><el-input-number v-model="form.maxRequests" :min="1" :max="2147483647" :precision="0"
            /></el-form-item>
            <el-form-item label="统计窗口（秒）" required
              ><el-input-number v-model="form.windowSeconds" :min="1" :max="86400" :precision="0"
            /></el-form-item>
          </div>
          <p v-if="editing" class="field-hint">保存资源池配置会更新密码机服务版本，请为已接入的应用重新保存授权。</p>
        </template>
        <template v-if="mode === 'devices' && selected">
          <el-form-item label="SDF Agent"><el-input :model-value="selected.agentKey" disabled /></el-form-item>
          <el-form-item label="资源池"><el-input :model-value="selected.poolKey" disabled /></el-form-item>
        </template>
        <el-form-item :label="mode === 'pools' ? '启用密码机服务' : '启用'"><el-switch v-model="form.enabled" /></el-form-item>
        <el-alert v-if="saveError" :title="saveError" type="error" show-icon :closable="false" />
      </el-form>
      <template #footer>
        <el-button :disabled="saving" @click="dialog = false">取消</el-button>
        <el-button v-hasPermi="[write]" type="primary" :loading="saving" :disabled="!canSave" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </main>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { getDirectory, saveAgent, saveDevice, savePool } from '@/api/ucsp/hsm';
import type { Agent, Device, Directory, Pool } from '@/api/ucsp/hsm';

const { mode } = defineProps<{ mode: 'agents' | 'devices' | 'pools' }>();
const write = 'ucsp:hsm:write';
const labels = {
  agents: { title: 'Agent 管理', name: 'SDF Agent', key: 'Agent 标识', add: '登记 Agent', empty: '暂无可登记的 Agent，请检查部署配置。' },
  devices: { title: '密码机管理', name: '密码机', key: '密码机标识', add: '绑定密码机', empty: '请先登记对应 Agent 并新建资源池。' },
  pools: { title: '资源池管理', name: '资源池', key: '资源池标识', add: '新建资源池', empty: '暂无可用资源池，请检查部署配置。' }
};
const title = computed(() => labels[mode].title);
const resourceName = computed(() => labels[mode].name);
const keyLabel = computed(() => labels[mode].key);
const addLabel = computed(() => labels[mode].add);
const emptyOptions = computed(() => labels[mode].empty);
const health: Record<string, { type: 'info' | 'success' | 'warning' | 'danger'; label: string }> = {
  PENDING: { type: 'info', label: '待上报' },
  STALE: { type: 'warning', label: '上报超时' },
  HEALTHY: { type: 'success', label: '健康' },
  DEGRADED: { type: 'warning', label: '降级' },
  UNHEALTHY: { type: 'danger', label: '异常' }
};
const directory = ref<Directory>({ targets: [], agents: [], devices: [], pools: [] });
const loading = ref(false);
const failed = ref(false);
const dialog = ref(false);
const editing = ref(false);
const saving = ref(false);
const saveError = ref('');
const newForm = (): Pool => ({ key: '', region: '', serviceName: '', enabled: true, maxRequests: 100, windowSeconds: 60, version: 0 });
const form = ref(newForm());

const candidates = computed(() => {
  const { targets, agents, pools, devices } = directory.value;
  if (mode === 'agents') return targets.filter((target) => !agents.some((agent) => agent.key === target.agentKey));
  if (mode === 'pools') {
    return targets.filter((target) => !pools.some((pool) => pool.key === target.poolKey));
  }
  return targets.filter(
    (target) =>
      agents.some((agent) => agent.key === target.agentKey) &&
      pools.some((pool) => pool.key === target.poolKey) &&
      !devices.some((device) => device.key === target.deviceKey)
  );
});
const options = computed(() => {
  const key = mode === 'agents' ? 'agentKey' : mode === 'pools' ? 'poolKey' : 'deviceKey';
  return [...new Set(candidates.value.map((target) => target[key]))];
});
const selected = computed(() => {
  if (mode === 'devices') {
    return editing.value
      ? (directory.value.devices.find((device) => device.key === form.value.key) ?? null)
      : candidates.value.find((target) => target.deviceKey === form.value.key);
  }
  return candidates.value.find((target) => target.poolKey === form.value.key);
});
const memberCount = (pool: string, available: boolean) =>
  directory.value.devices.filter((item) => item.poolKey === pool && (!available || item.available)).length;
const canSave = computed(() => {
  if (!form.value.key) return false;
  if (mode !== 'pools') return true;
  const { region, serviceName, maxRequests, windowSeconds } = form.value;
  return Boolean(region.trim() && serviceName.trim() && maxRequests > 0 && windowSeconds > 0);
});

async function reload() {
  loading.value = true;
  failed.value = false;
  try {
    const response = await getDirectory();
    if (!response.data) throw new Error('missing directory');
    directory.value = response.data;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

function open(item?: Agent | Device | Pool) {
  editing.value = Boolean(item);
  form.value = { ...newForm(), ...item };
  saveError.value = '';
  dialog.value = true;
}

async function submit() {
  if (saving.value || !canSave.value) return;
  saving.value = true;
  saveError.value = '';
  const { key, enabled } = form.value;
  try {
    if (mode === 'agents') await saveAgent({ key, enabled });
    else if (mode === 'devices' && selected.value)
      await saveDevice({ key, enabled, poolKey: selected.value.poolKey, agentKey: selected.value.agentKey });
    else if (mode === 'pools') await savePool(form.value);
    else throw new Error('missing deployment binding');
    dialog.value = false;
    ElMessage.success('配置已保存');
    await reload();
  } catch {
    saveError.value = '保存失败，请检查配置或刷新后重试。';
  } finally {
    saving.value = false;
  }
}

onMounted(reload);
</script>

<style scoped>
.page-heading,
.heading-actions,
.quota-fields {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.page-heading {
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-heading h1 {
  margin: 0;
  font-size: 22px;
}

.heading-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.el-select {
  width: 100%;
}

.field-hint {
  margin: 0 0 16px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.55;
}
</style>
