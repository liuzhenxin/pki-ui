<template>
  <el-card class="installation" v-loading="loading">
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template v-if="state">
      <el-result
        v-if="state.state === 'COMPLETED'"
        icon="success"
        title="安装已完成"
        :sub-title="state.projectionPending ? '平台状态正在同步，请稍后刷新。' : '安装能力已关闭，请使用日常业务账号重新登录。'"
      />
      <template v-else>
        <h2>受控安装</h2>
        <el-alert title="仅允许已登记的安装对象。请先确认日常业务账号可用，再完成安装。" type="info" :closable="false" />
        <el-descriptions :column="1" border class="objects">
          <el-descriptions-item label="根 CA">{{ state.rootId }}</el-descriptions-item>
          <el-descriptions-item label="证书模板">{{ state.profileId }}</el-descriptions-item>
          <el-descriptions-item label="服务请求者">{{ state.requestorId }}</el-descriptions-item>
        </el-descriptions>
        <el-form label-position="top" @submit.prevent>
          <el-form-item label="安装授权令牌"><el-input v-model="grant" type="password" show-password autocomplete="off" /></el-form-item>
          <el-form-item label="已登记服务身份的 CSR（Base64 DER）"
            ><el-input v-model="csr" type="textarea" :rows="5" maxlength="65536"
          /></el-form-item>
          <el-form-item
            ><el-button type="primary" :disabled="!state.certificateAvailable || !grant || !csr" :loading="saving" @click="run('certificate')"
              >取得安装证书</el-button
            ><el-button :disabled="!state.crlAvailable || !grant" :loading="saving" @click="run('crl')">取得初始 CRL</el-button></el-form-item
          >
          <el-form-item
            ><el-button type="success" :disabled="!state.completionAvailable" :loading="saving" @click="run('complete')"
              >完成安装并关闭安装能力</el-button
            ></el-form-item
          >
        </el-form>
        <el-alert
          v-if="!state.certificateAvailable || !state.crlAvailable"
          title="部分安装动作当前不可用。若先前操作结果不确定，请联系安装负责人核对，勿重新开放会话。"
          type="warning"
          :closable="false"
        />
        <el-divider content-position="left">日常业务账号</el-divider>
        <p>请在完成安装前准备可用的日常业务账号。可执行的管理动作以当前权限为准。</p>
        <ApplicationUserManagement />
      </template>
    </template>
    <el-button :disabled="saving" @click="load">刷新安装状态</el-button>
  </el-card>
</template>
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import ApplicationUserManagement from '@/components/ApplicationUserManagement/index.vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { installationStatus, installationCertificate, installationCrl, completeInstallation, type InstallationStatus } from '@/api/ca/installation';
const state = ref<InstallationStatus>(),
  error = ref(''),
  grant = ref(''),
  csr = ref('');
const loading = ref(false),
  saving = ref(false);
async function load() {
  state.value = undefined;
  loading.value = true;
  error.value = '';
  try {
    state.value = await installationStatus();
  } catch {
    error.value = '无法确认安装状态，操作已关闭。请刷新或联系安装负责人。';
  } finally {
    loading.value = false;
  }
}
async function run(action: 'certificate' | 'crl' | 'complete') {
  if (saving.value || !state.value || state.value.state !== 'INSTALLING') return;
  if (action === 'complete') {
    try {
      await ElMessageBox.confirm('完成后不能重新开放安装能力。确认日常业务账号已就绪？', '完成安装', { type: 'warning' });
    } catch {
      return;
    }
  }
  saving.value = true;
  try {
    // 按当前状态独立提交一个动作；不补发其他写请求。
    if (action === 'certificate' && state.value.certificateAvailable) {
      const result = await installationCertificate(grant.value, csr.value);
      download(result.data, 'installation-certificate.pem');
    } else if (action === 'crl' && state.value.crlAvailable) {
      const result = await installationCrl(grant.value);
      download(result.data, 'initial-crl.pem');
    } else if (action === 'complete' && state.value.completionAvailable) await completeInstallation();
    else throw new Error('unavailable');
    ElMessage.success('操作完成');
  } catch {
    ElMessage.error('操作未完成。请刷新状态并核对先前结果。');
  } finally {
    grant.value = '';
    await load();
    saving.value = false;
  }
}
function download(value: unknown, name: string) {
  if (typeof value !== 'string' || !value.includes('-----BEGIN ')) throw new Error('无有效公开结果');
  const url = URL.createObjectURL(new Blob([value], { type: 'application/x-pem-file' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
onMounted(load);
onUnmounted(() => {
  grant.value = '';
  csr.value = '';
});
</script>
<style scoped>
.installation {
  margin: 16px;
  max-width: 880px;
}
.objects {
  margin: 20px 0;
}
@media (max-width: 640px) {
  .installation {
    margin: 8px;
  }
}
</style>
