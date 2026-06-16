<template>
  <div class="p-2">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>流程定义</span>
          <div class="header-actions">
            <el-button v-hasPermi="['ra:workflow:def']" icon="Refresh" @click="getList">刷新</el-button>
            <el-button v-hasPermi="['ra:workflow:def']" type="primary" icon="Plus" @click="handleAdd">新增流程</el-button>
          </div>
        </div>
      </template>

      <el-form ref="queryFormRef" :model="queryParams" inline class="query-form">
        <el-form-item label="流程名称" prop="workflowName">
          <el-input v-model="queryParams.workflowName" clearable placeholder="请输入流程名称" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="流程标识" prop="workflowKey">
          <el-input v-model="queryParams.workflowKey" clearable placeholder="ra_cert_apply_default" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="流程类型" prop="workflowType">
          <el-select v-model="queryParams.workflowType" clearable placeholder="全部" style="width: 150px">
            <el-option v-for="item in workflowTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="queryParams.status" clearable placeholder="全部" style="width: 120px">
            <el-option label="草稿" :value="0" />
            <el-option label="已发布" :value="1" />
            <el-option label="已停用" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['ra:workflow:def']" type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="definitionList" border @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="45" align="center" />
        <el-table-column label="流程名称" prop="workflowName" min-width="180" show-overflow-tooltip />
        <el-table-column label="流程标识" prop="workflowKey" min-width="180" show-overflow-tooltip />
        <el-table-column label="流程类型" width="130">
          <template #default="{ row }">{{ workflowTypeText(row.workflowType) }}</template>
        </el-table-column>
        <el-table-column label="适用范围" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">{{ scopeText(row) }}</template>
        </el-table-column>
        <el-table-column label="版本" prop="versionNo" width="80" align="center" />
        <el-table-column label="步骤" width="80" align="center">
          <template #default="{ row }">{{ approvalText(row.steps) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" effect="light">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" prop="updateTime" width="170" />
        <el-table-column label="操作" fixed="right" width="250" align="center">
          <template #default="{ row }">
            <el-tooltip content="详情" placement="top">
              <el-button v-hasPermi="['ra:workflow:def']" link type="primary" icon="View" @click="handleDetail(row)" />
            </el-tooltip>
            <el-tooltip :content="row.status === 0 ? '编辑' : '编辑为新版本草稿'" placement="top">
              <el-button v-hasPermi="['ra:workflow:def']" link type="primary" icon="Edit" @click="handleEdit(row)" />
            </el-tooltip>
            <el-tooltip content="复制" placement="top">
              <el-button v-hasPermi="['ra:workflow:def']" link type="primary" icon="CopyDocument" @click="handleCopy(row)" />
            </el-tooltip>
            <el-tooltip v-if="row.status === 0" content="发布" placement="top">
              <el-button v-hasPermi="['ra:workflow:def']" link type="success" icon="Promotion" @click="handlePublish(row)" />
            </el-tooltip>
            <el-tooltip v-else :content="row.status === 1 ? '停用' : '启用'" placement="top">
              <el-button
                v-hasPermi="['ra:workflow:def']"
                link
                type="primary"
                :icon="row.status === 1 ? 'VideoPause' : 'VideoPlay'"
                @click="handleStatus(row)"
              />
            </el-tooltip>
            <el-tooltip content="删除草稿" placement="top">
              <el-button v-hasPermi="['ra:workflow:def']" link type="danger" icon="Delete" :disabled="row.status !== 0" @click="handleDelete(row)" />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <el-button v-hasPermi="['ra:workflow:def']" :disabled="multiple" type="danger" plain icon="Delete" @click="handleDelete()">
          删除草稿
        </el-button>
        <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
      </div>
    </el-card>

    <el-dialog v-model="dialog.visible" :title="dialog.title" width="920px" append-to-body>
      <el-form ref="definitionFormRef" :model="form" :rules="rules" label-width="110px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="流程名称" prop="workflowName">
              <el-input v-model="form.workflowName" maxlength="100" placeholder="请输入流程名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="流程标识" prop="workflowKey">
              <el-input v-model="form.workflowKey" :disabled="!!form.id && form.status !== 0" placeholder="ra_cert_apply_default" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="流程类型" prop="workflowType">
              <el-select v-model="form.workflowType" placeholder="请选择流程类型" style="width: 100%">
                <el-option v-for="item in workflowTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="版本号" prop="versionNo">
              <el-input-number v-model="form.versionNo" :min="1" :disabled="!!form.id && form.status !== 0" controls-position="right" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="状态">
              <el-tag :type="statusTag(form.status)" effect="light">{{ statusText(form.status) }}</el-tag>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="CA根证书" prop="scope.rootScope">
              <el-select v-model="form.scope.rootScope" style="width: 100%" @change="handleRootScopeChange">
                <el-option label="全部CA根证书" value="all" />
                <el-option label="指定CA根证书" value="selected" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item v-if="form.scope.rootScope === 'selected'" label="选择根证书" prop="scope.rootId">
              <el-select v-model="form.scope.rootId" filterable placeholder="请选择CA根证书" style="width: 100%" @change="handleRootChange">
                <el-option v-for="item in rootOptions" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="证书模板" prop="scope.profileScope">
              <el-select v-model="form.scope.profileScope" style="width: 100%" @change="handleProfileScopeChange">
                <el-option label="全部模板" value="all" />
                <el-option label="指定模板" value="selected" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item v-if="form.scope.profileScope === 'selected'" label="选择模板" prop="scope.profileId">
              <el-select v-model="form.scope.profileId" filterable placeholder="请选择证书模板" style="width: 100%">
                <el-option v-for="item in profileOptionsForForm" :key="item.id" :label="item.name" :value="item.id">
                  <span>{{ item.name }}</span>
                  <span class="option-extra">{{ item.type }}</span>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="审批步骤" prop="steps">
          <div class="steps-editor">
            <el-alert
              v-if="!form.steps.length"
              title="当前流程不需要审核，匹配该流程的证书操作将直接通过。"
              type="info"
              show-icon
              :closable="false"
              class="no-approval-alert"
            />
            <div v-for="(step, index) in form.steps" :key="index" class="step-row">
              <el-input v-model="step.key" placeholder="步骤编码" maxlength="50" />
              <el-input v-model="step.name" placeholder="步骤名称" maxlength="100" />
              <el-input v-model="step.role" placeholder="审批角色，如 审核员" maxlength="50" />
              <el-input-number v-model="step.assigneeUserId" :min="1" controls-position="right" placeholder="用户ID" />
              <el-checkbox v-model="step.allowReject">允许驳回</el-checkbox>
              <el-button icon="ArrowUp" :disabled="index === 0" @click="moveStep(index, -1)" />
              <el-button icon="ArrowDown" :disabled="index === form.steps.length - 1" @click="moveStep(index, 1)" />
              <el-button type="danger" icon="Delete" @click="removeStep(index)" />
            </div>
            <div class="step-actions">
              <el-button type="primary" plain icon="Plus" @click="addStep">增加审核步骤</el-button>
              <el-button v-if="form.steps.length" plain icon="CircleClose" @click="clearSteps">设为无需审核</el-button>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="流程描述">
          <el-input v-model="form.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button v-hasPermi="['ra:workflow:def']" :loading="validating" icon="CircleCheck" @click="handleValidate">校验</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">保存草稿</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detail.visible" title="流程定义详情" width="820px" append-to-body>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="流程名称">{{ detail.data?.workflowName }}</el-descriptions-item>
        <el-descriptions-item label="流程标识">{{ detail.data?.workflowKey }}</el-descriptions-item>
        <el-descriptions-item label="流程类型">{{ workflowTypeText(detail.data?.workflowType) }}</el-descriptions-item>
        <el-descriptions-item label="版本">v{{ detail.data?.versionNo }}</el-descriptions-item>
        <el-descriptions-item label="CA根证书">{{ rootScopeText(detail.data) }}</el-descriptions-item>
        <el-descriptions-item label="证书模板">{{ profileScopeText(detail.data) }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ statusText(detail.data?.status) }}</el-descriptions-item>
        <el-descriptions-item label="描述">{{ detail.data?.description || '-' }}</el-descriptions-item>
      </el-descriptions>
      <div class="detail-section-title">审批步骤</div>
      <el-alert
        v-if="!detail.data?.steps?.length"
        title="无需审核"
        description="该流程匹配后不会生成审核任务。"
        type="info"
        show-icon
        :closable="false"
        class="detail-no-approval"
      />
      <el-table :data="detail.data?.steps || []" border class="detail-steps">
        <el-table-column label="序号" type="index" width="60" align="center" />
        <el-table-column label="步骤名称" prop="name" min-width="140" />
        <el-table-column label="步骤编码" prop="key" min-width="140" />
        <el-table-column label="审批角色" min-width="120">
          <template #default="{ row }">{{ row.role || '-' }}</template>
        </el-table-column>
        <el-table-column label="指定用户ID" width="120">
          <template #default="{ row }">{{ row.assigneeUserId || '-' }}</template>
        </el-table-column>
        <el-table-column label="允许驳回" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.allowReject ? 'success' : 'info'" effect="light">{{ row.allowReject ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup name="RaWorkflowDefinition" lang="ts">
import { ComponentInternalInstance, computed, getCurrentInstance, onMounted, reactive, ref } from 'vue';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { to } from 'await-to-js';
import {
  copyRaWorkflowDefinition,
  getRaWorkflowDefinition,
  listRaWorkflowScopeOptions,
  modifyRaWorkflowDefinition,
  pageRaWorkflowDefinition,
  publishRaWorkflowDefinition,
  removeRaWorkflowDefinition,
  saveRaWorkflowDefinition,
  updateRaWorkflowDefinitionStatus,
  validateRaWorkflowDefinition
} from '@/api/ra/workflowDefinition';
import type { RaWorkflowDefinition, RaWorkflowProfileOption, RaWorkflowRootOption, RaWorkflowStep } from '@/api/ra/workflowDefinition';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const workflowTypeOptions = [
  { label: '全部证书操作', value: 'cert_all' },
  { label: '证书申请', value: 'cert_apply' },
  { label: '证书续期', value: 'cert_renewal' },
  { label: '证书吊销', value: 'cert_revoke' },
  { label: '证书更新', value: 'cert_update' }
];

const loading = ref(false);
const submitting = ref(false);
const validating = ref(false);
const total = ref(0);
const definitionList = ref<RaWorkflowDefinition[]>([]);
const rootOptions = ref<RaWorkflowRootOption[]>([]);
const ids = ref<Array<number | string>>([]);
const multiple = ref(true);
const queryFormRef = ref<FormInstance>();
const definitionFormRef = ref<FormInstance>();

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  workflowName: '',
  workflowKey: '',
  workflowType: '',
  status: ''
});

const dialog = reactive({
  visible: false,
  title: ''
});

const detail = reactive({
  visible: false,
  data: undefined as RaWorkflowDefinition | undefined
});

const defaultScope = () => ({
  rootScope: 'all' as const,
  rootId: undefined,
  profileScope: 'all' as const,
  profileId: undefined
});

const defaultStep = (index = 1): RaWorkflowStep => ({
  key: `review_step_${index}`,
  name: `审批步骤${index}`,
  role: '审核员',
  assigneeUserId: undefined,
  allowReject: true,
  sortNo: index
});

const defaultForm = (): RaWorkflowDefinition => ({
  workflowName: '',
  workflowKey: '',
  workflowType: 'cert_all',
  versionNo: 1,
  status: 0,
  description: '',
  scope: defaultScope(),
  steps: []
});

const form = reactive<RaWorkflowDefinition>(defaultForm());

const profileOptionsForForm = computed(() => {
  if (form.scope.rootScope === 'selected') {
    return rootOptions.value.find((item) => String(item.id) === String(form.scope.rootId))?.profiles || [];
  }
  return rootOptions.value.flatMap((root) => root.profiles || []);
});

const validateSteps = (_rule: any, value: RaWorkflowStep[], callback: any) => {
  if (!value?.length) {
    callback();
    return;
  }
  const keys = new Set<string>();
  for (const step of value) {
    if (!/^[a-z][a-z0-9_:-]{2,49}$/.test(step.key || '')) {
      callback(new Error('步骤编码格式无效'));
      return;
    }
    if (keys.has(step.key)) {
      callback(new Error(`步骤编码重复：${step.key}`));
      return;
    }
    keys.add(step.key);
    if (!step.name) {
      callback(new Error('步骤名称不能为空'));
      return;
    }
    if (!step.role && !step.assigneeUserId) {
      callback(new Error('每个步骤至少配置审批角色或指定用户'));
      return;
    }
  }
  callback();
};

const validateRootId = (_rule: any, value: number | string | undefined, callback: any) => {
  if (form.scope.rootScope === 'selected' && !value) {
    callback(new Error('请选择CA根证书'));
    return;
  }
  callback();
};

const validateProfileId = (_rule: any, value: number | string | undefined, callback: any) => {
  if (form.scope.profileScope === 'selected' && !value) {
    callback(new Error('请选择证书模板'));
    return;
  }
  callback();
};

const rules: FormRules = {
  workflowName: [{ required: true, message: '流程名称不能为空', trigger: 'blur' }],
  workflowKey: [
    { required: true, message: '流程标识不能为空', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9_:-]{2,49}$/, message: '流程标识格式无效', trigger: 'blur' }
  ],
  workflowType: [{ required: true, message: '请选择流程类型', trigger: 'change' }],
  versionNo: [{ required: true, message: '版本号不能为空', trigger: 'change' }],
  'scope.rootId': [{ validator: validateRootId, trigger: 'change' }],
  'scope.profileId': [{ validator: validateProfileId, trigger: 'change' }],
  steps: [{ validator: validateSteps, trigger: 'change' }]
};

const unwrap = (response: any) => response?.data ?? response;

function resetForm() {
  Object.assign(form, defaultForm());
  definitionFormRef.value?.clearValidate();
}

async function getList() {
  loading.value = true;
  try {
    const response = await pageRaWorkflowDefinition(queryParams as any);
    const data = unwrap(response) || {};
    definitionList.value = (data.records || data.rows || []).map(normalizeDefinition);
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}

async function loadScopeOptions() {
  const response = await listRaWorkflowScopeOptions();
  rootOptions.value = unwrap(response) || [];
}

function handleQuery() {
  queryParams.pageNum = 1;
  getList();
}

function resetQuery() {
  queryFormRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: RaWorkflowDefinition[]) {
  ids.value = selection
    .filter((item) => item.status === 0)
    .map((item) => item.id!)
    .filter(Boolean);
  multiple.value = ids.value.length === 0;
}

function handleAdd() {
  resetForm();
  dialog.title = '新增流程定义';
  dialog.visible = true;
}

function handleRootScopeChange() {
  if (form.scope.rootScope === 'all') {
    form.scope.rootId = undefined;
  }
  handleRootChange();
}

function handleRootChange() {
  if (form.scope.profileScope === 'selected') {
    const matched = profileOptionsForForm.value.some((item) => String(item.id) === String(form.scope.profileId));
    if (!matched) {
      form.scope.profileId = undefined;
    }
  }
}

function handleProfileScopeChange() {
  if (form.scope.profileScope === 'all') {
    form.scope.profileId = undefined;
  }
}

async function handleEdit(row: RaWorkflowDefinition) {
  resetForm();
  const response = await getRaWorkflowDefinition(row.id!);
  Object.assign(form, normalizeDefinition(unwrap(response)));
  dialog.title = row.status === 0 ? '修改流程定义' : '编辑为新版本草稿';
  dialog.visible = true;
}

async function handleDetail(row: RaWorkflowDefinition) {
  const response = await getRaWorkflowDefinition(row.id!);
  detail.data = normalizeDefinition(unwrap(response));
  detail.visible = true;
}

async function handleCopy(row: RaWorkflowDefinition) {
  await copyRaWorkflowDefinition(row.id!);
  ElMessage.success('复制成功，已生成新版本草稿');
  await getList();
}

async function handlePublish(row: RaWorkflowDefinition) {
  const [err] = await to(proxy?.$modal.confirm(`是否发布流程定义“${row.workflowName}”？`) as any);
  if (!err) {
    await publishRaWorkflowDefinition(row.id!);
    ElMessage.success('发布成功');
    await getList();
  }
}

async function handleStatus(row: RaWorkflowDefinition) {
  const nextStatus = row.status === 1 ? 2 : 1;
  await updateRaWorkflowDefinitionStatus(row.id!, nextStatus);
  ElMessage.success(nextStatus === 1 ? '已启用' : '已停用');
  await getList();
}

async function handleDelete(row?: RaWorkflowDefinition) {
  const deleteIds = row?.id ? [row.id] : ids.value;
  if (!deleteIds.length) {
    ElMessage.warning('请选择要删除的草稿流程');
    return;
  }
  if (row && row.status !== 0) {
    ElMessage.warning('只能删除草稿流程定义');
    return;
  }
  const [err] = await to(proxy?.$modal.confirm('是否确认删除选中的草稿流程定义？') as any);
  if (!err) {
    await removeRaWorkflowDefinition(deleteIds);
    ElMessage.success('删除成功');
    await getList();
  }
}

async function handleValidate() {
  await definitionFormRef.value?.validate();
  validating.value = true;
  try {
    await validateRaWorkflowDefinition(normalizeSubmitForm());
    ElMessage.success('流程定义校验通过');
  } finally {
    validating.value = false;
  }
}

async function submitForm() {
  await definitionFormRef.value?.validate();
  submitting.value = true;
  try {
    const payload = normalizeSubmitForm();
    if (form.id) {
      await modifyRaWorkflowDefinition(payload);
    } else {
      await saveRaWorkflowDefinition(payload);
    }
    ElMessage.success(form.id && form.status !== 0 ? '已保存为新版本草稿' : '保存成功');
    dialog.visible = false;
    await getList();
  } finally {
    submitting.value = false;
  }
}

function addStep() {
  form.steps.push(defaultStep(form.steps.length + 1));
  refreshSortNo();
}

function clearSteps() {
  form.steps.splice(0, form.steps.length);
}

function removeStep(index: number) {
  form.steps.splice(index, 1);
  refreshSortNo();
}

function moveStep(index: number, offset: number) {
  const targetIndex = index + offset;
  const item = form.steps.splice(index, 1)[0];
  form.steps.splice(targetIndex, 0, item);
  refreshSortNo();
}

function refreshSortNo() {
  form.steps.forEach((step, index) => {
    step.sortNo = index + 1;
  });
}

function normalizeSubmitForm(): RaWorkflowDefinition {
  refreshSortNo();
  return {
    ...form,
    workflowName: form.workflowName.trim(),
    workflowKey: form.workflowKey.trim(),
    description: form.description?.trim(),
    scope: {
      rootScope: form.scope.rootScope,
      rootId: form.scope.rootScope === 'selected' ? form.scope.rootId : undefined,
      profileScope: form.scope.profileScope,
      profileId: form.scope.profileScope === 'selected' ? form.scope.profileId : undefined
    },
    steps: form.steps.map((step) => ({
      ...step,
      key: step.key.trim(),
      name: step.name.trim(),
      role: step.role?.trim() || undefined,
      assigneeUserId: step.assigneeUserId || undefined,
      allowReject: step.allowReject !== false
    }))
  };
}

function normalizeDefinition(data: any): RaWorkflowDefinition {
  const normalized = {
    ...defaultForm(),
    ...data,
    scope: data?.scope || parseScope(data?.definition),
    steps: data?.steps?.length ? data.steps : parseDefinition(data?.definition)
  };
  normalized.steps = normalized.steps.map((step: RaWorkflowStep, index: number) => ({
    ...defaultStep(index + 1),
    ...step,
    allowReject: step.allowReject !== false,
    sortNo: step.sortNo || index + 1
  }));
  return normalized;
}

function parseScope(definition?: string) {
  if (!definition) {
    return defaultScope();
  }
  try {
    const data = JSON.parse(definition);
    return data.scope || defaultScope();
  } catch (_error) {
    return defaultScope();
  }
}

function parseDefinition(definition?: string): RaWorkflowStep[] {
  if (!definition) {
    return [];
  }
  try {
    const data = JSON.parse(definition);
    return data.steps || [];
  } catch (_error) {
    return [];
  }
}

function workflowTypeText(value?: string) {
  return workflowTypeOptions.find((item) => item.value === value)?.label || value || '-';
}

function findRootName(rootId?: number | string) {
  return rootOptions.value.find((item) => String(item.id) === String(rootId))?.name || rootId || '-';
}

function findProfileName(profileId?: number | string) {
  return rootOptions.value
    .flatMap((root) => root.profiles || [])
    .find((item: RaWorkflowProfileOption) => String(item.id) === String(profileId))?.name || profileId || '-';
}

function rootScopeText(row?: RaWorkflowDefinition) {
  if (!row?.scope || row.scope.rootScope !== 'selected') {
    return '全部CA根证书';
  }
  return String(findRootName(row.scope.rootId));
}

function profileScopeText(row?: RaWorkflowDefinition) {
  if (!row?.scope || row.scope.profileScope !== 'selected') {
    return '全部模板';
  }
  return String(findProfileName(row.scope.profileId));
}

function scopeText(row: RaWorkflowDefinition) {
  return `${rootScopeText(row)} / ${profileScopeText(row)}`;
}

function statusText(value?: number) {
  return value === 1 ? '已发布' : value === 2 ? '已停用' : '草稿';
}

function statusTag(value?: number) {
  return value === 1 ? 'success' : value === 2 ? 'info' : 'warning';
}

function approvalText(steps?: RaWorkflowStep[]) {
  return steps?.length ? `${steps.length}步` : '无需审核';
}

onMounted(() => {
  loadScopeOptions();
  getList();
});
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

.steps-editor {
  width: 100%;
}

.no-approval-alert {
  margin-bottom: 8px;
}

.step-actions {
  display: flex;
  gap: 8px;
}

.step-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(120px, 1fr) minmax(140px, 1fr) 130px 90px 32px 32px 32px;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.detail-steps {
  margin-top: 8px;
}

.detail-no-approval {
  margin-top: 8px;
}

.detail-section-title {
  margin-top: 16px;
  color: #303133;
  font-size: 14px;
  font-weight: 600;
}

@media (max-width: 1200px) {
  .step-row {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
