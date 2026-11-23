<template>
  <div class="p-2">
    <el-card shadow="hover" class="ra-config-page">
      <template #header>
        <div class="card-header">
          <span>系统配置</span>
          <el-button v-hasPermi="['ra:config:get']" icon="Refresh" @click="loadActiveConfig">刷新</el-button>
        </div>
      </template>

      <el-tabs v-model="activeGroup" @tab-change="handleTabChange">
        <el-tab-pane label="基础配置" name="BASIC">
          <el-form :model="basicForm" label-width="140px" class="config-form">
            <el-form-item label="系统名称">
              <el-input v-model="basicForm.systemName" maxlength="80" placeholder="LiuZX RA" />
            </el-form-item>
            <el-form-item label="默认证书有效期">
              <el-input-number v-model="basicForm.defaultValidityDays" :min="1" :max="36500" controls-position="right" />
              <span class="unit-text">天</span>
            </el-form-item>
            <el-form-item label="续期提前天数">
              <el-input-number v-model="basicForm.renewalBeforeDays" :min="1" :max="3650" controls-position="right" />
              <span class="unit-text">天</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="RA身份" name="RA_IDENTITY">
          <el-alert
            class="identity-alert"
            type="info"
            :closable="false"
            show-icon
            title="RA身份私钥只允许写入，不会从接口回显。留空保存时不会覆盖现有私钥。"
          />
          <el-form :model="identityForm" label-width="140px" class="config-form">
            <el-form-item label="身份证书">
              <el-input v-model="identityForm.certPem" type="textarea" :rows="8" placeholder="-----BEGIN CERTIFICATE-----" />
            </el-form-item>
            <el-form-item label="证书主题 DN">
              <el-input v-model="identityForm.subject" placeholder="C=CN,O=LiuZX PKI,CN=RA Identity" />
            </el-form-item>
            <el-form-item label="密钥算法">
              <el-select v-model="identityForm.algorithm" style="width: 220px">
                <el-option label="SM2" value="SM2" />
                <el-option label="RSA" value="RSA" />
                <el-option label="ECC" value="ECC" />
              </el-select>
            </el-form-item>
            <el-form-item label="私钥状态">
              <el-tag :type="identityForm.privateKeyConfigured ? 'success' : 'warning'" effect="light">
                {{ identityForm.privateKeyConfigured ? '已配置' : '未配置' }}
              </el-tag>
            </el-form-item>
            <el-form-item label="更新私钥">
              <el-input v-model="identityForm.privateKey" type="textarea" :rows="5" placeholder="留空则不修改现有私钥" />
            </el-form-item>
            <el-form-item>
              <el-button v-hasPermi="['ra:config:get']" icon="CircleCheck" :loading="testing" @click="testActiveConfig">校验证书</el-button>
              <el-button v-hasPermi="['ra:config:save']" type="primary" :loading="rotationBusy" @click="openIdentityRotation">更新身份证书</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="通知审计" name="NOTICE_AUDIT">
          <el-form :model="noticeAuditForm" label-width="140px" class="config-form">
            <el-form-item label="启用通知">
              <el-switch v-model="noticeAuditForm.noticeEnabled" />
            </el-form-item>
            <el-form-item label="过期预警天数">
              <el-input-number v-model="noticeAuditForm.certExpireWarnDays" :min="1" :max="3650" controls-position="right" />
              <span class="unit-text">天</span>
            </el-form-item>
            <el-form-item label="启用审计">
              <el-switch v-model="noticeAuditForm.auditEnabled" />
            </el-form-item>
            <el-form-item label="审计保留天数">
              <el-input-number v-model="noticeAuditForm.auditRetentionDays" :min="1" :max="36500" controls-position="right" />
              <span class="unit-text">天</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <el-alert
        v-if="testResult"
        class="test-result"
        :title="testResult.passed ? '测试通过' : '测试未通过'"
        :type="testResult.passed ? 'success' : 'error'"
        :closable="false"
        show-icon
      >
        <ul class="test-checks">
          <li v-for="item in testResult.checks" :key="item.name" :class="{ passed: item.passed, failed: !item.passed }">
            <span class="check-name">{{ item.name }}</span>
            <span>{{ item.message || '-' }}</span>
          </li>
        </ul>
      </el-alert>

      <div class="action-bar">
        <el-button v-hasPermi="['ra:config:get']" icon="CircleCheck" :loading="testing" @click="testActiveConfig">测试配置</el-button>
        <el-button v-hasPermi="['ra:config:save']" type="primary" icon="Check" :loading="saving" @click="saveActiveConfig">保存配置</el-button>
      </div>
    </el-card>

    <el-dialog
      v-model="rotationOpen"
      title="更新 RA 身份证书"
      width="min(680px, 94vw)"
      :close-on-click-modal="!rotationBusy"
      :close-on-press-escape="!rotationBusy"
      :show-close="!rotationBusy"
    >
      <el-form label-position="top">
        <el-form-item label="请求主题 DN">
          <el-input v-model="rotationSubject" maxlength="2048" :disabled="rotationBusy" />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :loading="rotationBusy"
            :disabled="!rotationSubject.trim() || !!currentRotation"
            @click="generateIdentityRotation"
          >
            {{ rotation ? '重新生成 CSR' : '生成 CSR' }}
          </el-button>
        </el-form-item>
        <el-form-item v-if="rotation" label="待签发主题 DN">
          <span class="break-all">{{ rotation.subject }}</span>
        </el-form-item>
        <el-alert v-if="rotation && !currentRotation" title="请按修改后的主题重新生成 CSR。" type="warning" :closable="false" show-icon />
        <template v-if="currentRotation">
          <el-form-item :label="`待签发 CSR · ${currentRotation.algorithm}`">
            <el-input :model-value="currentRotation.csrPem" type="textarea" :rows="7" readonly />
            <el-button link type="primary" :disabled="rotationBusy" @click="downloadIdentityCsr">下载 CSR</el-button>
          </el-form-item>
          <el-form-item label="CA 签发的身份证书 PEM">
            <el-input
              v-model="rotationCertificate"
              type="textarea"
              :rows="7"
              maxlength="32768"
              :disabled="rotationBusy"
              placeholder="-----BEGIN CERTIFICATE-----"
            />
          </el-form-item>
          <el-alert title="请先在各 CA 的 RA 请求者配置中登记新证书，再回到这里导入。" type="info" :closable="false" show-icon />
        </template>
      </el-form>
      <template #footer>
        <el-button :disabled="rotationBusy" @click="rotationOpen = false">关闭</el-button>
        <el-button
          v-if="currentRotation"
          type="primary"
          :loading="rotationBusy"
          :disabled="!rotationCertificate.trim()"
          @click="activateIdentityRotation"
        >
          校验并启用
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="RaConfig" lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  activateRaIdentityRotation,
  generateRaIdentityRotation,
  getRaConfig,
  getRaIdentityRotation,
  saveRaConfig,
  testRaConfig
} from '@/api/ra/config';
import type { RaConfigGroup, RaConfigTestCO, RaIdentityRotation } from '@/api/ra/config';

const activeGroup = ref<RaConfigGroup>('BASIC');
const saving = ref(false);
const testing = ref(false);
const testResult = ref<RaConfigTestCO>();
const rotationOpen = ref(false);
const rotationBusy = ref(false);
const rotation = ref<RaIdentityRotation | null>(null);
const rotationSubject = ref('');
const rotationCertificate = ref('');
const currentRotation = computed(() => (rotation.value?.subject === rotationSubject.value ? rotation.value : null));

const openIdentityRotation = async () => {
  if (rotationBusy.value) return;
  const subject = identityForm.subject;
  const edited = subject !== loadedIdentitySubject;
  rotationBusy.value = true;
  try {
    rotation.value = (await getRaIdentityRotation()).data ?? null;
    rotationSubject.value = edited ? subject : (rotation.value?.subject ?? subject);
    rotationCertificate.value = '';
    rotationOpen.value = true;
  } finally {
    rotationBusy.value = false;
  }
};

const generateIdentityRotation = async () => {
  const subject = rotationSubject.value;
  const pending = rotation.value;
  if (rotationBusy.value || !subject.trim() || currentRotation.value) return;
  rotationBusy.value = true;
  try {
    if (pending) {
      try {
        await ElMessageBox.confirm('重新生成后，原 CSR 签发的证书将无法导入。请将新 CSR 提交给 CA。', '确认重新生成 CSR', { type: 'warning' });
      } catch {
        return;
      }
    }
    const { data } = await generateRaIdentityRotation({ subject, ...(pending ? { replaceCsrPem: pending.csrPem } : {}) });
    rotation.value = data;
    rotationSubject.value = data.subject;
    if (data.csrPem !== pending?.csrPem) rotationCertificate.value = '';
  } finally {
    rotationBusy.value = false;
  }
};

const downloadIdentityCsr = () => {
  if (rotationBusy.value || !currentRotation.value) return;
  const url = URL.createObjectURL(new Blob([currentRotation.value.csrPem], { type: 'application/pkcs10' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ra-identity.csr.pem';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const activateIdentityRotation = async () => {
  const certificate = rotationCertificate.value.trim();
  if (rotationBusy.value || !currentRotation.value || !certificate) return;
  rotationBusy.value = true;
  try {
    try {
      await ElMessageBox.confirm('启用后，RA 对各 CA 的新请求将使用这张身份证书。', '确认更新 RA 身份证书', { type: 'warning' });
    } catch {
      return;
    }
    await activateRaIdentityRotation(certificate);
    rotationOpen.value = false;
    ElMessage.success('RA 身份证书已更新');
    await loadActiveConfig();
  } finally {
    rotationBusy.value = false;
  }
};

const basicForm = reactive({
  systemName: 'LiuZX RA',
  defaultValidityDays: 365,
  renewalBeforeDays: 30
});

const identityForm = reactive({
  certPem: '',
  subject: 'C=CN,O=LiuZX PKI,CN=RA Identity',
  algorithm: 'SM2',
  privateKey: '',
  privateKeyConfigured: false
});
let loadedIdentitySubject = identityForm.subject;

const noticeAuditForm = reactive({
  noticeEnabled: true,
  certExpireWarnDays: 30,
  auditEnabled: true,
  auditRetentionDays: 3650
});

const parseConfig = (config?: string) => {
  if (!config) {
    return {};
  }
  try {
    return JSON.parse(config);
  } catch (_error) {
    return {};
  }
};

const assignKnown = (target: Record<string, any>, source: Record<string, any>) => {
  Object.keys(target).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      target[key] = source[key];
    }
  });
};

const currentPayload = () => {
  if (activeGroup.value === 'BASIC') {
    return { ...basicForm };
  }
  if (activeGroup.value === 'RA_IDENTITY') {
    const payload: Record<string, any> = {
      certPem: identityForm.certPem,
      subject: identityForm.subject,
      algorithm: identityForm.algorithm
    };
    if (identityForm.privateKey) {
      payload.privateKey = identityForm.privateKey;
    }
    return payload;
  }
  return { ...noticeAuditForm };
};

const applyConfig = (group: RaConfigGroup, config: Record<string, any>) => {
  if (group === 'BASIC') {
    assignKnown(basicForm, config);
  } else if (group === 'RA_IDENTITY') {
    assignKnown(identityForm, { ...config, privateKey: '' });
    loadedIdentitySubject = identityForm.subject;
  } else if (group === 'NOTICE_AUDIT') {
    assignKnown(noticeAuditForm, config);
  }
};

const loadActiveConfig = () => {
  testResult.value = undefined;
  return getRaConfig(activeGroup.value).then((response) => {
    const body = (response as any)?.data ?? response;
    const data = body?.data ?? body;
    applyConfig(activeGroup.value, parseConfig(data?.config));
  });
};

const handleTabChange = () => {
  loadActiveConfig();
};

const saveActiveConfig = () => {
  saving.value = true;
  saveRaConfig({
    group: activeGroup.value,
    config: JSON.stringify(currentPayload())
  })
    .then(() => {
      ElMessage.success('保存成功');
      return loadActiveConfig();
    })
    .finally(() => {
      saving.value = false;
    });
};

const testActiveConfig = () => {
  testing.value = true;
  testRaConfig({
    group: activeGroup.value,
    config: JSON.stringify(currentPayload())
  })
    .then((response) => {
      const body = (response as any)?.data ?? response;
      testResult.value = body?.data ?? body;
      if (testResult.value?.passed) {
        ElMessage.success('测试通过');
      } else {
        ElMessage.warning('测试未通过');
      }
    })
    .finally(() => {
      testing.value = false;
    });
};

loadActiveConfig();
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.config-form {
  max-width: 880px;
  padding-top: 8px;
}

.unit-text {
  margin-left: 10px;
  color: var(--el-text-color-secondary);
}

.identity-alert {
  margin: 8px 0 16px;
}

.test-result {
  margin-top: 16px;
}

.test-checks {
  padding-left: 0;
  margin: 8px 0 0;
  list-style: none;
}

.test-checks li {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  gap: 12px;
  line-height: 24px;
}

.check-name {
  font-weight: 600;
}

.passed .check-name {
  color: var(--el-color-success);
}

.failed .check-name {
  color: var(--el-color-danger);
}

.action-bar {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
</style>
