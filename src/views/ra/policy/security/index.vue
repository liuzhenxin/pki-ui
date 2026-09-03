<template>
  <div class="security-policy-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2>登录与会话</h2>
        <p>由运维平台统一配置，CA、KMC、RA、OCSP 与运维中心共用。证书审批以模板为准；管理面 IP 白名单在「安全配置」。</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" :loading="submitting" v-hasPermi="['platform:security:policy:modify']" @click="submitForm">保存</el-button>
        <el-button v-hasPermi="['ra:policy:security', 'platform:security:policy:get']" icon="Refresh" @click="loadCurrent">刷新</el-button>
      </div>
    </div>

    <div class="detail-panel edit-panel">
      <div class="panel-header">
        <span>登录与会话配置</span>
        <div class="panel-tools">
          <el-tag effect="plain">{{ form.policyName || '登录与会话' }}</el-tag>
          <el-button circle text type="primary" aria-label="帮助说明" @click="helpDrawerVisible = true">
            <el-icon><QuestionFilled /></el-icon>
          </el-button>
        </div>
      </div>
      <el-form ref="policyFormRef" :model="form" :rules="rules" label-width="160px">
        <el-form-item label="策略名称" prop="policyName">
          <el-input v-model="form.policyName" maxlength="100" placeholder="登录与会话" />
        </el-form-item>
        <div class="section-grid">
          <div v-for="section in policySections" :key="section.key" class="policy-section">
            <div class="section-title">{{ section.title }}</div>
            <div class="rule-list">
              <div v-for="item in section.items" :key="item.key" class="rule-row">
                <span class="rule-label">{{ item.label }}</span>
                <span class="rule-control">
                  <el-switch
                    v-if="item.type === 'boolean'"
                    v-model="policyContentModel[section.key][item.key]"
                    inline-prompt
                    active-text="是"
                    inactive-text="否"
                  />
                  <el-input-number
                    v-else
                    v-model="policyContentModel[section.key][item.key]"
                    :min="item.min ?? 0"
                    :max="item.max ?? 999999"
                    controls-position="right"
                    style="width: 180px"
                  />
                </span>
              </div>
            </div>
          </div>
        </div>
        <el-form-item label="策略描述">
          <el-input v-model="form.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
        <div class="form-actions">
          <el-button type="primary" :loading="submitting" v-hasPermi="['platform:security:policy:modify']" @click="submitForm">保存</el-button>
        </div>
      </el-form>
    </div>

    <el-drawer v-model="helpDrawerVisible" title="帮助说明" direction="rtl" size="420px" append-to-body>
      <div class="help-content">
        <div class="help-item">本页由运维平台统一配置，所有系统控制台登录共用。保存后下一次密码登录按新值执行。</div>
        <div class="help-item">锁定记在 Redis，到期自动解除；也可在用户管理「清除登录锁定」。不会把账号改成禁用。</div>
        <div class="help-item">关闭验证码后普通用户可不填；超级管理员仍会被要求补验证码（第一次失败后出现输入框）。</div>
        <div class="help-item">访问令牌时长在重新登录后生效。刷新令牌换发的新 access 仍按认证服务默认 4 小时。</div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup name="RaSecurityPolicy" lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { QuestionFilled } from '@element-plus/icons-vue';
import { getCurrentSecurityPolicy, modifySecurityPolicy } from '@/api/ra/securityPolicy';
import type { SecurityPolicy } from '@/api/ra/securityPolicy';
import { to } from 'await-to-js';

const loading = ref(false);
const submitting = ref(false);
const policyFormRef = ref<FormInstance>();
const helpDrawerVisible = ref(false);
const currentId = ref<number | string | undefined>();

const policyContentModel = reactive<Record<string, Record<string, any>>>({
  login: {},
  captcha: {},
  session: {}
});

const form = reactive<SecurityPolicy>({
  policyName: '登录与会话',
  policyType: 'iam',
  policyContent: '{}',
  priority: 0,
  policyStatus: 1,
  description: ''
});

const rules: FormRules = {
  policyName: [{ required: true, message: '策略名称不能为空', trigger: 'blur' }]
};

const policySections = [
  {
    key: 'login',
    title: '登录锁定',
    items: [
      { key: 'lockEnabled', label: '启用登录锁定', type: 'boolean', defaultValue: true },
      { key: 'maxFailures', label: '最大失败次数', type: 'number', min: 3, max: 20, defaultValue: 5 },
      { key: 'failureWindowMinutes', label: '失败统计窗口（分钟）', type: 'number', min: 1, max: 1440, defaultValue: 10 },
      { key: 'lockMinutes', label: '锁定时长（分钟）', type: 'number', min: 1, max: 1440, defaultValue: 30 }
    ]
  },
  {
    key: 'captcha',
    title: '验证码',
    items: [
      { key: 'loginCaptchaEnabled', label: '登录启用验证码', type: 'boolean', defaultValue: true },
      { key: 'captchaExpireSeconds', label: '验证码有效期（秒）', type: 'number', min: 30, max: 600, defaultValue: 120 },
      { key: 'forceAfterFailures', label: '失败后强制验证码次数', type: 'number', min: 0, max: 20, defaultValue: 2 },
      { key: 'adminRequired', label: '超级管理员即使关闭验证码也必须校验', type: 'boolean', defaultValue: true }
    ]
  },
  {
    key: 'session',
    title: '会话',
    items: [
      { key: 'accessTokenHours', label: '访问令牌有效期（小时）', type: 'number', min: 1, max: 24, defaultValue: 4 },
      { key: 'refreshTokenHours', label: '刷新令牌有效期（小时）', type: 'number', min: 1, max: 168, defaultValue: 4 },
      { key: 'idleTimeoutMinutes', label: '空闲超时（分钟）', type: 'number', min: 5, max: 1440, defaultValue: 240 }
    ]
  }
];

initDefaultPolicyContentModel();

function parsePolicyContent(value?: string) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch (_error) {
    return {};
  }
}

function initDefaultPolicyContentModel() {
  for (const section of policySections) {
    policyContentModel[section.key] = {};
    for (const item of section.items) {
      policyContentModel[section.key][item.key] = item.defaultValue;
    }
  }
}

function resetPolicyContentModel(value?: string) {
  const parsed = parsePolicyContent(value) as Record<string, Record<string, unknown>>;
  const loginSource = parsed.login || parsed.loginPolicy || {};
  const captchaSource = parsed.captcha || parsed.captchaPolicy || {};
  const sessionSource = parsed.session || parsed.sessionPolicy || {};
  const sources: Record<string, Record<string, unknown>> = {
    login: loginSource,
    captcha: captchaSource,
    session: sessionSource
  };
  for (const section of policySections) {
    policyContentModel[section.key] = {};
    for (const item of section.items) {
      const source = sources[section.key] || {};
      policyContentModel[section.key][item.key] = source[item.key] ?? item.defaultValue;
    }
  }
}

function buildPolicyContent() {
  const content: Record<string, Record<string, unknown>> = {};
  for (const section of policySections) {
    content[section.key] = {};
    for (const item of section.items) {
      content[section.key][item.key] = policyContentModel[section.key]?.[item.key];
    }
  }
  return JSON.stringify(content);
}

async function loadCurrent() {
  loading.value = true;
  const [err, res] = await to(getCurrentSecurityPolicy());
  loading.value = false;
  if (!err) {
    const data = res?.data;
    currentId.value = data?.id;
    Object.assign(form, {
      policyName: data?.policyName || '登录与会话',
      policyType: 'iam',
      policyContent: data?.policyContent || '{}',
      priority: 0,
      policyStatus: 1,
      description: data?.description || ''
    });
    resetPolicyContentModel(data?.policyContent);
    nextTick(() => policyFormRef.value?.clearValidate());
  }
}

async function submitForm() {
  const valid = await policyFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  const policyContent = buildPolicyContent();
  submitting.value = true;
  const [err] = await to(
    modifySecurityPolicy({
      ...form,
      id: currentId.value,
      policyType: 'iam',
      policyContent
    })
  );
  submitting.value = false;
  if (!err) {
    ElMessage.success('保存成功');
    await loadCurrent();
  }
}

onMounted(loadCurrent);
</script>

<style scoped>
.security-policy-page {
  padding: 12px;
}

.page-header {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  color: #303133;
}

.page-header p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #909399;
}

.header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-panel {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
  padding: 16px;
}

.edit-panel {
  max-width: 1120px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.panel-header {
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  font-weight: 600;
  color: #303133;
}

.panel-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.help-content {
  display: grid;
  gap: 6px;
}

.help-item {
  position: relative;
  padding-left: 12px;
  color: #606266;
  font-size: 13px;
  line-height: 20px;
}

.help-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #409eff;
}

.section-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.policy-section {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.section-title {
  display: flex;
  align-items: center;
  min-height: 42px;
  padding: 0 12px;
  background: #f5f7fa;
  font-weight: 600;
  color: #303133;
}

.rule-list {
  padding: 8px 12px;
}

.rule-row {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid #f0f2f5;
}

.rule-row:last-child {
  border-bottom: 0;
}

.rule-label {
  color: #606266;
  font-size: 13px;
  line-height: 18px;
}

.rule-control {
  display: flex;
  justify-content: flex-end;
  flex: 0 0 auto;
}

@media (max-width: 1200px) {
  .section-grid {
    grid-template-columns: 1fr;
  }
}
</style>
