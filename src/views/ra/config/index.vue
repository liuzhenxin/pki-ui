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

        <el-tab-pane label="CA接入" name="CA_ACCESS">
          <el-form :model="caAccessForm" label-width="140px" class="config-form">
            <el-form-item label="CA服务地址">
              <el-input v-model="caAccessForm.caAddress" placeholder="http://pki-gateway:5555/api-gateway/ca">
                <template #append>
                  <el-button v-hasPermi="['ra:config:get']" icon="Connection" :loading="testing" @click="testActiveConfig">连通性测试</el-button>
                </template>
              </el-input>
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
            <el-form-item label="证书主题">
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
  </div>
</template>

<script setup name="RaConfig" lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getRaConfig, saveRaConfig, testRaConfig } from '@/api/ra/config';
import type { RaConfigGroup, RaConfigTestCO } from '@/api/ra/config';

const activeGroup = ref<RaConfigGroup>('BASIC');
const saving = ref(false);
const testing = ref(false);
const testResult = ref<RaConfigTestCO>();

const basicForm = reactive({
  systemName: 'LiuZX RA',
  defaultValidityDays: 365,
  renewalBeforeDays: 30
});

const caAccessForm = reactive({
  caAddress: 'http://pki-gateway:5555/api-gateway/ca'
});

const identityForm = reactive({
  certPem: '',
  subject: 'C=CN,O=LiuZX PKI,CN=RA Identity',
  algorithm: 'SM2',
  privateKey: '',
  privateKeyConfigured: false
});

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
  if (activeGroup.value === 'CA_ACCESS') {
    return { ...caAccessForm };
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
  } else if (group === 'CA_ACCESS') {
    assignKnown(caAccessForm, config);
  } else if (group === 'RA_IDENTITY') {
    assignKnown(identityForm, { ...config, privateKey: '' });
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
