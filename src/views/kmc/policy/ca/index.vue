<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryFormRef" :inline="true" v-show="showSearch" label-width="90px">
      <el-form-item label="CA名称" prop="name">
        <el-input v-model="queryParams.name" placeholder="请输入CA名称" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="状态" clearable style="width: 140px">
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" v-hasPermi="['kmc:ca:save']" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" v-hasPermi="['kmc:ca:modify']" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['kmc:ca:remove']" @click="handleDelete()">删除</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-row>

    <el-table v-loading="loading" :data="rows" border @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" align="center" />
      <el-table-column prop="id" label="ID" width="90" align="center" />
      <el-table-column prop="name" label="CA名称" min-width="180" show-overflow-tooltip />
      <el-table-column label="状态" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="isEnabled(row.status) ? 'success' : 'info'">
            {{ formatStatus(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="通信证书" width="120" align="center">
        <template #default="{ row }">
          <el-tag :type="row.certFingerprintSha256 ? 'success' : 'danger'">
            {{ row.certFingerprintSha256 ? '已配置' : '未配置' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="certSubject" label="证书主题" min-width="220" show-overflow-tooltip />
      <el-table-column prop="description" label="描述" min-width="220" show-overflow-tooltip />
      <el-table-column label="操作" width="250" fixed="right" align="center" class-name="small-padding fixed-width">
        <template #default="{ row }">
          <el-button link type="primary" icon="View" @click="handleDetail(row)">查看</el-button>
          <el-button link type="primary" icon="Edit" v-hasPermi="['kmc:ca:modify']" @click="handleUpdate(row)">修改</el-button>
          <el-button link type="primary" icon="Key" v-hasPermi="['kmc:ca:verify']" @click="handleVerify(row)">验证</el-button>
          <el-button link type="danger" icon="Delete" v-hasPermi="['kmc:ca:remove']" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog v-model="dialog.visible" :title="dialog.title" width="560px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="CA名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入CA名称" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio v-for="item in statusOptions" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="通信证书" prop="communicationCertPem">
          <el-input
            v-model="form.communicationCertPem"
            type="textarea"
            :rows="8"
            maxlength="12000"
            show-word-limit
            placeholder="请粘贴CA与KMC通信使用的X.509证书PEM"
          />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="4" maxlength="500" show-word-limit placeholder="请输入CA机构说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialog.visible" title="CA机构详情" width="560px" append-to-body>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="ID">{{ detail.id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="CA名称">{{ detail.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ formatStatus(detail.status) }}</el-descriptions-item>
        <el-descriptions-item label="通信证书主题">{{ detail.certSubject || '-' }}</el-descriptions-item>
        <el-descriptions-item label="通信证书颁发者">{{ detail.certIssuer || '-' }}</el-descriptions-item>
        <el-descriptions-item label="通信证书序列号">{{ detail.certSerialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="通信证书有效期">
          {{ detail.certNotBefore || '-' }} 至 {{ detail.certNotAfter || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="通信证书指纹">{{ detail.certFingerprintSha256 || '-' }}</el-descriptions-item>
        <el-descriptions-item label="描述">{{ detail.description || '-' }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button type="primary" @click="detailDialog.visible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="verifyDialog.visible" title="验证CA身份" width="640px" append-to-body>
      <el-form ref="verifyFormRef" :model="verifyForm" :rules="verifyRules" label-width="110px">
        <el-form-item label="CA机构">{{ verifyDialog.caName }}</el-form-item>
        <el-form-item label="挑战值" prop="challenge">
          <el-input v-model="verifyForm.challenge" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="签名算法" prop="algorithm">
          <el-select v-model="verifyForm.algorithm" clearable placeholder="为空时后端按证书公钥推断" style="width: 100%">
            <el-option label="SM3withSM2" value="SM3withSM2" />
            <el-option label="SHA256withRSA" value="SHA256withRSA" />
          </el-select>
        </el-form-item>
        <el-form-item label="签名值" prop="signatureBase64">
          <el-input v-model="verifyForm.signatureBase64" type="textarea" :rows="5" placeholder="请粘贴CA私钥对挑战值签名后的Base64" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="verifyDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="verifyDialog.loading" @click="submitVerify">验证</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="KmcCaPolicy" lang="ts">
import { onMounted, reactive, ref } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { addKmcCa, delKmcCa, getKmcCa, listKmcCa, updateKmcCa, verifyKmcCaIdentity } from '@/api/kmc/ca';
import type { KmcCaForm, KmcCaIdentityVerifyForm, KmcCaIdentityVerifyResult, KmcCaQuery, KmcCaVO } from '@/api/kmc/ca/types';
import { readKmcPage, unwrapKmcData } from '@/api/kmc/common';

const queryFormRef = ref<FormInstance>();
const formRef = ref<FormInstance>();
const verifyFormRef = ref<FormInstance>();
const loading = ref(false);
const submitLoading = ref(false);
const showSearch = ref(true);
const rows = ref<KmcCaVO[]>([]);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);

const statusOptions = [
  { label: '启用', value: '1' },
  { label: '停用', value: '0' }
];

const queryParams = reactive<KmcCaQuery>({
  pageNum: 1,
  pageSize: 10
});
const form = reactive<KmcCaForm>({
  name: '',
  type: 'ROOT',
  status: '1',
  communicationCertPem: '',
  description: ''
});
const dialog = reactive({ visible: false, title: '' });
const detailDialog = reactive({ visible: false });
const verifyDialog = reactive({ visible: false, loading: false, caName: '' });
const detail = reactive<KmcCaVO>({
  id: '',
  name: '',
  type: '',
  status: '',
  communicationCertPem: '',
  certSubject: '',
  certIssuer: '',
  certSerialNumber: '',
  certNotBefore: '',
  certNotAfter: '',
  certFingerprintSha256: '',
  description: ''
});
const verifyForm = reactive<KmcCaIdentityVerifyForm>({
  caId: '',
  challenge: '',
  signatureBase64: '',
  algorithm: ''
});
const rules = reactive<FormRules>({
  name: [
    { required: true, message: '请输入CA名称', trigger: 'blur' },
    { min: 2, max: 100, message: 'CA名称长度为2到100个字符', trigger: 'blur' }
  ],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
  communicationCertPem: [{ required: true, message: '请配置CA通信证书', trigger: 'blur' }],
  description: [{ max: 500, message: '描述不能超过500个字符', trigger: 'blur' }]
});
const verifyRules = reactive<FormRules>({
  challenge: [{ required: true, message: '请输入挑战值', trigger: 'blur' }],
  signatureBase64: [{ required: true, message: '请输入签名值', trigger: 'blur' }]
});

const isEnabled = (status?: string) => ['1', 'ENABLED', 'ENABLE'].includes(String(status || '').toUpperCase());
const formatStatus = (status?: string) => (isEnabled(status) ? '启用' : '停用');

const resetForm = () => {
  Object.assign(form, { id: undefined, name: '', type: 'ROOT', status: '1', communicationCertPem: '', description: '' });
  formRef.value?.resetFields();
};

const getList = async () => {
  loading.value = true;
  try {
    const page = readKmcPage<KmcCaVO>(await listKmcCa(queryParams));
    rows.value = page.records;
    total.value = page.total;
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryFormRef.value?.resetFields();
  handleQuery();
};

const handleSelectionChange = (selection: KmcCaVO[]) => {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
};

const handleAdd = () => {
  resetForm();
  dialog.title = '新增CA机构';
  dialog.visible = true;
};

const handleUpdate = async (row?: KmcCaVO) => {
  resetForm();
  const id = row?.id || ids.value[0];
  Object.assign(form, unwrapKmcData(await getKmcCa(id)));
  dialog.title = '修改CA机构';
  dialog.visible = true;
};

const submitForm = async () => {
  if (!(await formRef.value?.validate().catch(() => false))) {
    return;
  }
  submitLoading.value = true;
  try {
    if (form.id) {
      await updateKmcCa(form);
    } else {
      await addKmcCa(form);
    }
    ElMessage.success('保存成功');
    dialog.visible = false;
    await getList();
  } finally {
    submitLoading.value = false;
  }
};

const handleDetail = async (row: KmcCaVO) => {
  Object.assign(detail, unwrapKmcData(await getKmcCa(row.id)));
  detailDialog.visible = true;
};

const createChallenge = (id: string | number) => {
  const random = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `KMC-CA-VERIFY:${id}:${random}`;
};

const handleVerify = (row: KmcCaVO) => {
  verifyFormRef.value?.clearValidate();
  Object.assign(verifyForm, {
    caId: row.id,
    challenge: createChallenge(row.id),
    signatureBase64: '',
    algorithm: ''
  });
  verifyDialog.caName = row.name;
  verifyDialog.visible = true;
};

const submitVerify = async () => {
  if (!(await verifyFormRef.value?.validate().catch(() => false))) {
    return;
  }
  verifyDialog.loading = true;
  try {
    const result = unwrapKmcData<KmcCaIdentityVerifyResult>(await verifyKmcCaIdentity(verifyForm));
    if (result.verified) {
      ElMessage.success(result.message || 'CA身份验证通过');
      verifyDialog.visible = false;
    } else {
      ElMessage.error(result.message || 'CA身份验证未通过');
    }
  } finally {
    verifyDialog.loading = false;
  }
};

const handleDelete = async (row?: KmcCaVO) => {
  const caIds = row?.id ? [row.id] : ids.value;
  await ElMessageBox.confirm('确认删除所选CA机构？', '提示', { type: 'warning' });
  await delKmcCa(caIds);
  ElMessage.success('删除成功');
  await getList();
};

onMounted(getList);
</script>

<style scoped lang="scss"></style>
