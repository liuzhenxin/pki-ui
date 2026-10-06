<template>
  <div class="ukey-page">
    <el-card v-loading="loading">
      <template #header
        ><div class="toolbar">
          <span>设备 UKey 身份</span>
          <el-button v-hasPermi="['hsm:ukey:login']" :disabled="busy" @click="logout">设备身份登出</el-button
          ><el-button v-hasPermi="['hsm:ukey:view']" :disabled="busy" @click="refresh">刷新</el-button>
        </div></template
      >
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
      <template v-if="status">
        <el-alert v-if="!status.hostAvailable" title="主机 SKF 未连接或未配置，暂不能任命和登录。" type="warning" show-icon :closable="false" />
        <p>设备：{{ status.device }}。电脑端 UKey 用于平台登录；本页操作插在密码机主机上的 UKey。</p>
        <el-form :inline="true" label-width="100px">
          <el-form-item label="管理员数量"
            ><el-select v-model="counts.administrators" :disabled="busy" class="count-select"
              ><el-option v-for="n in [3, 5]" :key="n" :label="`${n} 把`" :value="n" /></el-select
          ></el-form-item>
          <el-form-item label="操作员数量"
            ><el-select v-model="counts.operators" :disabled="busy" class="count-select"
              ><el-option v-for="n in [3, 5]" :key="n" :label="`${n} 把`" :value="n" /></el-select
          ></el-form-item>
          <el-form-item><el-button v-hasPermi="['hsm:ukey:manage']" :disabled="busy" @click="saveCounts">保存数量</el-button></el-form-item>
        </el-form>
        <el-alert :title="authorizationText" type="info" :closable="false" />
        <div class="table-wrap">
          <el-table :data="slots" class="identity-table">
            <el-table-column label="身份" min-width="120"
              ><template #default="{ row }">{{ roleName(row.role) }}</template></el-table-column
            >
            <el-table-column prop="slot" label="槽位" width="70" />
            <el-table-column label="绑定账号" min-width="100"
              ><template #default="{ row }">{{ row.binding?.userId || '未任命' }}</template></el-table-column
            >
            <el-table-column label="UKey 指纹" min-width="170"
              ><template #default="{ row }"
                ><span :title="row.binding?.fingerprint">{{ row.binding?.fingerprint.slice(0, 16) || '—' }}</span></template
              ></el-table-column
            >
            <el-table-column label="状态" min-width="140"
              ><template #default="{ row }">{{
                !row.binding
                  ? '未任命'
                  : !row.binding.active
                    ? '已撤销'
                    : row.binding.present
                      ? '主机已插接'
                      : status.hostAvailable
                        ? '未插接'
                        : '插接状态未知'
              }}</template></el-table-column
            >
            <el-table-column label="操作" min-width="250"
              ><template #default="{ row }">
                <el-button
                  v-if="!row.binding"
                  v-hasPermi="['hsm:ukey:manage']"
                  link
                  type="primary"
                  :disabled="busy || !status.hostAvailable"
                  @click="open(row, 'APPOINT')"
                  >任命</el-button
                >
                <el-button
                  v-if="row.binding"
                  v-hasPermi="['hsm:ukey:manage']"
                  link
                  type="primary"
                  :disabled="busy || !status.hostAvailable"
                  @click="open(row, 'REPLACE')"
                  >替换</el-button
                >
                <el-button v-if="row.binding?.active" v-hasPermi="['hsm:ukey:manage']" link type="danger" :disabled="busy" @click="revoke(row)"
                  >撤销</el-button
                >
                <el-button
                  v-if="row.binding?.active"
                  v-hasPermi="['hsm:ukey:login']"
                  link
                  type="primary"
                  :disabled="busy || !row.binding.present"
                  @click="open(row, 'LOGIN')"
                  >登录</el-button
                >
              </template></el-table-column
            >
          </el-table>
        </div>

        <p>任命绑定当前平台账号。替换会撤销旧身份和登录授权；备份分量换代需在备份功能中另行完成。</p>
        <h3>最近身份操作</h3>
        <div class="table-wrap">
          <el-table :data="status.auditEvents">
            <el-table-column prop="occurredAt" label="时间" min-width="170" />
            <el-table-column prop="operation" label="操作" min-width="160" />
            <el-table-column prop="userId" label="账号" width="100" />
            <el-table-column prop="outcome" label="结果" width="110" />
            <el-table-column prop="summary" label="摘要" min-width="220" show-overflow-tooltip />
          </el-table>
        </div>
      </template>
    </el-card>
    <el-dialog
      v-model="dialog"
      :title="dialogTitle"
      width="min(520px, 95vw)"
      :close-on-click-modal="false"
      :close-on-press-escape="!busy"
      :show-close="!busy"
      @closed="clearPin"
    >
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="密码机主机上的 UKey">
          <el-select v-model="certificateKey" :disabled="busy" class="key-select"
            ><el-option
              v-for="cert in selectableCertificates"
              :key="cert.key"
              :value="cert.key"
              :label="`${cert.fingerprint.slice(0, 16)} · ${cert.key}`"
          /></el-select>
        </el-form-item>
        <el-form-item label="UKey 用户 PIN"
          ><el-input v-model="pin" type="password" autocomplete="off" :maxlength="64" :disabled="busy"
        /></el-form-item>
        <el-alert title="PIN 仅用于本次主机 SKF 认证，不保存。请通过 HTTPS 访问管理界面。" type="info" :closable="false" />
      </el-form>
      <template #footer
        ><el-button :disabled="busy" @click="dialog = false">取消</el-button
        ><el-button type="primary" :loading="busy" :disabled="!certificateKey || !pin" @click="submit">确认</el-button></template
      >
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  challengeUkey,
  configureUkeys,
  confirmUkey,
  getUkeyStatus,
  logoutUkey,
  revokeUkey,
  type UkeyBinding,
  type UkeyRole,
  type UkeyStatus
} from '@/api/hsm/ukeys';
const status = ref<UkeyStatus | null>(null);
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const counts = ref({ administrators: 3, operators: 3 });
const dialog = ref(false);
const pin = ref('');
const certificateKey = ref('');
const selection = ref<{ role: UkeyRole; slot: number; binding?: UkeyBinding; purpose: 'APPOINT' | 'REPLACE' | 'LOGIN' } | null>(null);
const roleName = (role: UkeyRole) => (role === 'ADMINISTRATOR' ? '密钥管理员' : '密钥操作员');
const slots = computed(() => {
  if (!status.value) return [];
  return (['ADMINISTRATOR', 'OPERATOR'] as UkeyRole[]).flatMap((role) =>
    Array.from(
      { length: role === 'ADMINISTRATOR' ? status.value!.configuration.administrators : status.value!.configuration.operators },
      (_, index) => ({ role, slot: index + 1, binding: status.value!.bindings.find((b) => b.role === role && b.slot === index + 1) })
    )
  );
});
const authorizationText = computed(() =>
  status.value?.authorization
    ? `已登录${roleName(status.value.authorization.role)}，槽位 ${status.value.authorization.slot}，有效至 ${new Date(status.value.authorization.expiresAt).toLocaleString()}。实际操作仍需核验主机插接。`
    : '当前会话未登录设备身份。平台登录不替代设备 UKey 认证。'
);
const dialogTitle = computed(
  () =>
    `${selection.value?.purpose === 'LOGIN' ? '登录' : selection.value?.purpose === 'REPLACE' ? '替换' : '任命'}${selection.value ? roleName(selection.value.role) : ''}`
);
const selectableCertificates = computed(
  () =>
    status.value?.hostCertificates.filter((c) => selection.value?.purpose !== 'LOGIN' || c.fingerprint === selection.value.binding?.fingerprint) || []
);
function clearPin() {
  pin.value = '';
  certificateKey.value = '';
}
async function refresh() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await getUkeyStatus();
    status.value = response.data;
    counts.value = { administrators: response.data.configuration.administrators, operators: response.data.configuration.operators };
  } catch {
    status.value = null;
    error.value = '无法查询设备身份，请检查权限、设备连接和服务配置。';
  } finally {
    loading.value = false;
  }
}
function open(row: { role: UkeyRole; slot: number; binding?: UkeyBinding }, purpose: 'APPOINT' | 'REPLACE' | 'LOGIN') {
  clearPin();
  selection.value = { ...row, purpose };
  dialog.value = true;
  if (purpose === 'LOGIN') certificateKey.value = selectableCertificates.value[0]?.key || '';
}
async function submit() {
  if (!selection.value || busy.value) return;
  if (location.protocol !== 'https:') {
    ElMessage.warning('请通过 HTTPS 访问后进行 PIN 认证');
    return;
  }
  busy.value = true;
  const data = { ...selection.value, certificateKey: certificateKey.value };
  const currentPin = pin.value;
  pin.value = '';
  try {
    const challenge = await challengeUkey(data);
    await confirmUkey(challenge.data.id, currentPin, data.purpose !== 'LOGIN');
    dialog.value = false;
    ElMessage.success('操作完成');
    await refresh();
  } catch {
    error.value = '操作未完成，请刷新状态并重新认证。';
  } finally {
    pin.value = '';
    busy.value = false;
  }
}
async function saveCounts() {
  if (!status.value || busy.value) return;
  busy.value = true;
  try {
    await configureUkeys({ ...counts.value, revision: status.value.configuration.revision });
    ElMessage.success('数量已保存');
  } catch {
    error.value = '数量配置未保存，请检查槽位占用及身份版本。';
  } finally {
    busy.value = false;
    await refresh();
  }
}
async function revoke(row: { role: UkeyRole; slot: number }) {
  if (!status.value || busy.value) return;
  try {
    await ElMessageBox.confirm(`撤销${roleName(row.role)}槽位 ${row.slot}？该 UKey 将无法再次登录。`, '撤销设备身份', { type: 'warning' });
  } catch {
    return;
  }
  busy.value = true;
  try {
    await revokeUkey({ ...row, revision: status.value.configuration.revision });
    ElMessage.success('已撤销');
  } catch {
    error.value = '撤销未完成，请刷新后重试。';
  } finally {
    busy.value = false;
    await refresh();
  }
}
async function logout() {
  busy.value = true;
  try {
    await logoutUkey();
  } catch {
    error.value = '设备身份登出未完成。';
  } finally {
    busy.value = false;
    await refresh();
  }
}
onMounted(refresh);
onUnmounted(clearPin);
</script>
<style scoped>
.ukey-page {
  padding: 16px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.count-select {
  width: 100px;
}
.key-select {
  width: 100%;
}
.table-wrap {
  overflow-x: auto;
  margin-top: 16px;
}
.identity-table {
  min-width: 800px;
}
.logout {
  margin-top: 16px;
}
</style>
