<template>
  <div class="app-container kds-page">
    <KdsPageHeader title="MMJ V0.3 联调" description="按协议顺序验证连接、状态同步、密钥分发、主通道切换和 S 盒部署。" />
    <el-card shadow="hover" class="kds-panel device-card">
      <template #header>
        <div class="kds-panel__header">
          <span>MMJ 设备管理</span>
          <el-button v-hasPermi="['kds:mmj:manage']" type="primary" icon="Plus" @click="openRegister">注册设备</el-button>
        </div>
      </template>
      <el-table :data="devices" v-loading="deviceListLoading" highlight-current-row @current-change="selectDevice">
        <el-table-column prop="deviceSn" label="设备号" min-width="180" />
        <el-table-column prop="baseUrl" label="HTTPS 地址" min-width="260" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }"><el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '已启用' : '已停用' }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="resourceVersion" label="版本" width="80" />
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="selectDevice(row)">在线管理</el-button>
            <el-button v-hasPermi="['kds:mmj:manage']" link type="primary" @click.stop="openEdit(row)">编辑</el-button>
            <el-button v-hasPermi="['kds:mmj:manage']" link :type="row.enabled ? 'danger' : 'success'" @click.stop="toggleDevice(row)">
              {{ row.enabled ? '停用' : '启用' }}
            </el-button>
            <el-button v-hasPermi="['kds:mmj:manage']" link type="primary" @click.stop="openCertificate(row)">证书</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-card shadow="hover" class="kds-panel">
      <template #header><div class="kds-panel__header"><span>联调目标</span><el-tag effect="plain">V0.3</el-tag></div></template>
      <div class="device-selector">
        <span class="device-selector__label">设备号</span>
        <el-select
          v-model="deviceSn"
          filterable
          :loading="deviceListLoading"
          :disabled="running"
          placeholder="请选择已注册的 MMJ 设备"
          no-data-text="暂无已注册的 MMJ 设备"
          @change="handleDeviceChange"
        >
          <el-option
            v-for="item in devices"
            :key="item.deviceSn"
            :label="item.deviceSn"
            :value="item.deviceSn"
          >
            <div class="device-option">
              <span>{{ item.deviceSn }}</span>
              <el-tag :type="item.enabled ? 'success' : 'info'" size="small" effect="plain">
                {{ item.enabled ? '已启用' : '已停用' }}
              </el-tag>
            </div>
          </el-option>
        </el-select>
        <el-button icon="Refresh" :loading="deviceListLoading" :disabled="running" @click="loadDevices">刷新列表</el-button>
      </div>
      <el-descriptions :column="2" border v-loading="loading">
        <el-descriptions-item label="设备号">{{ device?.deviceSn || deviceSn || '-' }}</el-descriptions-item>
        <el-descriptions-item label="HTTPS 地址">{{ device?.baseUrl || '-' }}</el-descriptions-item>
        <el-descriptions-item label="启用">{{ device?.enabled ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="状态新鲜度">{{ status?.freshness || '-' }}</el-descriptions-item>
      </el-descriptions>
      <div class="kds-section-title"><span>联调流程</span><span class="kds-muted">请按顺序执行</span></div>
      <el-steps :active="completed" finish-status="success" class="steps">
        <el-step v-for="step in steps" :key="step.operation" :title="step.label" />
      </el-steps>
      <div class="actions">
        <el-button v-for="(step, index) in steps" :key="step.operation" type="primary"
          :disabled="running || !deviceSn || !device?.enabled || index > completed" @click="run(step)">{{ step.label }}</el-button>
      </div>
      <el-alert v-if="task" :type="task.state === 'SUCCEEDED' ? 'success' : task.state === 'FAILED' ? 'error' : 'info'"
        :title="`${task.operation}: ${task.state}${task.remoteCode ? ' / ' + task.remoteCode : ''}`" show-icon :closable="false" />
    </el-card>
    <el-dialog v-model="dialogVisible" :title="dialogMode === 'register' ? '注册 MMJ 设备' : dialogMode === 'edit' ? '编辑 MMJ 设备' : '更新 MMJ 公钥证书'" width="min(640px, 92vw)">
      <el-form label-position="top">
        <el-form-item v-if="dialogMode === 'register'" label="设备号">
          <el-input v-model="form.deviceSn" maxlength="128" placeholder="例如 MMJ-SN-2026-001" />
        </el-form-item>
        <el-form-item v-if="dialogMode !== 'certificate'" label="固定 HTTPS 地址">
          <el-input v-model="form.baseUrl" placeholder="https://10.0.0.20:9443" />
        </el-form-item>
        <el-form-item v-if="dialogMode !== 'edit'" label="MMJ 公钥证书 PEM">
          <el-input v-model="form.certificateChainPem" type="textarea" :rows="8" placeholder="仅允许 BEGIN CERTIFICATE，不得粘贴私钥" />
        </el-form-item>
        <el-form-item v-if="dialogMode === 'register'" label="初始状态">
          <el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveDevice">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import KdsPageHeader from '@/views/kds/components/KdsPageHeader.vue';
import { getMmjDevice, getMmjStatus, getMmjTask, listMmjDevices, MMJ_DEVICE_SN, registerMmjDevice, setMmjDeviceEnabled, stageMmjCertificate, startMmjOperation, updateMmjDevice } from '@/api/kds/mmj';
import type { MmjDevice, MmjStatus, MmjTask } from '@/api/kds/mmj';

const deviceSn = ref('');
const devices = ref<MmjDevice[]>([]);
const device = ref<MmjDevice>();
const status = ref<MmjStatus>();
const task = ref<MmjTask>();
const deviceListLoading = ref(false);
const loading = ref(false);
const running = ref(false);
const completed = ref(0);
const dialogVisible = ref(false);
const dialogMode = ref<'register' | 'edit' | 'certificate'>('register');
const saving = ref(false);
const editingDevice = ref<MmjDevice>();
const form = reactive({ deviceSn: '', baseUrl: '', certificateChainPem: '', enabled: true });
const testKeys = Array.from({ length: 16 }, (_, index) => ({
  keyId: `UAT-KEY-${String(index + 1).padStart(2, '0')}`,
  keyVersion: 'v1',
  providerRef: `test-${String(index + 1).padStart(2, '0')}`,
  channelName: `CH-${String(index + 1).padStart(2, '0')}`
}));
const steps = [
  { label: '连接测试', operation: 'connection-tests' as const, body: {} },
  { label: '状态刷新', operation: 'status/refresh' as const, body: {} },
  { label: '密钥分发', operation: 'key-distributions' as const, body: { keys: testKeys } },
  { label: '主通道切换', operation: 'master-channels' as const, body: { keys: testKeys } },
  { label: 'S 盒部署', operation: 'sbox-deployments' as const,
    body: { versionRef: 'uat-v1', effectiveMode: 'IMMEDIATE', effectiveAt: null, targetChannels: testKeys.map((key) => key.channelName) } }
];

async function refresh() {
  if (!deviceSn.value) {
    device.value = undefined;
    status.value = undefined;
    return;
  }
  loading.value = true;
  try {
    [device.value, status.value] = await Promise.all([
      getMmjDevice(deviceSn.value),
      getMmjStatus(deviceSn.value)
    ]);
  } finally {
    loading.value = false;
  }
}

async function loadDevices() {
  deviceListLoading.value = true;
  try {
    const page = await listMmjDevices();
    devices.value = page.items || [];
    const selectedStillExists = devices.value.some((item) => item.deviceSn === deviceSn.value);
    if (!selectedStillExists) {
      deviceSn.value = devices.value.find((item) => item.deviceSn === MMJ_DEVICE_SN)?.deviceSn
        || devices.value[0]?.deviceSn
        || '';
      resetProgress();
    }
    await refresh();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'MMJ 设备列表加载失败');
  } finally {
    deviceListLoading.value = false;
  }
}

function resetProgress() {
  device.value = undefined;
  status.value = undefined;
  task.value = undefined;
  completed.value = 0;
}

async function handleDeviceChange() {
  resetProgress();
  await refresh();
}

async function selectDevice(row?: MmjDevice) {
  if (!row || running.value) return;
  deviceSn.value = row.deviceSn;
  resetProgress();
  await refresh();
}

function clearForm() {
  Object.assign(form, { deviceSn: '', baseUrl: '', certificateChainPem: '', enabled: true });
  editingDevice.value = undefined;
}

function openRegister() {
  clearForm();
  dialogMode.value = 'register';
  dialogVisible.value = true;
}

function openEdit(row: MmjDevice) {
  clearForm();
  editingDevice.value = row;
  form.deviceSn = row.deviceSn;
  form.baseUrl = row.baseUrl;
  dialogMode.value = 'edit';
  dialogVisible.value = true;
}

function openCertificate(row: MmjDevice) {
  clearForm();
  editingDevice.value = row;
  form.deviceSn = row.deviceSn;
  dialogMode.value = 'certificate';
  dialogVisible.value = true;
}

async function saveDevice() {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(form.deviceSn)) return ElMessage.warning('设备号格式不正确');
  if (dialogMode.value !== 'certificate' && !form.baseUrl.startsWith('https://')) return ElMessage.warning('必须填写固定 HTTPS 地址');
  if (dialogMode.value !== 'edit' && (!form.certificateChainPem.includes('BEGIN CERTIFICATE') || form.certificateChainPem.includes('PRIVATE KEY'))) {
    return ElMessage.warning('请填写不含私钥的公钥证书 PEM');
  }
  saving.value = true;
  try {
    if (dialogMode.value === 'register') await registerMmjDevice(form.deviceSn, form.baseUrl, form.certificateChainPem, form.enabled);
    else if (dialogMode.value === 'edit' && editingDevice.value) await updateMmjDevice(editingDevice.value, form.baseUrl);
    else await stageMmjCertificate(form.deviceSn, form.certificateChainPem);
    ElMessage.success('请求已受理');
    dialogVisible.value = false;
    await loadDevices();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

async function toggleDevice(row: MmjDevice) {
  try {
    await ElMessageBox.confirm(`${row.enabled ? '停用' : '启用'}设备 ${row.deviceSn}？`, '设备状态确认', { type: 'warning' });
    await setMmjDeviceEnabled(row, !row.enabled);
    ElMessage.success('请求已受理');
    await loadDevices();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '操作失败');
  }
}

async function run(step: (typeof steps)[number]) {
  running.value = true;
  try {
    const accepted = await startMmjOperation(deviceSn.value, step.operation, step.body);
    for (let attempt = 0; attempt < 30; attempt++) {
      task.value = await getMmjTask(accepted.taskId);
      if (['SUCCEEDED', 'FAILED', 'RESULT_UNKNOWN', 'CANCELLED'].includes(task.value.state)) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (task.value?.state === 'SUCCEEDED') completed.value = Math.max(completed.value, steps.indexOf(step) + 1);
    await refresh();
  } finally {
    running.value = false;
  }
}

onMounted(loadDevices);
</script>

<style scoped>
.device-selector { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.device-card { margin-bottom: 18px; }
.device-selector__label { flex: 0 0 auto; color: var(--el-text-color-regular); font-weight: 600; }
.device-selector :deep(.el-select) { width: min(420px, 100%); }
.device-option { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; }
.steps { margin: 28px 0; }
.actions { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }

@media (max-width: 640px) {
  .device-selector { align-items: stretch; flex-direction: column; }
  .device-selector :deep(.el-select) { width: 100%; }
}
</style>
<style src="../styles/page.css"></style>
