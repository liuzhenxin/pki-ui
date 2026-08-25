<template>
  <div class="p-2">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>告警规则</span>
          <div class="header-actions">
            <el-button v-hasPermi="['ra:alert:rule']" icon="Refresh" @click="getList">刷新</el-button>
            <el-button v-hasPermi="['ra:alert:rule']" type="warning" plain icon="Bell" :loading="scanning" @click="handleScan">手动扫描</el-button>
            <el-button v-hasPermi="['ra:alert:rule']" type="primary" icon="Plus" @click="handleAdd">新增规则</el-button>
          </div>
        </div>
      </template>

      <el-form ref="queryFormRef" :model="queryParams" inline class="query-form">
        <el-form-item label="规则名称" prop="ruleName">
          <el-input v-model="queryParams.ruleName" clearable placeholder="请输入规则名称" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="告警类型" prop="alertType">
          <el-select v-model="queryParams.alertType" clearable placeholder="全部" style="width: 150px">
            <el-option v-for="item in alertTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="级别" prop="alertLevel">
          <el-select v-model="queryParams.alertLevel" clearable placeholder="全部" style="width: 120px">
            <el-option v-for="item in alertLevelOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="ruleStatus">
          <el-select v-model="queryParams.ruleStatus" clearable placeholder="全部" style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="ruleList" border @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="45" align="center" />
        <el-table-column label="规则名称" prop="ruleName" min-width="180" show-overflow-tooltip />
        <el-table-column label="告警类型" width="140">
          <template #default="{ row }">{{ alertTypeText(row.alertType) }}</template>
        </el-table-column>
        <el-table-column label="级别" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="alertLevelTag(row.alertLevel)" effect="light">{{ alertLevelText(row.alertLevel) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="阈值" prop="thresholdValue" width="100" align="center" />
        <el-table-column label="冷静期(分钟)" width="120" align="center">
          <template #default="{ row }">{{ row.coolDownMinutes }} 分钟</template>
        </el-table-column>
        <el-table-column label="通知方式" width="110">
          <template #default="{ row }">{{ notificationTypeText(row.notificationType) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.ruleStatus === 1 ? 'success' : 'info'" effect="light">{{ row.ruleStatus === 1 ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" prop="updateTime" width="170" />
        <el-table-column label="操作" fixed="right" width="180" align="center">
          <template #default="{ row }">
            <el-tooltip content="编辑" placement="top">
              <el-button v-hasPermi="['ra:alert:rule']" link type="primary" icon="Edit" @click="handleEdit(row)" />
            </el-tooltip>
            <el-tooltip :content="row.ruleStatus === 1 ? '禁用' : '启用'" placement="top">
              <el-button
                v-hasPermi="['ra:alert:rule']"
                link
                type="primary"
                :icon="row.ruleStatus === 1 ? 'VideoPause' : 'VideoPlay'"
                @click="handleStatus(row)"
              />
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button v-hasPermi="['ra:alert:rule']" link type="danger" icon="Delete" @click="handleDelete(row)" />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <el-button v-hasPermi="['ra:alert:rule']" :disabled="multiple" type="danger" plain icon="Delete" @click="handleDelete()">删除</el-button>
        <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
      </div>
    </el-card>

    <el-dialog v-model="dialog.visible" :title="dialog.title" width="760px" append-to-body>
      <el-form ref="ruleFormRef" :model="form" :rules="rules" label-width="110px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="规则名称" prop="ruleName">
              <el-input v-model="form.ruleName" maxlength="100" placeholder="请输入规则名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="告警类型" prop="alertType">
              <el-select v-model="form.alertType" style="width: 100%" @change="resetCondition">
                <el-option v-for="item in alertTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="告警级别" prop="alertLevel">
              <el-select v-model="form.alertLevel" style="width: 100%">
                <el-option v-for="item in alertLevelOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="冷静期" prop="coolDownMinutes">
              <div class="number-with-unit">
                <el-input-number v-model="form.coolDownMinutes" :min="0" :max="10080" controls-position="right" />
                <span class="unit-text">分钟</span>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="状态">
              <el-switch v-model="form.ruleStatus" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="禁用" />
            </el-form-item>
          </el-col>
        </el-row>

        <template v-if="form.alertType === 'cert_expire'">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="预警天数">
                <el-input-number v-model="form.triggerCondition.days" :min="1" :max="3650" controls-position="right" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="证书范围">
                <el-select v-model="form.triggerCondition.certificateScope" style="width: 100%">
                  <el-option label="业务证书" value="business" />
                  <el-option label="根证书及中间证书" value="ca" />
                  <el-option label="全部证书" value="all" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </template>
        <template v-if="form.alertType === 'pending_approval'">
          <el-form-item label="待审批阈值">
            <el-input-number v-model="form.triggerCondition.maxPendingCount" :min="1" :max="100000" controls-position="right" />
          </el-form-item>
          <el-form-item label="积压小时数">
            <el-input-number v-model="form.triggerCondition.olderThanHours" :min="0" :max="87600" controls-position="right" />
          </el-form-item>
        </template>

        <el-alert title="站内通知会直接发送；邮件、短信和Webhook需配置对应发送服务。" type="info" :closable="false" show-icon class="form-alert" />
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="通知方式" prop="notificationType">
              <el-select v-model="form.notificationType" style="width: 100%">
                <el-option v-for="item in notificationTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="规则描述">
              <el-input v-model="form.description" maxlength="500" placeholder="请输入描述" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button :loading="validating" icon="CircleCheck" @click="handleValidate">校验</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="RaAlertRule" lang="ts">
import { ComponentInternalInstance, getCurrentInstance, reactive, ref } from 'vue';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { to } from 'await-to-js';
import {
  getRaAlertRule,
  modifyRaAlertRule,
  pageRaAlertRule,
  removeRaAlertRule,
  saveRaAlertRule,
  scanRaAlerts,
  updateRaAlertRuleStatus,
  validateRaAlertRule
} from '@/api/ra/alert';
import type { RaAlertRule } from '@/api/ra/alert';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const alertTypeOptions = [
  { label: '证书过期预警', value: 'cert_expire' },
  { label: '待审批积压', value: 'pending_approval' }
];
const alertLevelOptions = [
  { label: '信息', value: 'info' },
  { label: '警告', value: 'warning' },
  { label: '错误', value: 'error' },
  { label: '严重', value: 'critical' }
];
const notificationTypeOptions = [
  { label: '站内配置', value: 'inapp' },
  { label: '邮件配置', value: 'email' },
  { label: '短信配置', value: 'sms' },
  { label: 'Webhook配置', value: 'webhook' }
];

const loading = ref(false);
const submitting = ref(false);
const validating = ref(false);
const scanning = ref(false);
const total = ref(0);
const ruleList = ref<RaAlertRule[]>([]);
const ids = ref<Array<number | string>>([]);
const multiple = ref(true);
const queryFormRef = ref<FormInstance>();
const ruleFormRef = ref<FormInstance>();

const queryParams = reactive({ pageNum: 1, pageSize: 10, ruleName: '', alertType: '', alertLevel: '', ruleStatus: '' as number | string });
const dialog = reactive({ visible: false, title: '' });

const defaultCondition = (type = 'cert_expire') =>
  type === 'pending_approval' ? { maxPendingCount: 10, olderThanHours: 0 } : { days: 30, includeRevoked: false, certificateScope: 'business' };
const defaultForm = (): RaAlertRule => ({
  ruleName: '',
  alertType: 'cert_expire',
  alertLevel: 'warning',
  triggerCondition: defaultCondition(),
  notificationType: 'inapp',
  notificationConfig: {},
  coolDownMinutes: 30,
  ruleStatus: 1,
  description: ''
});
const form = reactive<RaAlertRule>(defaultForm());

const rules: FormRules = {
  ruleName: [{ required: true, message: '规则名称不能为空', trigger: 'blur' }],
  alertType: [{ required: true, message: '请选择告警类型', trigger: 'change' }],
  alertLevel: [{ required: true, message: '请选择告警级别', trigger: 'change' }],
  notificationType: [{ required: true, message: '请选择通知方式', trigger: 'change' }],
  coolDownMinutes: [{ required: true, message: '请输入冷静期', trigger: 'change' }]
};

const unwrap = (response: any) => response?.data ?? response;

async function getList() {
  loading.value = true;
  try {
    const response = await pageRaAlertRule(queryParams);
    const data = unwrap(response) || {};
    ruleList.value = data.records || data.rows || [];
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  Object.assign(form, defaultForm());
  ruleFormRef.value?.clearValidate();
}

function handleQuery() {
  queryParams.pageNum = 1;
  getList();
}

function resetQuery() {
  queryFormRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: RaAlertRule[]) {
  ids.value = selection.map((item) => item.id!).filter(Boolean);
  multiple.value = ids.value.length === 0;
}

function handleAdd() {
  resetForm();
  dialog.title = '新增告警规则';
  dialog.visible = true;
}

async function handleEdit(row: RaAlertRule) {
  resetForm();
  const response = await getRaAlertRule(row.id!);
  Object.assign(form, unwrap(response));
  form.triggerCondition = form.triggerCondition || defaultCondition(form.alertType);
  if (form.alertType === 'cert_expire' && !form.triggerCondition.certificateScope) {
    form.triggerCondition.certificateScope = 'business';
  }
  dialog.title = '修改告警规则';
  dialog.visible = true;
}

function resetCondition() {
  form.triggerCondition = defaultCondition(form.alertType);
}

async function handleStatus(row: RaAlertRule) {
  const nextStatus = row.ruleStatus === 1 ? 0 : 1;
  await updateRaAlertRuleStatus(row.id!, nextStatus);
  ElMessage.success(nextStatus === 1 ? '已启用' : '已禁用');
  await getList();
}

async function handleDelete(row?: RaAlertRule) {
  const deleteIds = row?.id ? [row.id] : ids.value;
  if (!deleteIds.length) {
    ElMessage.warning('请选择要删除的告警规则');
    return;
  }
  const [err] = await to(proxy?.$modal.confirm('是否确认删除选中的告警规则？') as any);
  if (!err) {
    await removeRaAlertRule(deleteIds);
    ElMessage.success('删除成功');
    await getList();
  }
}

async function handleValidate() {
  await ruleFormRef.value?.validate();
  validating.value = true;
  try {
    await validateRaAlertRule(normalizeSubmitForm());
    ElMessage.success('告警规则校验通过');
  } finally {
    validating.value = false;
  }
}

async function submitForm() {
  await ruleFormRef.value?.validate();
  submitting.value = true;
  try {
    const payload = normalizeSubmitForm();
    if (form.id) {
      await modifyRaAlertRule(payload);
    } else {
      await saveRaAlertRule(payload);
    }
    ElMessage.success('保存成功');
    dialog.visible = false;
    await getList();
  } finally {
    submitting.value = false;
  }
}

async function handleScan() {
  scanning.value = true;
  try {
    const response = await scanRaAlerts();
    const data = unwrap(response) || {};
    ElMessage.success(`扫描完成，规则 ${data.ruleCount || 0} 条，生成告警 ${data.generatedCount || 0} 条`);
  } finally {
    scanning.value = false;
  }
}

function normalizeSubmitForm(): RaAlertRule {
  return {
    ...form,
    ruleName: form.ruleName.trim(),
    description: form.description?.trim(),
    thresholdValue:
      form.alertType === 'pending_approval' ? String(form.triggerCondition.maxPendingCount || 10) : String(form.triggerCondition.days || 30)
  };
}

function alertTypeText(value?: string) {
  return alertTypeOptions.find((item) => item.value === value)?.label || value || '-';
}

function alertLevelText(value?: string) {
  return alertLevelOptions.find((item) => item.value === value)?.label || value || '-';
}

function alertLevelTag(value?: string) {
  return value === 'critical' || value === 'error' ? 'danger' : value === 'warning' ? 'warning' : 'info';
}

function notificationTypeText(value?: string) {
  return notificationTypeOptions.find((item) => item.value === value)?.label || value || '-';
}

getList();
</script>

<style scoped lang="scss">
.card-header,
.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.query-form {
  margin-bottom: 12px;
}

.table-footer {
  margin-top: 12px;
}

.form-alert {
  margin-bottom: 16px;
}

.number-with-unit {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.unit-text {
  color: var(--el-text-color-regular);
  white-space: nowrap;
}
</style>
