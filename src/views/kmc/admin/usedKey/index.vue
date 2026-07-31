<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryFormRef" :inline="true" v-show="showSearch" label-width="100px">
      <el-form-item label="证书序列号" prop="serialNumber">
        <el-input v-model="queryParams.serialNumber" placeholder="请输入凭证序列号" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="证书主题" prop="subject">
        <el-input v-model="queryParams.subject" placeholder="请输入证书主题" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="密钥状态" clearable style="width: 150px">
          <el-option label="在用" value="0" />
          <el-option label="注销" value="1" />
          <el-option label="冻结" value="2" />
          <el-option label="过期" value="4" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-row>

    <el-table v-loading="loading" :data="usedKeyList">
      <el-table-column label="证书序列号" align="center" prop="serialNumber" show-overflow-tooltip />
      <el-table-column label="证书主题" align="center" prop="subject" show-overflow-tooltip />
      <el-table-column label="密钥类型" align="center" prop="keyType" />
      <el-table-column label="到期时间" align="center" prop="expirTime" width="160">
        <template #default="scope">
          <span>{{ scope.row.expirTime }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status">
        <template #default="scope">
          <el-tag v-if="scope.row.status === '0'" type="success">在用</el-tag>
          <el-tag v-else-if="scope.row.status === '1'" type="info">注销</el-tag>
          <el-tag v-else-if="scope.row.status === '2'" type="warning">冻结</el-tag>
          <el-tag v-else-if="scope.row.status === '4'" type="danger">过期</el-tag>
          <el-tag v-else type="info">未知</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-tooltip content="详情" placement="top">
            <el-button link type="primary" icon="View" @click="handleDetail(scope.row)" v-hasPermi="['kmc:usedkey:detail']" />
          </el-tooltip>
          <el-tooltip content="密钥恢复" placement="top">
            <el-button link type="primary" icon="Key" @click="handleRecovery(scope.row)" v-hasPermi="['kmc:keyrecovery:submit']" />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 在用密钥详情对话框 -->
    <el-dialog :title="dialog.title" v-model="dialog.visible" width="600px" append-to-body>
      <el-form ref="usedKeyFormRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="CA机构ID" prop="caId">
          <el-input v-model="form.caId" disabled />
        </el-form-item>
        <el-form-item label="密钥类型" prop="keyType">
          <el-input v-model="form.keyType" disabled />
        </el-form-item>
        <el-form-item label="密钥位长" prop="keyBits">
          <el-input-number v-model="form.keyBits" :min="1" controls-position="right" disabled />
        </el-form-item>
        <el-form-item label="证书序列号" prop="serialNumber">
          <el-input v-model="form.serialNumber" disabled />
        </el-form-item>
        <el-form-item label="证书主题" prop="subject">
          <el-input v-model="form.subject" disabled />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" disabled>
            <el-option label="在用" value="0"></el-option>
            <el-option label="注销" value="1"></el-option>
            <el-option label="冻结" value="2"></el-option>
            <el-option label="过期" value="4"></el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="cancel">关 闭</el-button>
        </div>
      </template>
    </el-dialog>

    <KeyRecoveryDialog ref="keyRecoveryDialogRef" />
  </div>
</template>

<script setup name="UsedKey" lang="ts">
import { ref, reactive, toRefs, onMounted } from 'vue';
import type { FormInstance } from 'element-plus';
import { listUsedKey, getUsedKey } from '@/api/kmc/usedKey/index';
import { UsedKeyVO, UsedKeyQuery, UsedKeyForm } from '@/api/kmc/usedKey/types';
import { readKmcPage, unwrapKmcData } from '@/api/kmc/common';
import KeyRecoveryDialog from '@/views/kmc/components/KeyRecoveryDialog.vue';

const queryFormRef = ref<FormInstance>();
const usedKeyFormRef = ref<FormInstance>();
const keyRecoveryDialogRef = ref<InstanceType<typeof KeyRecoveryDialog>>();
const usedKeyList = ref<UsedKeyVO[]>([]);
const loading = ref(true);
const showSearch = ref(true);
const total = ref(0);

const dialog = reactive<DialogOption>({
  visible: false,
  title: ''
});

const data = reactive<PageData<UsedKeyForm, UsedKeyQuery>>({
  form: {
    id: undefined,
    caId: undefined,
    keyType: '',
    keyBits: 256,
    serialNumber: '',
    subject: '',
    status: '0'
  },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    keyType: undefined,
    serialNumber: undefined,
    subject: undefined,
    status: undefined
  },
  rules: {
    keyType: [{ required: true, message: '密钥类型不能为空', trigger: 'blur' }],
    status: [{ required: true, message: '状态不能为空', trigger: 'change' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

const getList = async () => {
  loading.value = true;
  try {
    const res = await listUsedKey(queryParams.value);
    const page = readKmcPage<UsedKeyVO>(res);
    usedKeyList.value = page.records;
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
    subject: '',
    status: '0'
  };
  usedKeyFormRef.value?.resetFields();
};

const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryFormRef.value?.resetFields();
  handleQuery();
};

const handleDetail = async (row: UsedKeyVO) => {
  reset();
  const res = await getUsedKey(row.id);

  Object.assign(form.value, unwrapKmcData(res));

  dialog.visible = true;
  dialog.title = '在用密钥详情';
};

const handleRecovery = (row: UsedKeyVO) => {
  keyRecoveryDialogRef.value?.open({
    targetType: 'USED_KEY',
    targetId: row.id,
    serialNumber: row.serialNumber,
    subject: row.subject,
    keyType: (row as any).keyType,
    keyBits: (row as any).keyBits
  });
};

onMounted(() => {
  getList();
});
</script>
