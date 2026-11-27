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
    @closed="clearSecrets"
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
      <template v-if="adUploadDraft && adConfig">
        <el-form-item label="协议">
          <el-radio-group v-model="adConfig.protocol" @change="changeAdProtocol">
            <el-radio-button value="ldaps">LDAPS（推荐）</el-radio-button>
            <el-radio-button value="ldap">LDAP</el-radio-button>
          </el-radio-group>
          <el-alert v-if="adConfig.protocol === 'ldap'" class="mt8" type="warning" :closable="false"
            title="LDAP 会以明文发送绑定密码。" />
        </el-form-item>
        <el-form-item label="服务器及端口">
          <div class="distribution-test-row">
            <el-input v-model="adConfig.host" placeholder="AD 服务器主机名" />
            <el-input-number v-model="adConfig.port" :min="1" :max="65535" aria-label="AD 端口" />
          </div>
        </el-form-item>
        <el-form-item label="基础 DN"><el-input v-model="adConfig.baseDn" placeholder="例如 DC=example,DC=com" /></el-form-item>
        <el-form-item label="绑定账号"><el-input v-model="adConfig.account" autocomplete="off" /></el-form-item>
        <el-form-item label="绑定密码">
          <el-input v-model="adConfig.password" type="password" show-password autocomplete="new-password"
            :placeholder="adConfig.passwordConfigured ? '已配置，留空保留' : '请输入绑定密码'" />
        </el-form-item>
        <el-form-item label="写入字段">
          <el-checkbox-group v-model="adConfig.fields">
            <el-checkbox value="userCertificate">已发布证书</el-checkbox>
            <el-checkbox value="userSMIMECertificate">S/MIME 证书</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="写入方式">
          <el-radio-group v-model="adConfig.mode">
            <el-radio value="REPLACE">覆盖写入</el-radio>
            <el-radio value="APPEND">追加写入</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="AD 写入测试">
          <el-input v-model="adTestEmail" placeholder="测试用户邮箱" class="mb8" />
          <input ref="adFilePicker" type="file" hidden accept=".cer" @change="chooseAdFile" />
          <el-button @click="adFilePicker?.click()">选择 CER</el-button>
          <span v-if="adTestFile" class="ml8">{{ adTestFile.name }}</span>
          <el-button class="ml8" :loading="adTesting" :disabled="!adTestEmail.trim() || !adTestFile || !adConfig.host"
            @click="runAdTest">写入并回读</el-button>
        </el-form-item>
      </template>
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
  getEmployeeAdConfig,
  saveEmployeeAdConfig,
  testEmployeeAdConfig,
  type EmployeeAdConfig,
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
const adConfig = ref<EmployeeAdConfig>();
const adConfigSnapshot = ref('');
const adTestEmail = ref('');
const adFilePicker = ref<HTMLInputElement>();
const adTestFile = ref<File>();
const adTesting = ref(false);

function clearSecrets() {
  distributionConfig.value.secretKey = '';
  if (adConfig.value) adConfig.value.password = '';
  adTestFile.value = undefined;
  adTestEmail.value = '';
}

function changeAdProtocol(protocol: string | number | boolean) {
  if (adConfig.value) adConfig.value.port = protocol === 'ldap' ? 389 : 636;
}

function chooseAdFile(event: Event) {
  const input = event.target as HTMLInputElement;
  adTestFile.value = input.files?.[0];
  input.value = '';
}

async function runAdTest() {
  const config = adConfig.value;
  const file = adTestFile.value;
  const email = adTestEmail.value.trim();
  if (!config || !file || !email || adTesting.value) return;
  adTesting.value = true;
  try {
    await ElMessageBox.confirm(
      `向 ${email} 执行${config.mode === 'REPLACE' ? '覆盖' : '追加'}写入并核对 AD 回读结果？`,
      '确认 AD 写入测试', { type: 'warning', confirmButtonText: '确认写入' }
    );
    unwrapData(await testEmployeeAdConfig(config, email, file));
    ElMessage.success('AD 写入和回读校验成功');
  } catch {
    // Request errors are shown by the API client.
  } finally {
    adTesting.value = false;
  }
}
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
const distributionConfigBusy = computed(() => distributionConfigSaving.value || distributionTesting.value || opsFieldsLoading.value || adTesting.value);
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
    adConfig.value = undefined;
    void getEmployeeAdConfig().then(response => {
      adConfig.value = unwrapData(response);
      adConfigSnapshot.value = JSON.stringify(adConfig.value);
    }).catch(() => undefined);
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
    if (adConfig.value && JSON.stringify(adConfig.value) !== adConfigSnapshot.value) {
      adConfig.value = unwrapData(await saveEmployeeAdConfig(adConfig.value));
      adConfigSnapshot.value = JSON.stringify(adConfig.value);
    }
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
  margin: 4px 0 0 auto;
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
