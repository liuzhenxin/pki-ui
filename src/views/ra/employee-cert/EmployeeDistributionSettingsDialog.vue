<template>
  <el-dialog
    v-model="distributionConfigOpen"
    title="员工证书分发配置"
    width="720px"
    style="max-width: calc(100vw - 24px)"
    :close-on-click-modal="!distributionConfigSaving"
    :close-on-press-escape="!distributionConfigSaving"
    :show-close="!distributionConfigSaving"
    append-to-body
    @closed="distributionConfig.secretKey = ''"
  >
    <div class="distribution-settings-header">
      <el-tabs v-model="distributionConfigTab">
        <el-tab-pane label="证书分发" name="distribution" />
        <el-tab-pane label="证书上传" name="upload" />
        <el-tab-pane label="管理员通知" name="administrators" />
      </el-tabs>
      <el-switch
        v-model="useOpsDraft"
        active-text="使用OPS统一配置"
        aria-label="使用OPS统一配置"
        :disabled="distributionConfigBusy"
        @change="refreshOpsDistributionSettings"
      />
    </div>
    <el-alert v-if="useOpsDraft && opsSettingsFailed && distributionConfigTab !== 'upload'" class="mb12" type="error" :closable="false" show-icon>
      <template #title>无法读取 OPS 统一配置</template>
      <el-button link type="primary" @click="refreshOpsDistributionSettings">重新读取</el-button>
    </el-alert>
    <el-form v-if="distributionConfigTab === 'administrators'" v-loading="opsFieldsLoading" label-width="150px">
      <el-form-item label="管理员邮箱">
        <el-select
          v-model="visibleNoticeAdministrators.emails"
          multiple
          filterable
          allow-create
          default-first-option
          :disabled="useOpsDraft || distributionConfigSaving"
          style="width: 100%"
          placeholder="输入邮箱后按回车"
        />
      </el-form-item>
      <el-form-item label="管理员域账号">
        <el-select
          v-model="visibleNoticeAdministrators.domainAccounts"
          multiple
          filterable
          allow-create
          default-first-option
          :disabled="useOpsDraft || distributionConfigSaving"
          style="width: 100%"
          placeholder="输入域账号后按回车"
        />
      </el-form-item>
    </el-form>
    <el-form v-if="distributionConfigTab === 'upload'" label-width="150px" :disabled="distributionConfigSaving">
      <el-form-item label="AD上传功能"><el-switch v-model="adUploadDraft" aria-label="AD上传功能" /></el-form-item>
    </el-form>
    <template v-if="distributionConfigTab === 'distribution'">
      <el-form v-loading="opsFieldsLoading" :model="visibleDistributionConfig" label-width="150px" :disabled="distributionConfigSaving">
        <el-form-item label="邮件服务地址">
          <el-input v-model="visibleDistributionConfig.emailServerUrl" :readonly="useOpsDraft" />
        </el-form-item>
        <el-form-item label="钉钉服务地址">
          <el-input v-model="visibleDistributionConfig.dingtalkServerUrl" :readonly="useOpsDraft" />
        </el-form-item>
        <el-form-item label="App Key">
          <el-input v-model="visibleDistributionConfig.appKey" :readonly="useOpsDraft" autocomplete="off" />
        </el-form-item>
        <el-form-item label="Secret Key">
          <el-input v-if="useOpsDraft" type="password" readonly :placeholder="visibleDistributionConfig.secretKeyConfigured ? '已配置' : '未配置'" />
          <el-input
            v-else
            v-model="distributionConfig.secretKey"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="distributionConfig.secretKeyConfigured ? '已配置，留空保持不变' : '请输入 Secret Key'"
          />
        </el-form-item>
        <el-form-item label="发件邮箱">
          <el-input v-model="visibleDistributionConfig.emailAccount" :readonly="useOpsDraft" />
        </el-form-item>
        <el-form-item label="邮件服务器标识">
          <el-input v-model="visibleDistributionConfig.smtpServer" :readonly="useOpsDraft" />
        </el-form-item>
        <el-form-item label="钉钉应用标识">
          <el-input v-model="visibleDistributionConfig.dingtalkApp" :readonly="useOpsDraft" />
        </el-form-item>
        <el-form-item label="附件最大大小">
          <el-input-number v-model="distributionConfig.attachmentMaxSizeMb" :min="1" :max="100" />
          <span class="unit-label">MB</span>
        </el-form-item>
        <el-form-item label="邮件测试">
          <div class="distribution-test-row">
            <el-input v-model="distributionTestEmail" placeholder="测试收件邮箱" :disabled="distributionTesting" />
            <el-button :disabled="!distributionTestReady || !distributionTestEmail.trim()" @click="testDistributionConfig('EMAIL')">
              测试并发送
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="钉钉测试">
          <div class="distribution-test-row">
            <el-input v-model="distributionTestDing" placeholder="测试接收人的域账号" :disabled="distributionTesting" />
            <el-button :disabled="!distributionTestReady || !distributionTestDing.trim()" @click="testDistributionConfig('DINGTALK')">
              测试并发送
            </el-button>
          </div>
        </el-form-item>
        <el-form-item v-if="distributionTesting || distributionTestResult" label="测试结果">
          <span>{{ distributionTestResult }}</span>
        </el-form-item>
      </el-form>
    </template>
    <template #footer>
      <el-button :disabled="distributionConfigSaving" @click="distributionConfigOpen = false">取消</el-button>
      <el-button
        type="primary"
        :loading="distributionConfigSaving"
        :disabled="distributionConfigBusy || (useOpsDraft && !savedUseOps && !opsDistributionSettings)"
        @click="saveDistributionSettings"
        >保存配置</el-button
      >
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  getEmployeeCertDistributionSettings,
  getEmployeeCertOpsSettings,
  saveEmployeeCertDistributionSettings,
  testEmployeeCertDistributionConfig,
  type EmployeeCertDistributionConfig,
  type EmployeeCertOpsSettings,
  type EmployeeNoticeAdministrators
} from '@/api/ra/employeeCert';
import type { Result } from '@/api/types';

const emit = defineEmits<{ 'ad-upload-change': [enabled: boolean] }>();

const distributionConfigOpen = ref(false);
const distributionConfigSaving = ref(false);
const distributionTestEmail = ref('');
const distributionTestDing = ref('');
const distributionTesting = ref(false);
const distributionConfigTab = ref('distribution');
const adUploadDraft = ref(false);
const noticeAdministrators = ref<EmployeeNoticeAdministrators>({ emails: [], domainAccounts: [] });
const distributionTestResult = ref('');
const useOpsDraft = ref(false);
const savedUseOps = ref(false);
const opsSettingsLoading = ref(false);
const opsSettingsFailed = ref(false);
const opsDistributionSettings = ref<EmployeeCertOpsSettings>();
const emptyOpsDistribution: EmployeeCertDistributionConfig = {};
const emptyOpsAdministrators: EmployeeNoticeAdministrators = { emails: [], domainAccounts: [] };
const distributionConfigLoading = ref(false);
const opsFieldsLoading = computed(() => useOpsDraft.value && opsSettingsLoading.value);
const distributionConfigBusy = computed(() => distributionConfigSaving.value || distributionTesting.value || opsFieldsLoading.value);
const distributionTestReady = computed(() => !distributionConfigBusy.value && (!useOpsDraft.value || !!opsDistributionSettings.value));
const distributionConfig = ref<EmployeeCertDistributionConfig>({ attachmentMaxSizeMb: 10 });
const visibleDistributionConfig = computed(() =>
  useOpsDraft.value ? (opsDistributionSettings.value?.distribution ?? emptyOpsDistribution) : distributionConfig.value
);
const visibleNoticeAdministrators = computed(() =>
  useOpsDraft.value ? (opsDistributionSettings.value?.administrators ?? emptyOpsAdministrators) : noticeAdministrators.value
);

function unwrapData<T>(response: Result<T>): T {
  if (response.data == null) throw new Error('员工证书配置响应为空');
  return response.data;
}

async function open() {
  if (distributionConfigLoading.value || opsSettingsLoading.value || distributionTesting.value) return;
  distributionConfigLoading.value = true;
  try {
    const settings = unwrapData(await getEmployeeCertDistributionSettings());
    adUploadDraft.value = settings.adUploadEnabled;
    emit('ad-upload-change', settings.adUploadEnabled);
    savedUseOps.value = useOpsDraft.value = settings.useOps;
    noticeAdministrators.value = settings.administrators;
    distributionConfig.value = { ...settings.distribution, secretKey: '' };
    distributionConfigTab.value = 'distribution';
    opsDistributionSettings.value = undefined;
    opsSettingsFailed.value = false;
    distributionTestEmail.value = '';
    distributionTestDing.value = '';
    distributionTestResult.value = '';
    distributionConfigOpen.value = true;
    await refreshOpsDistributionSettings();
  } catch {
    // The API request reports load errors.
  } finally {
    distributionConfigLoading.value = false;
  }
}

async function refreshOpsDistributionSettings() {
  distributionTestResult.value = '';
  if (!useOpsDraft.value || opsSettingsLoading.value) return;
  opsSettingsLoading.value = true;
  opsSettingsFailed.value = false;
  opsDistributionSettings.value = undefined;
  try {
    opsDistributionSettings.value = unwrapData(await getEmployeeCertOpsSettings());
  } catch {
    opsSettingsFailed.value = true;
  } finally {
    opsSettingsLoading.value = false;
  }
}

async function testDistributionConfig(channel: 'EMAIL' | 'DINGTALK') {
  if (!distributionTestReady.value) return;
  const label = channel === 'EMAIL' ? '邮件' : '钉钉';
  const recipient = (channel === 'EMAIL' ? distributionTestEmail.value : distributionTestDing.value).trim();
  if (!recipient) return;
  const useOps = useOpsDraft.value;
  const config = useOps ? undefined : { ...distributionConfig.value };
  distributionTesting.value = true;
  distributionTestResult.value = `${label}：正在检测网关连通性…`;
  let networkReachable = false;
  try {
    const { emailServerUrl, dingtalkServerUrl } = config ?? {};
    const connectivity = unwrapData(
      await testEmployeeCertDistributionConfig({ channel, send: false, useOps, config: useOps ? undefined : { emailServerUrl, dingtalkServerUrl } })
    );
    networkReachable = true;
    distributionTestResult.value = `${label}：${connectivity}`;
    if (!distributionConfigOpen.value) return;
    const confirmed = await ElMessageBox.confirm(`网络已连通。${connectivity}。仅向 ${recipient} 发送一条${label}测试消息，确认发送？`, '试发确认', {
      type: 'warning',
      confirmButtonText: '确认发送',
      cancelButtonText: '取消',
      closeOnClickModal: false,
      autofocus: false
    })
      .then(() => true)
      .catch(() => false);
    if (!confirmed || !distributionConfigOpen.value) {
      distributionTestResult.value = `${label}：网络已连通，未发送测试消息`;
      return;
    }
    distributionTestResult.value = `${label}：正在发送测试消息…`;
    const result = unwrapData(await testEmployeeCertDistributionConfig({ channel, send: true, recipient, useOps, config }));
    distributionTestResult.value = `${label}：${result}`;
  } catch {
    distributionTestResult.value = networkReachable ? `${label}：网关可达，测试消息发送失败` : `${label}：网关连通性检测失败，未发送测试消息`;
  } finally {
    distributionTesting.value = false;
  }
}

async function saveDistributionSettings() {
  const useOps = useOpsDraft.value;
  if (distributionConfigBusy.value || (useOps && !savedUseOps.value && !opsDistributionSettings.value)) return;
  distributionConfigSaving.value = true;
  try {
    const { attachmentMaxSizeMb, emailServerUrl, dingtalkServerUrl, appKey, secretKey, emailAccount, smtpServer, dingtalkApp } =
      distributionConfig.value;
    await saveEmployeeCertDistributionSettings({
      useOps,
      adUploadEnabled: adUploadDraft.value,
      distribution: useOps
        ? { attachmentMaxSizeMb }
        : { attachmentMaxSizeMb, emailServerUrl, dingtalkServerUrl, appKey, secretKey, emailAccount, smtpServer, dingtalkApp },
      administrators: useOps ? undefined : noticeAdministrators.value
    });
    emit('ad-upload-change', adUploadDraft.value);
    ElMessage.success('分发设置已保存');
    distributionConfigOpen.value = false;
  } catch {
    // The API request reports save errors.
  } finally {
    distributionConfigSaving.value = false;
  }
}

defineExpose({ open });
</script>

<style scoped>
.distribution-settings-header {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0 20px;
}

.distribution-settings-header .el-switch {
  margin-top: 4px;
}

.distribution-test-row {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}
.mb12 {
  margin-bottom: 12px;
}

.unit-label {
  margin-left: 8px;
  color: var(--el-text-color-regular);
}
</style>
