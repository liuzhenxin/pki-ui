<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryFormRef" :inline="true" v-show="showSearch" label-width="100px">
      <el-form-item label="证书序列号" prop="serialNumber">
        <el-input v-model="queryParams.serialNumber" placeholder="请输入凭证序列号" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="证书主题" prop="subject">
        <el-input v-model="queryParams.subject" placeholder="请输入证书主题" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['kmc:archivekey:save']">新增</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-row>

    <el-table v-loading="loading" :data="archiveKeyList">
      <el-table-column label="ID" align="center" prop="id" width="80" />
      <el-table-column label="证书序列号" align="center" prop="serialNumber" show-overflow-tooltip />
      <el-table-column label="证书主题" align="center" prop="subject" show-overflow-tooltip />
      <el-table-column label="密钥类型" align="center" prop="keyType" />
      <el-table-column label="归档时间" align="center" prop="archiveTime" width="160">
        <template #default="scope">
          <span>{{ scope.row.archiveTime }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="116">
        <template #default="scope">
          <el-button link type="primary" icon="Key" @click="handleRecovery(scope.row)" v-hasPermi="['kmc:keyrecovery:submit']"> 密钥恢复 </el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 添加归档密钥对话框 -->
    <el-dialog :title="dialog.title" v-model="dialog.visible" width="600px" append-to-body>
      <el-form ref="archiveKeyFormRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="CA机构ID" prop="caId">
          <el-input v-model="form.caId" placeholder="请输入CA机构ID" />
        </el-form-item>
        <el-form-item label="密钥类型" prop="keyType">
          <el-input v-model="form.keyType" placeholder="请输入密钥类型 (如 SM2)" />
        </el-form-item>
        <el-form-item label="密钥位长" prop="keyBits">
          <el-input-number v-model="form.keyBits" :min="1" controls-position="right" />
        </el-form-item>
        <el-form-item label="证书序列号" prop="serialNumber">
          <el-input v-model="form.serialNumber" placeholder="请输入序列号" />
        </el-form-item>
        <el-form-item label="证书主题" prop="subject">
          <el-input v-model="form.subject" placeholder="请输入证书主题" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <KeyRecoveryDialog ref="keyRecoveryDialogRef" />
  </div>
</template>

<script setup name="ArchiveKey" lang="ts">
import { ref, reactive, toRefs, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import type { FormInstance } from 'element-plus';
import { listArchiveKey, addArchiveKey } from '@/api/kmc/archiveKey/index';
import { ArchiveKeyVO, ArchiveKeyQuery, ArchiveKeyForm } from '@/api/kmc/archiveKey/types';
import { readKmcPage } from '@/api/kmc/common';
import KeyRecoveryDialog from '@/views/kmc/components/KeyRecoveryDialog.vue';

const queryFormRef = ref<FormInstance>();
const archiveKeyFormRef = ref<FormInstance>();
const keyRecoveryDialogRef = ref<InstanceType<typeof KeyRecoveryDialog>>();
const archiveKeyList = ref<ArchiveKeyVO[]>([]);
const loading = ref(true);
const showSearch = ref(true);
const total = ref(0);

const dialog = reactive<DialogOption>({
  visible: false,
  title: ''
});

const data = reactive<PageData<ArchiveKeyForm, ArchiveKeyQuery>>({
  form: {
    id: undefined,
    caId: undefined,
    keyType: '',
    keyBits: 256,
    serialNumber: '',
    subject: ''
  },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    keyType: undefined,
    serialNumber: undefined,
    subject: undefined
  },
  rules: {
    keyType: [{ required: true, message: '密钥类型不能为空', trigger: 'blur' }],
    serialNumber: [{ required: true, message: '证书序列号不能为空', trigger: 'blur' }],
    subject: [{ required: true, message: '证书主题不能为空', trigger: 'blur' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

const getList = async () => {
  loading.value = true;
  try {
    const res = await listArchiveKey(queryParams.value);
    const page = readKmcPage<ArchiveKeyVO>(res);
    archiveKeyList.value = page.records;
    total.value = page.total;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const cancel = () => {
  dialog.visible = false;
  reset();
};

const reset = () => {
  form.value = {
    id: undefined,
    caId: undefined,
    keyType: '',
    keyBits: 256,
    serialNumber: '',
    subject: ''
  };
  archiveKeyFormRef.value?.resetFields();
};

const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryFormRef.value?.resetFields();
  handleQuery();
};

const handleAdd = () => {
  reset();
  dialog.visible = true;
  dialog.title = '添加归档密钥';
};

const handleRecovery = (row: ArchiveKeyVO) => {
  keyRecoveryDialogRef.value?.open({
    targetType: 'ARCHIVE_KEY',
    targetId: row.id,
    serialNumber: row.serialNumber,
    subject: row.subject,
    archiveSummary: {
      time: row.archiveTime,
      algorithm: row.keyType,
      bits: row.keyBits
    }
  });
};

const submitForm = () => {
  archiveKeyFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      await addArchiveKey(form.value);
      ElMessage.success('新增成功');
      dialog.visible = false;
      getList();
    }
  });
};

onMounted(() => {
  getList();
});
</script>
