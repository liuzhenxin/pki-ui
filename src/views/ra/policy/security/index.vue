<template>
  <div class="security-policy-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2>安全策略</h2>
        <p>{{ currentPolicy?.policyName || '当前安全策略' }}</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" :disabled="!currentPolicy" :loading="submitting" @click="submitForm">保存</el-button>
        <el-button v-hasPermi="['ra:policy:security']" icon="Refresh" @click="loadCurrent">刷新</el-button>
      </div>
    </div>

    <el-empty v-if="!currentPolicy && !loading" description="暂无当前安全策略" />

    <div v-else class="detail-panel edit-panel">
      <div class="panel-header">
        <span>安全策略配置</span>
        <div class="panel-tools">
          <el-tag effect="plain">{{ currentPolicy?.policyName || '-' }}</el-tag>
          <el-button circle text type="primary" aria-label="帮助说明" @click="helpDrawerVisible = true">
            <el-icon><QuestionFilled /></el-icon>
          </el-button>
        </div>
      </div>
      <el-form ref="policyFormRef" :model="form" :rules="rules" label-width="120px">
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-form-item label="策略名称" prop="policyName">
              <el-input v-model="form.policyName" maxlength="100" placeholder="请输入策略名称" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="策略类型" prop="policyType">
              <el-select v-model="form.policyType" style="width: 100%">
                <el-option v-for="item in policyTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :xs="24" :md="8">
            <el-form-item label="优先级" prop="priority">
              <el-input-number v-model="form.priority" :min="0" :max="10000" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="8">
            <el-form-item label="生效时间">
              <el-date-picker v-model="form.effectiveTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss[Z]" placeholder="立即生效" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="8">
            <el-form-item label="失效时间">
              <el-date-picker v-model="form.expireTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss[Z]" placeholder="长期有效" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="策略状态">
          <el-radio-group v-model="form.policyStatus">
            <el-radio-button :value="1">启用</el-radio-button>
            <el-radio-button :value="0">禁用</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="策略内容">
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
                      v-else-if="item.type === 'number'"
                      v-model="policyContentModel[section.key][item.key]"
                      :min="0"
                      :max="999999"
                      controls-position="right"
                      style="width: 180px"
                    />
                    <el-input v-else v-model="policyContentModel[section.key][item.key]" clearable style="width: 220px" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </el-form-item>
        <el-form-item v-if="extraPolicyContent" label="其他配置">
          <el-input v-model="extraPolicyContent" class="json-input" type="textarea" :rows="6" spellcheck="false" />
        </el-form-item>
        <el-form-item label="策略描述">
          <el-input v-model="form.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
        <div class="form-actions">
          <el-button type="primary" :loading="submitting" @click="submitForm">保存</el-button>
        </div>
      </el-form>
    </div>

    <el-drawer v-model="helpDrawerVisible" title="帮助说明" direction="rtl" size="420px" append-to-body>
      <div class="help-content">
        <div class="help-item">策略状态为启用且处于生效时间范围内时，系统按优先级应用当前配置；优先级数值越小，匹配顺序越靠前。</div>
        <div class="help-item">登录安全、验证码策略和会话安全用于控制登录失败锁定、验证码触发和令牌/空闲超时等访问行为。</div>
        <div class="help-item">敏感操作、审计策略和证书业务用于控制二次认证、双人复核、审计保留、证书申请和吊销审批。</div>
        <div class="help-item">修改规则后需要点击保存才会提交；刷新会重新读取服务端当前策略并覆盖页面未保存内容。</div>
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
const currentPolicy = ref<SecurityPolicy>();
const policyFormRef = ref<FormInstance>();
const policyContentModel = reactive<Record<string, Record<string, any>>>({});
const extraPolicyContent = ref('');
const helpDrawerVisible = ref(false);

const form = reactive<SecurityPolicy>({
  policyName: '',
  policyType: 'platform',
  policyContent: '{}',
  priority: 100,
  effectiveTime: '',
  expireTime: '',
  policyStatus: 1,
  description: ''
});

const rules: FormRules = {
  policyName: [{ required: true, message: '策略名称不能为空', trigger: 'blur' }],
  policyType: [{ required: true, message: '策略类型不能为空', trigger: 'change' }],
  priority: [{ required: true, message: '优先级不能为空', trigger: 'blur' }]
};

const policyTypeOptions = [
  { label: '平台安全', value: 'platform' },
  { label: 'RA业务安全', value: 'ra_business' },
  { label: '访问控制', value: 'access_control' }
];

const policySections = [
  {
    key: 'loginPolicy',
    title: '登录安全',
    items: [
      { key: 'lockEnabled', label: '启用登录锁定', type: 'boolean', defaultValue: false },
      { key: 'maxFailures', label: '最大失败次数', type: 'number' },
      { key: 'failureWindowMinutes', label: '失败统计窗口（分钟）', type: 'number' },
      { key: 'lockMinutes', label: '锁定时长（分钟）', type: 'number' },
      { key: 'recordLoginIp', label: '记录登录IP', type: 'boolean', defaultValue: false }
    ]
  },
  {
    key: 'captchaPolicy',
    title: '验证码策略',
    items: [
      { key: 'loginCaptchaEnabled', label: '登录启用验证码', type: 'boolean', defaultValue: false },
      { key: 'captchaExpireSeconds', label: '验证码有效期（秒）', type: 'number' },
      { key: 'forceAfterFailures', label: '失败后强制验证码次数', type: 'number' },
      { key: 'adminRequired', label: '管理员必须校验', type: 'boolean', defaultValue: false }
    ]
  },
  {
    key: 'sessionPolicy',
    title: '会话安全',
    items: [
      { key: 'accessTokenHours', label: '访问令牌有效期（小时）', type: 'number' },
      { key: 'refreshTokenHours', label: '刷新令牌有效期（小时）', type: 'number' },
      { key: 'idleTimeoutMinutes', label: '空闲超时（分钟）', type: 'number' },
      { key: 'forceReloginAfterPermissionChange', label: '权限变更后重新登录', type: 'boolean', defaultValue: false }
    ]
  },
  {
    key: 'operationPolicy',
    title: '敏感操作',
    items: [
      { key: 'sensitiveOperationReasonRequired', label: '敏感操作填写原因', type: 'boolean', defaultValue: false },
      { key: 'secondFactorRequired', label: '需要二次认证', type: 'boolean', defaultValue: false },
      { key: 'dualReviewEnabled', label: '启用双人复核', type: 'boolean', defaultValue: false }
    ]
  },
  {
    key: 'auditPolicy',
    title: '审计策略',
    items: [
      { key: 'auditEnabled', label: '启用审计', type: 'boolean', defaultValue: false },
      { key: 'retentionDays', label: '审计保留天数', type: 'number' },
      { key: 'maskSensitiveFields', label: '敏感字段脱敏', type: 'boolean', defaultValue: false }
    ]
  },
  {
    key: 'certificateBusinessPolicy',
    title: '证书业务',
    items: [
      { key: 'approvalRequired', label: '证书申请需审批', type: 'boolean', defaultValue: false },
      { key: 'maxActiveCertsPerSubject', label: '主体最大有效证书数', type: 'number' },
      { key: 'revocationApprovalRequired', label: '吊销需审批', type: 'boolean', defaultValue: false },
      { key: 'downloadLinkExpireMinutes', label: '下载链接有效期（分钟）', type: 'number' },
      { key: 'disabledCertPolicyRejectApply', label: '禁用证书策略拒绝申请', type: 'boolean', defaultValue: false }
    ]
  }
];

// 同步初始化默认值，避免模板在异步数据加载前访问 undefined 属性
initDefaultPolicyContentModel();

function formatJson(value?: string) {
  if (!value) return '{}';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch (_error) {
    return value;
  }
}

function parsePolicyContent(value?: string) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch (_error) {
    return {};
  }
}

function initDefaultPolicyContentModel() {
  Object.keys(policyContentModel).forEach((key) => delete policyContentModel[key]);
  for (const section of policySections) {
    policyContentModel[section.key] = {};
    for (const item of section.items) {
      const def = item.defaultValue ?? (item.type === 'number' ? null : false);
      policyContentModel[section.key][item.key] = def;
    }
  }
}

function resetPolicyContentModel(value?: string) {
  const parsed = parsePolicyContent(value) as Record<string, Record<string, unknown>>;
  Object.keys(policyContentModel).forEach((key) => delete policyContentModel[key]);

  for (const section of policySections) {
    const source = parsed[section.key] || {};
    policyContentModel[section.key] = {};
    for (const item of section.items) {
      const def = item.defaultValue ?? (item.type === 'number' ? null : false);
      policyContentModel[section.key][item.key] = source[item.key] ?? def;
    }
  }

  const knownKeys = new Set(policySections.map((section) => section.key));
  const extra = Object.fromEntries(Object.entries(parsed).filter(([key]) => !knownKeys.has(key)));
  extraPolicyContent.value = Object.keys(extra).length ? JSON.stringify(extra, null, 2) : '';
}

function buildPolicyContent() {
  const content: Record<string, Record<string, unknown>> = {};
  for (const section of policySections) {
    content[section.key] = {};
    for (const item of section.items) {
      const value = policyContentModel[section.key]?.[item.key];
      if (value !== undefined && value !== null && value !== '') {
        content[section.key][item.key] = value;
      }
    }
  }

  if (extraPolicyContent.value.trim()) {
    try {
      Object.assign(content, JSON.parse(extraPolicyContent.value));
    } catch (_error) {
      ElMessage.error('其他配置不是有效的 JSON');
      return '';
    }
  }

  return JSON.stringify(content, null, 2);
}

async function loadCurrent() {
  loading.value = true;
  const [err, res] = await to(getCurrentSecurityPolicy());
  loading.value = false;
  if (!err) {
    currentPolicy.value = res?.data;
    if (currentPolicy.value) {
      Object.assign(form, {
        ...currentPolicy.value,
        policyContent: formatJson(currentPolicy.value.policyContent)
      });
      resetPolicyContentModel(currentPolicy.value.policyContent);
      nextTick(() => policyFormRef.value?.clearValidate());
    }
  }
}

async function submitForm() {
  const valid = await policyFormRef.value?.validate().catch(() => false);
  if (!valid) return;

  const policyContent = buildPolicyContent();
  if (!policyContent) return;
  form.policyContent = policyContent;

  submitting.value = true;
  const [err] = await to(modifySecurityPolicy({ ...form, policyContent }));
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

.security-policy-page :deep(.el-date-editor.el-input) {
  width: 100%;
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

.json-input :deep(.el-textarea__inner) {
  font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
  line-height: 20px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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

.help-title {
  margin-bottom: 8px;
  font-weight: 600;
  color: #303133;
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
