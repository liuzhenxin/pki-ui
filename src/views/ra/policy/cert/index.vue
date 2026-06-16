<template>
  <div class="p-2">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>证书策略</span>
          <div class="header-actions">
            <el-button v-hasPermi="['ra:policy:cert:list']" icon="Refresh" @click="getList">刷新</el-button>
            <el-button v-hasPermi="['ra:policy:cert:save']" type="primary" icon="Plus" @click="handleAdd">新增策略</el-button>
          </div>
        </div>
      </template>

      <el-form ref="queryFormRef" :model="queryParams" inline class="query-form">
        <el-form-item label="策略名称" prop="policyName">
          <el-input v-model="queryParams.policyName" clearable placeholder="请输入策略名称" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="策略OID" prop="policyOid">
          <el-input v-model="queryParams.policyOid" clearable placeholder="1.3.6.1..." @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="证书模板" prop="profileId">
          <el-select v-model="queryParams.profileId" clearable filterable placeholder="请选择模板" style="width: 220px">
            <el-option v-for="item in profileOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="policyStatus">
          <el-select v-model="queryParams.policyStatus" clearable placeholder="全部" style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['ra:policy:cert:list']" type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="policyList" border @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="45" align="center" />
        <el-table-column label="策略名称" prop="policyName" min-width="160" show-overflow-tooltip />
        <el-table-column label="策略OID" prop="policyOid" min-width="180" show-overflow-tooltip />
        <el-table-column label="绑定模板" min-width="220">
          <template #default="{ row }">
            <el-tag v-for="profile in row.profiles || []" :key="profile.id" class="mr-1" effect="light">
              {{ profile.name }}
            </el-tag>
            <span v-if="!row.profiles?.length" class="muted">未绑定</span>
          </template>
        </el-table-column>
        <el-table-column label="用途" min-width="160">
          <template #default="{ row }">
            <span>{{ usageText(row.rules?.certUsages) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="密钥算法" min-width="180">
          <template #default="{ row }">
            <span>{{ (row.rules?.keyAlgorithms || []).join(', ') }}</span>
          </template>
        </el-table-column>
        <el-table-column label="有效期" width="150" align="center">
          <template #default="{ row }">
            <span>{{ row.rules?.validity?.minDays }}-{{ row.rules?.validity?.maxDays }}天</span>
          </template>
        </el-table-column>
        <el-table-column label="审批" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.rules?.approvalRequired ? 'warning' : 'success'" effect="light">
              {{ row.rules?.approvalRequired ? '需要' : '无需' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.policyStatus === 1 ? 'success' : 'info'" effect="light">
              {{ row.policyStatus === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" prop="updateTime" width="170" />
        <el-table-column label="操作" fixed="right" width="210" align="center">
          <template #default="{ row }">
            <el-tooltip content="详情" placement="top">
              <el-button v-hasPermi="['ra:policy:cert:get']" link type="primary" icon="View" @click="handleDetail(row)" />
            </el-tooltip>
            <el-tooltip content="编辑" placement="top">
              <el-button v-hasPermi="['ra:policy:cert:modify']" link type="primary" icon="Edit" @click="handleEdit(row)" />
            </el-tooltip>
            <el-tooltip :content="row.policyStatus === 1 ? '禁用' : '启用'" placement="top">
              <el-button
                v-hasPermi="['ra:policy:cert:status']"
                link
                type="primary"
                :icon="row.policyStatus === 1 ? 'VideoPause' : 'VideoPlay'"
                @click="handleStatus(row)"
              />
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button v-hasPermi="['ra:policy:cert:remove']" link type="danger" icon="Delete" @click="handleDelete(row)" />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <el-button v-hasPermi="['ra:policy:cert:remove']" :disabled="multiple" type="danger" plain icon="Delete" @click="handleDelete()">
          删除
        </el-button>
        <pagination
          v-show="total > 0"
          v-model:page="queryParams.pageNum"
          v-model:limit="queryParams.pageSize"
          :total="total"
          @pagination="getList"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialog.visible" :title="dialog.title" width="760px" append-to-body>
      <el-form ref="policyFormRef" :model="form" :rules="rules" label-width="120px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="策略名称" prop="policyName">
              <el-input v-model="form.policyName" maxlength="100" placeholder="请输入策略名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="策略OID" prop="policyOid">
              <el-input v-model="form.policyOid" placeholder="1.3.6.1.4.1..." />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="绑定模板" prop="profileIds">
          <el-select v-model="form.profileIds" multiple filterable placeholder="请选择证书模板" style="width: 100%">
            <el-option v-for="item in profileOptions" :key="item.id" :label="item.name" :value="item.id">
              <span>{{ item.name }}</span>
              <span class="option-extra">{{ item.type }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="证书用途" prop="rules.certUsages">
          <el-select v-model="form.rules.certUsages" multiple placeholder="请选择证书用途" style="width: 100%">
            <el-option v-for="item in usageOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="密钥算法" prop="rules.keyAlgorithms">
          <el-select v-model="form.rules.keyAlgorithms" multiple placeholder="请选择密钥算法" style="width: 100%">
            <el-option v-for="item in algorithmOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="最小有效期" prop="rules.validity.minDays">
              <el-input-number v-model="form.rules.validity.minDays" :min="1" :max="36500" controls-position="right" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="默认有效期" prop="rules.validity.defaultDays">
              <el-input-number v-model="form.rules.validity.defaultDays" :min="1" :max="36500" controls-position="right" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="最大有效期" prop="rules.validity.maxDays">
              <el-input-number v-model="form.rules.validity.maxDays" :min="1" :max="36500" controls-position="right" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="需要审批">
          <el-switch v-model="form.rules.approvalRequired" />
        </el-form-item>
        <el-form-item label="策略状态">
          <el-radio-group v-model="form.policyStatus">
            <el-radio-button :value="1">启用</el-radio-button>
            <el-radio-button :value="0">禁用</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="策略描述">
          <el-input v-model="form.policyDescription" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button v-hasPermi="['ra:policy:cert:get']" :loading="validating" icon="CircleCheck" @click="handleValidate">校验</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detail.visible" title="证书策略详情" width="760px" append-to-body>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="策略名称">{{ detail.data?.policyName }}</el-descriptions-item>
        <el-descriptions-item label="策略OID">{{ detail.data?.policyOid }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ detail.data?.policyStatus === 1 ? '启用' : '禁用' }}</el-descriptions-item>
        <el-descriptions-item label="审批">{{ detail.data?.rules?.approvalRequired ? '需要审批' : '无需审批' }}</el-descriptions-item>
        <el-descriptions-item label="绑定模板" :span="2">
          <el-tag v-for="profile in detail.data?.profiles || []" :key="profile.id" class="mr-1" effect="light">{{ profile.name }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{ detail.data?.policyDescription || '-' }}</el-descriptions-item>
      </el-descriptions>
      <pre class="rules-json">{{ formatRules(detail.data?.rules) }}</pre>
    </el-dialog>
  </div>
</template>

<script setup name="RaCertPolicy" lang="ts">
import { ComponentInternalInstance, getCurrentInstance, onMounted, reactive, ref } from 'vue';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { to } from 'await-to-js';
import {
  getRaCertPolicy,
  listRaProfileOptions,
  modifyRaCertPolicy,
  pageRaCertPolicy,
  removeRaCertPolicy,
  saveRaCertPolicy,
  updateRaCertPolicyStatus,
  validateRaCertPolicy
} from '@/api/ra/certPolicy';
import type { RaCertPolicy, RaCertPolicyRules, RaProfileOption } from '@/api/ra/certPolicy';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const loading = ref(false);
const submitting = ref(false);
const validating = ref(false);
const total = ref(0);
const policyList = ref<RaCertPolicy[]>([]);
const profileOptions = ref<RaProfileOption[]>([]);
const ids = ref<Array<number | string>>([]);
const multiple = ref(true);
const queryFormRef = ref<FormInstance>();
const policyFormRef = ref<FormInstance>();

const usageOptions = [
  { label: 'TLS服务器', value: 'tls_server' },
  { label: 'TLS客户端', value: 'tls_client' },
  { label: '电子邮件', value: 'email' },
  { label: '代码签名', value: 'code_signing' },
  { label: '通用', value: 'generic' }
];
const algorithmOptions = ['RSA-2048', 'RSA-3072', 'RSA-4096', 'SM2P256V1'];

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  policyName: '',
  policyOid: '',
  profileId: '',
  policyStatus: ''
});

const dialog = reactive({
  visible: false,
  title: ''
});

const detail = reactive({
  visible: false,
  data: undefined as RaCertPolicy | undefined
});

const defaultRules = (): RaCertPolicyRules => ({
  certUsages: ['generic'],
  keyAlgorithms: ['RSA-2048', 'SM2P256V1'],
  validity: {
    minDays: 1,
    defaultDays: 365,
    maxDays: 3650
  },
  approvalRequired: true
});

const defaultForm = (): RaCertPolicy => ({
  policyOid: '',
  policyName: '',
  policyDescription: '',
  policyStatus: 1,
  profileIds: [],
  rules: defaultRules()
});

const form = reactive<RaCertPolicy>(defaultForm());

const validateValidity = (_rule: any, _value: any, callback: any) => {
  const { minDays, defaultDays, maxDays } = form.rules.validity;
  if (minDays < 1 || maxDays > 36500 || minDays > defaultDays || defaultDays > maxDays) {
    callback(new Error('需满足 1 <= 最小 <= 默认 <= 最大 <= 36500'));
    return;
  }
  callback();
};

const rules: FormRules = {
  policyName: [{ required: true, message: '策略名称不能为空', trigger: 'blur' }],
  policyOid: [
    { required: true, message: '策略OID不能为空', trigger: 'blur' },
    { pattern: /^[0-9]+(\.[0-9]+)+$/, message: '策略OID格式无效', trigger: 'blur' }
  ],
  profileIds: [{ required: true, type: 'array', min: 1, message: '至少绑定一个证书模板', trigger: 'change' }],
  'rules.certUsages': [{ required: true, type: 'array', min: 1, message: '至少选择一个证书用途', trigger: 'change' }],
  'rules.keyAlgorithms': [{ required: true, type: 'array', min: 1, message: '至少选择一个密钥算法', trigger: 'change' }],
  'rules.validity.minDays': [{ validator: validateValidity, trigger: 'change' }],
  'rules.validity.defaultDays': [{ validator: validateValidity, trigger: 'change' }],
  'rules.validity.maxDays': [{ validator: validateValidity, trigger: 'change' }]
};

const unwrap = (response: any) => response?.data ?? response;

function resetForm() {
  Object.assign(form, defaultForm());
  policyFormRef.value?.clearValidate();
}

async function loadProfileOptions() {
  const response = await listRaProfileOptions();
  profileOptions.value = unwrap(response) || [];
}

async function getList() {
  loading.value = true;
  try {
    const response = await pageRaCertPolicy(queryParams as any);
    const data = unwrap(response) || {};
    policyList.value = data.records || data.rows || [];
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  queryParams.pageNum = 1;
  getList();
}

function resetQuery() {
  queryFormRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: RaCertPolicy[]) {
  ids.value = selection.map((item) => item.id!).filter(Boolean);
  multiple.value = ids.value.length === 0;
}

function handleAdd() {
  resetForm();
  dialog.title = '新增证书策略';
  dialog.visible = true;
}

async function handleEdit(row: RaCertPolicy) {
  resetForm();
  const response = await getRaCertPolicy(row.id!);
  Object.assign(form, normalizePolicy(unwrap(response)));
  dialog.title = '修改证书策略';
  dialog.visible = true;
}

async function handleDetail(row: RaCertPolicy) {
  const response = await getRaCertPolicy(row.id!);
  detail.data = normalizePolicy(unwrap(response));
  detail.visible = true;
}

async function handleStatus(row: RaCertPolicy) {
  const nextStatus = row.policyStatus === 1 ? 0 : 1;
  await updateRaCertPolicyStatus(row.id!, nextStatus);
  ElMessage.success(nextStatus === 1 ? '已启用' : '已禁用');
  await getList();
}

async function handleDelete(row?: RaCertPolicy) {
  const deleteIds = row?.id ? [row.id] : ids.value;
  if (!deleteIds.length) {
    ElMessage.warning('请选择要删除的证书策略');
    return;
  }
  const [err] = await to(proxy?.$modal.confirm('是否确认删除选中的证书策略？') as any);
  if (!err) {
    await removeRaCertPolicy(deleteIds);
    ElMessage.success('删除成功');
    await getList();
  }
}

async function handleValidate() {
  await policyFormRef.value?.validate();
  validating.value = true;
  try {
    await validateRaCertPolicy(form);
    ElMessage.success('策略校验通过');
  } finally {
    validating.value = false;
  }
}

async function submitForm() {
  await policyFormRef.value?.validate();
  submitting.value = true;
  try {
    if (form.id) {
      await modifyRaCertPolicy(form);
    } else {
      await saveRaCertPolicy(form);
    }
    ElMessage.success('保存成功');
    dialog.visible = false;
    await getList();
  } finally {
    submitting.value = false;
  }
}

function normalizePolicy(policy: any): RaCertPolicy {
  const normalized = {
    ...defaultForm(),
    ...policy,
    rules: {
      ...defaultRules(),
      ...(policy?.rules || parseRules(policy?.policyRules))
    },
    profileIds: policy?.profileIds || (policy?.profiles || []).map((item: RaProfileOption) => item.id)
  };
  normalized.rules.validity = {
    ...defaultRules().validity,
    ...(normalized.rules.validity || {})
  };
  return normalized;
}

function parseRules(policyRules?: string) {
  if (!policyRules) {
    return defaultRules();
  }
  try {
    return JSON.parse(policyRules);
  } catch (_error) {
    return defaultRules();
  }
}

function usageText(values?: string[]) {
  if (!values?.length) {
    return '-';
  }
  return values.map((value) => usageOptions.find((item) => item.value === value)?.label || value).join(', ');
}

function formatRules(value?: RaCertPolicyRules) {
  return JSON.stringify(value || {}, null, 2);
}

onMounted(async () => {
  await loadProfileOptions();
  await getList();
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

.mr-1 {
  margin-right: 4px;
  margin-bottom: 4px;
}

.muted,
.option-extra {
  color: #909399;
}

.option-extra {
  float: right;
  font-size: 12px;
}

.table-footer {
  margin-top: 12px;
}

.rules-json {
  margin-top: 16px;
  padding: 12px;
  overflow: auto;
  background: #f5f7fa;
  border-radius: 4px;
  line-height: 1.5;
}
</style>
