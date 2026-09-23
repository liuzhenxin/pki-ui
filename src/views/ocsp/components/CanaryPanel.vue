<template>
  <el-card shadow="hover" class="panel">
    <template #header
      ><div class="header"><b>Canary 候选</b><el-tag type="warning">候选隔离，提升后才切换权威</el-tag></div></template
    >
    <el-form :model="form" label-width="120px">
      <el-row :gutter="12"
        ><el-col :span="6"
          ><el-form-item label="CA ID"><el-input-number v-model="form.caId" :min="1" /></el-form-item></el-col
        ><el-col :span="6"
          ><el-form-item label="来源类型"
            ><el-select v-model="form.type"
              ><el-option label="DB" value="DB" /><el-option label="LDAP" value="LDAP" /></el-select></el-form-item></el-col
        ><el-col :span="12"
          ><el-form-item label="来源地址"><el-input v-model="form.url" placeholder="不得包含账号口令" /></el-form-item></el-col
      ></el-row>
      <el-row :gutter="12"
        ><el-col :span="6"
          ><el-form-item label="范围"
            ><el-select v-model="scope.type"
              ><el-option label="百分比" value="PERCENT" /><el-option label="客户端 IP" value="CLIENT_IP" /><el-option
                label="序列号前缀"
                value="SERIAL_PREFIX" /></el-select></el-form-item></el-col
        ><el-col :span="6"
          ><el-form-item v-if="scope.type === 'PERCENT'" label="百分比"><el-input-number v-model="scope.percent" :min="1" :max="99" /></el-form-item
          ><el-form-item v-else label="范围值"><el-input v-model="scope.value" /></el-form-item></el-col
        ><el-col :span="12"
          ><el-form-item label="变更原因"><el-input v-model="reason" maxlength="255" /></el-form-item></el-col
      ></el-row>
      <el-button v-hasPermi="['ocsp:source:save']" type="primary" :loading="busy" @click="stage">暂存并健康检查</el-button>
    </el-form>
    <el-descriptions v-if="candidate" class="candidate" :column="4" border>
      <el-descriptions-item label="候选 ID">{{ candidate.id }}</el-descriptions-item
      ><el-descriptions-item label="版本">{{ candidate.version }}</el-descriptions-item
      ><el-descriptions-item label="健康"
        ><el-tag :type="candidate.healthStatus === 'HEALTHY' ? 'success' : 'danger'">{{ candidate.healthStatus }}</el-tag></el-descriptions-item
      ><el-descriptions-item label="状态">{{ candidate.canaryEnabled ? '已启用' : '未启用' }}</el-descriptions-item>
      <el-descriptions-item label="安全证据" :span="4">{{ candidate.validationEvidence || '-' }}</el-descriptions-item>
    </el-descriptions>
    <div v-if="candidate" class="actions">
      <el-button v-hasPermi="['ocsp:source:publish']" :disabled="candidate.canaryEnabled" :loading="busy" @click="enable">启用</el-button>
      <el-button v-hasPermi="['ocsp:source:publish']" :disabled="!candidate.canaryEnabled" :loading="busy" @click="disable">停用</el-button>
      <el-button v-hasPermi="['ocsp:source:publish']" type="success" :disabled="candidate.healthStatus !== 'HEALTHY'" :loading="busy" @click="promote"
        >原子提升</el-button
      >
      <el-button v-hasPermi="['ocsp:source:publish']" type="danger" :loading="busy" @click="abort">废弃</el-button>
    </div>
    <el-alert
      title="候选状态当前由本次暂存响应维护；刷新后可从配置历史查看证据，后端尚未提供候选查询接口。"
      type="info"
      :closable="false"
      class="note"
    />
  </el-card>
</template>
<script setup lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { abortOcspCanary, disableOcspCanary, enableOcspCanary, promoteOcspCanary, stageOcspCanary } from '@/api/ocsp/operations';
import type { OcspCanaryCandidate, OcspCanaryScope, OcspStatusSource } from '@/api/ocsp/types';
const busy = ref(false);
const candidate = ref<OcspCanaryCandidate>();
const reason = ref('');
const form = reactive({ caId: undefined as number | undefined, type: 'DB', url: '' });
const scope = reactive<OcspCanaryScope>({ type: 'PERCENT', percent: 5, value: '' });
const source = (): OcspStatusSource =>
  form.type === 'DB'
    ? { caId: form.caId, type: 'DB', enabled: true, db: { url: form.url } }
    : { caId: form.caId, type: 'LDAP', enabled: true, ldap: { url: form.url } };
const guard = () => {
  if (!form.caId || !form.url) return (ElMessage.warning('请填写 CA ID 和来源地址'), false);
  if (/@|password=|token=|secret=/i.test(form.url)) return (ElMessage.error('来源地址不得包含凭据'), false);
  return true;
};
const run = async (fn: () => Promise<any>) => {
  busy.value = true;
  try {
    return await fn();
  } finally {
    busy.value = false;
  }
};
const stage = async () => {
  if (!guard()) return;
  candidate.value = await run(() => stageOcspCanary(source(), scope));
  ElMessage.success('候选已暂存');
};
const enable = async () => {
  if (candidate.value) candidate.value = await run(() => enableOcspCanary(candidate.value!, reason.value, scope));
};
const disable = async () => {
  if (candidate.value) candidate.value = await run(() => disableOcspCanary(candidate.value!, reason.value));
};
const promote = async () => {
  if (!candidate.value) return;
  await ElMessageBox.confirm(`将候选 ${candidate.value.id} 原子提升为 CA ${candidate.value.caId} 权威？`, '确认提升', { type: 'warning' });
  await run(() => promoteOcspCanary(candidate.value!, candidate.value!.candidateVersion || 0, reason.value));
  candidate.value = undefined;
  ElMessage.success('提升完成，请刷新数据源');
};
const abort = async () => {
  if (!candidate.value) return;
  await ElMessageBox.confirm(`废弃候选 ${candidate.value.id}？当前已发布权威不受影响。`, '确认废弃', { type: 'warning' });
  await run(() => abortOcspCanary(candidate.value!, reason.value));
  candidate.value = undefined;
};
</script>
<style scoped>
.panel {
  margin: 16px 0;
}
.header {
  display: flex;
  justify-content: space-between;
}
.candidate,
.actions,
.note {
  margin-top: 16px;
}
.actions {
  display: flex;
  gap: 8px;
}
</style>
