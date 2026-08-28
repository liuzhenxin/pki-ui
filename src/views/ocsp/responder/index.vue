<template>
  <div class="app-container ocsp-page">
    <el-card shadow="hover" class="mb16">
      <el-form :inline="true" :model="query">
        <el-form-item label="名称">
          <el-input v-model="query.name" clearable placeholder="响应者名称" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" clearable placeholder="全部" style="width: 140px">
            <el-option label="ACTIVE" value="ACTIVE" />
            <el-option label="INACTIVE" value="INACTIVE" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          <el-button v-hasPermi="['ocsp:responder:save']" type="primary" plain icon="Plus" @click="openEdit()">新建</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="hover">
      <el-table v-loading="loading" :data="rows" border>
        <template #empty>
          <el-empty description="暂无响应者" />
        </template>
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column prop="caId" label="CA ID" width="90" />
        <el-table-column prop="signerType" label="签名类型" width="110" />
        <el-table-column label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="responseValidity" label="有效期(秒)" width="120" />
        <el-table-column label="Nonce" width="90">
          <template #default="{ row }">{{ row.nonceEnabled ? '启用' : '关闭' }}</template>
        </el-table-column>
        <el-table-column prop="updateTime" label="更新时间" min-width="170" />
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openCert(row)">证书</el-button>
            <el-button v-hasPermi="['ocsp:responder:save']" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-hasPermi="['ocsp:responder:status']" link type="warning" @click="toggleStatus(row)">
              {{ row.status === 'ACTIVE' ? '停用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <pagination v-show="total > 0" v-model:page="query.pageNum" v-model:limit="query.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <el-drawer v-model="editVisible" :title="form.id ? '编辑响应者' : '新建响应者'" size="680px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="140px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="CA ID" prop="caId">
          <el-input-number v-model="form.caId" :min="1" controls-position="right" class="w-full" />
        </el-form-item>
        <el-form-item label="签名者类型" prop="signerType">
          <el-segmented v-model="form.signerType" :options="['SOFTWARE', 'HSM']" />
        </el-form-item>
        <el-form-item label="响应有效期(秒)" prop="responseValidity">
          <el-input-number v-model="form.responseValidity" :min="60" :step="60" controls-position="right" class="w-full" />
        </el-form-item>
        <el-form-item label="响应选项">
          <el-checkbox v-model="form.includeCerts">包含证书链</el-checkbox>
          <el-checkbox v-model="form.nonceEnabled">启用 Nonce</el-checkbox>
        </el-form-item>
        <el-form-item label="签名配置" prop="signerConf">
          <el-input
            v-model="form.signerConf"
            type="textarea"
            :rows="5"
            placeholder='{"keyAlias":"ocsp-responder-key","algorithm":"SM3withSM2","keyStoreRef":"ocsp-db"}'
          />
        </el-form-item>
        <ResponderCsrPanel
          :name="form.name"
          :signer-type="form.signerType"
          v-model:signer-cert="form.signerCert"
          v-model:signer-conf="form.signerConf"
          v-model:cert-source="certSource"
        />
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-drawer>

    <el-drawer v-model="certVisible" title="响应者证书" size="520px">
      <X509Cert v-if="certVisible && certPem" :certPem="certPem" />
    </el-drawer>
  </div>
</template>

<script setup name="OcspResponder" lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import X509Cert from '@/components/X509Cert/index.vue';
import ResponderCsrPanel from '@/views/ocsp/components/ResponderCsrPanel.vue';
import { assertSafeSignerCert, assertSafeSignerConf } from '@/api/ocsp/common';
import { createOcspResponder, getOcspResponder, pageOcspResponders, updateOcspResponder, updateOcspResponderStatus } from '@/api/ocsp/responder';
import type { OcspResponder } from '@/api/ocsp/types';

const route = useRoute();
const loading = ref(false);
const saving = ref(false);
const rows = ref<OcspResponder[]>([]);
const total = ref(0);
const editVisible = ref(false);
const certVisible = ref(false);
const certPem = ref('');
const formRef = ref<FormInstance>();
const certSource = ref<'CSR' | 'PEM'>('CSR');
const softwareSignerConf =
  '{\n  "keyAlias": "ocsp-responder-key",\n  "algorithm": "SM3withSM2",\n  "keyStoreRef": "ocsp-db"\n}';
const query = reactive({ pageNum: 1, pageSize: 10, name: '', status: '' });
const form = reactive<OcspResponder>({
  name: '',
  caId: 1,
  signerType: 'SOFTWARE',
  signerConf: softwareSignerConf,
  signerCert: '',
  responseValidity: 3600,
  includeCerts: true,
  nonceEnabled: true
});

const rules: FormRules = {
  name: [{ required: true, message: '请输入响应者名称', trigger: 'blur' }],
  caId: [{ required: true, message: '请输入 CA ID', trigger: 'change' }],
  signerType: [{ required: true, message: '请选择签名者类型', trigger: 'change' }],
  signerConf: [{ required: true, message: '请输入签名配置', trigger: 'blur' }],
  signerCert: [
    {
      validator: (_rule, value, callback) => {
        if (certSource.value === 'CSR' && !String(value || '').trim()) {
          callback();
          return;
        }
        try {
          assertSafeSignerCert(value);
          callback();
        } catch (error: any) {
          callback(new Error(error.message || '请粘贴签名证书 PEM'));
        }
      },
      trigger: 'blur'
    }
  ]
};

const getList = async () => {
  loading.value = true;
  try {
    const page = await pageOcspResponders(query);
    rows.value = page?.records || [];
    total.value = page?.total || 0;
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  query.pageNum = 1;
  getList();
};

const resetQuery = () => {
  query.name = '';
  query.status = '';
  handleQuery();
};

const openEdit = async (row?: OcspResponder) => {
  if (row?.id) {
    const detail = await getOcspResponder(row.id);
    Object.assign(form, detail);
    certSource.value = detail.signerType === 'HSM' || detail.signerCert ? 'PEM' : 'CSR';
  } else {
    Object.assign(form, {
      id: undefined,
      name: '',
      caId: 1,
      signerType: 'SOFTWARE',
      signerConf: softwareSignerConf,
      signerCert: '',
      responseValidity: 3600,
      includeCerts: true,
      nonceEnabled: true
    });
    certSource.value = 'CSR';
  }
  editVisible.value = true;
};

const openCert = (row: OcspResponder) => {
  certPem.value = row.signerCert || '';
  certVisible.value = true;
};

const submit = async () => {
  if (certSource.value === 'CSR' && !String(form.signerCert || '').trim()) {
    ElMessage.error('请先导入 CA 签发的响应者证书');
    return;
  }
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }
  try {
    form.signerConf = assertSafeSignerConf(form.signerConf || '');
    form.signerCert = assertSafeSignerCert(form.signerCert || '');
  } catch (error: any) {
    ElMessage.error(error.message || '签名配置不合法');
    return;
  }
  saving.value = true;
  try {
    if (form.id) {
      await updateOcspResponder(form.id, form);
    } else {
      await createOcspResponder(form);
    }
    ElMessage.success('保存成功');
    editVisible.value = false;
    await getList();
  } finally {
    saving.value = false;
  }
};

const toggleStatus = async (row: OcspResponder) => {
  const next = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  if (next === 'INACTIVE') {
    await ElMessageBox.confirm(`确认停用响应者「${row.name}」？至少一个 ACTIVE 响应者必须保留。`, '停用确认', {
      type: 'warning'
    });
  }
  await updateOcspResponderStatus(row.id!, next);
  ElMessage.success(next === 'ACTIVE' ? '已启用' : '已停用');
  await getList();
};

watch(
  () => form.signerType,
  (type) => {
    if (type === 'HSM') {
      certSource.value = 'PEM';
      return;
    }
    if (!form.signerCert) {
      certSource.value = 'CSR';
      if (!String(form.signerConf || '').includes('ocsp-db')) {
        form.signerConf = softwareSignerConf;
      }
    }
  }
);

onMounted(async () => {
  await getList();
  const id = Number(route.query.id);
  if (id) {
    const target = rows.value.find((item) => item.id === id);
    if (target) {
      await openEdit(target);
    }
  }
});
</script>

<style scoped>
.ocsp-page {
  padding: 16px;
}
.mb16 {
  margin-bottom: 16px;
}
.w-full {
  width: 100%;
}
</style>
