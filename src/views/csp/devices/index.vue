<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessageBox } from 'element-plus';
import { type ConsoleCommands, type ManagedDevice } from '@/api/csp/console';
import { consoleRequest } from '@/api/csp/gateway';
import { useCspConsoleStore } from '@/store/modules/cspConsole';

const session = useCspConsoleStore();
const devices = ref<ManagedDevice[]>([]);
const editor = ref<ConsoleCommands['device-save']>();
const error = ref('');
const notice = ref('');
const busy = ref(false);
const stale = ref(false);
const offset = ref(0);
const hasMore = ref(false);
const states = { REGISTERED: '待启用', ACTIVE: '已启用', DRAINING: '摘流中', SUSPENDED: '已停用', RETIRED: '已退役' } as const;
const health = { HEALTHY: '健康', UNHEALTHY: '异常', UNKNOWN: '未确认' } as const;

function editable(device: ManagedDevice) {
  return device.state === 'REGISTERED' || device.state === 'SUSPENDED';
}

function edit(device?: ManagedDevice) {
  editor.value = device
    ? {
        deviceKey: device.deviceKey,
        poolKey: device.poolKey,
        agentKey: device.agentKey,
        softwareVersion: device.softwareVersion,
        maxConcurrency: device.maxConcurrency,
        expectedVersion: device.version
      }
    : { deviceKey: '', poolKey: '', agentKey: '', softwareVersion: '', maxConcurrency: 1, expectedVersion: '0' };
  notice.value = '';
}

async function fetchPage(page: number) {
  const result = await consoleRequest('device-list', { offset: page });
  devices.value = result.items;
  offset.value = page;
  hasMore.value = result.hasMore;
}

async function refresh(page = offset.value) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await fetchPage(page);
    editor.value = undefined;
    stale.value = false;
  } catch (failure) {
    error.value = failure instanceof Error ? failure.message : '设备列表暂不可用。';
  } finally {
    busy.value = false;
  }
}

async function mutate(work: () => Promise<ManagedDevice>, message: string) {
  if (busy.value || stale.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await work();
    editor.value = undefined;
    notice.value = message;
    await fetchPage(offset.value);
  } catch (failure) {
    stale.value = true;
    error.value = failure instanceof Error ? failure.message : '操作未确认，请刷新后核对。';
  } finally {
    busy.value = false;
  }
}

function save() {
  const command = editor.value;
  if (!command) return;
  return mutate(() => consoleRequest('device-save', command), command.expectedVersion === '0' ? '设备已登记。' : '设备配置已保存。');
}

async function change(device: ManagedDevice, operation: 'SUSPEND' | 'RETIRE') {
  const retire = operation === 'RETIRE';
  try {
    await ElMessageBox.confirm(
      retire
        ? `删除设备「${device.deviceKey}」将保留退役记录。设备必须已停用或待启用，且无有效引用。`
        : `停用设备「${device.deviceKey}」后，新请求将不再路由到该设备。`,
      retire ? '删除设备' : '停用设备',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' }
    );
  } catch {
    return;
  }
  await mutate(
    () => consoleRequest('device-state', { deviceKey: device.deviceKey, expectedVersion: device.version, operation }),
    retire ? '设备已退役。' : '设备已停用。'
  );
}

onMounted(() => refresh(0));
</script>

<template>
  <section class="device-page" aria-labelledby="device-title">
    <header class="device-heading">
      <h1 id="device-title">设备列表</h1>
      <div class="device-actions">
        <el-button :disabled="busy" @click="refresh()">刷新</el-button>
        <el-button type="primary" :disabled="busy || stale" @click="edit()">添加密码机</el-button>
      </div>
    </header>
    <p v-if="error" role="alert" class="device-error">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="stale">请刷新列表并重新选择设备后再提交。</p>
    <div class="device-card device-table" role="region" aria-label="密码机列表" tabindex="0" :aria-busy="busy">
      <table>
        <thead>
          <tr>
            <th scope="col">设备标识</th>
            <th scope="col">资源池 / Agent</th>
            <th scope="col">固件版本</th>
            <th scope="col">并发上限</th>
            <th scope="col">管理状态</th>
            <th scope="col">健康状态</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="device in devices" :key="device.deviceKey">
            <th scope="row">{{ device.deviceKey }}</th>
            <td>
              {{ device.poolKey }}<small>{{ device.agentKey }}</small>
            </td>
            <td>{{ device.softwareVersion }}</td>
            <td>{{ device.maxConcurrency }}</td>
            <td>{{ states[device.state] }}</td>
            <td>{{ health[device.health] }}</td>
            <td>
              <el-button v-if="editable(device)" link type="primary" :disabled="busy || stale" @click="edit(device)">修改</el-button>
              <el-button
                v-if="device.state === 'ACTIVE' || device.state === 'DRAINING'"
                link
                :disabled="busy || stale"
                @click="change(device, 'SUSPEND')"
                >停用</el-button
              >
              <el-button v-if="editable(device)" link type="danger" :disabled="busy || stale" @click="change(device, 'RETIRE')">删除</el-button>
            </td>
          </tr>
          <tr v-if="!devices.length && !busy && !error">
            <td colspan="7">暂无已登记的密码机。</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="offset || hasMore" class="device-actions device-pagination">
      <el-button :disabled="busy || offset === 0" @click="refresh(offset - 50)">上一页</el-button>
      <el-button :disabled="busy || !hasMore" @click="refresh(offset + 50)">下一页</el-button>
    </div>

    <form v-if="editor" class="device-card device-editor" @submit.prevent="save">
      <h2>{{ editor.expectedVersion === '0' ? '登记密码机' : '修改密码机' }}</h2>
      <p v-if="editor.expectedVersion === '0'">请填写运维已登记的 SDF 资源池和 Agent 标识。设备启用须通过恢复验证。</p>
      <fieldset :disabled="busy || stale">
        <label>设备标识<input v-model.trim="editor.deviceKey" required maxlength="128" :readonly="editor.expectedVersion !== '0'" /></label>
        <label>资源池标识<input v-model.trim="editor.poolKey" required maxlength="128" :readonly="editor.expectedVersion !== '0'" /></label>
        <label>Agent 标识<input v-model.trim="editor.agentKey" required maxlength="128" :readonly="editor.expectedVersion !== '0'" /></label>
        <label>固件版本<input v-model.trim="editor.softwareVersion" required maxlength="64" /></label>
        <label>并发上限<input v-model.number="editor.maxConcurrency" required type="number" min="1" max="10000" /></label>
      </fieldset>
      <div class="device-actions">
        <el-button :disabled="busy" @click="editor = undefined">取消</el-button>
        <el-button native-type="submit" type="primary" :disabled="busy || stale">保存设备</el-button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.device-page {
  padding: 24px;
}
.device-heading,
.device-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.device-heading {
  justify-content: space-between;
  flex-wrap: wrap;
}
.device-card {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.device-table {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  white-space: nowrap;
}
th,
td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
small {
  display: block;
  color: var(--el-text-color-secondary);
}
.device-pagination {
  justify-content: flex-end;
  margin-top: 12px;
}
.device-editor fieldset {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 185px), 1fr));
  gap: 16px;
  padding: 0;
  border: 0;
}
.device-editor label {
  display: grid;
  gap: 6px;
}
.device-editor input {
  width: 100%;
  min-height: 36px;
  padding: 6px 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}
.device-editor .device-actions {
  justify-content: flex-end;
  margin-top: 16px;
}
.device-error {
  color: var(--el-color-danger);
}
@media (max-width: 640px) {
  .device-page {
    padding: 14px;
  }
}
</style>
