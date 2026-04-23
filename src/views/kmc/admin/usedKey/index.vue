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
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['kmc:usedKey:add']">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()" v-hasPermi="['kmc:usedKey:edit']">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()" v-hasPermi="['kmc:usedKey:remove']">删除</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-row>

    <el-table v-loading="loading" :data="usedKeyList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="ID" align="center" prop="id" width="80" />
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
          <el-tooltip content="修改" placement="top">
            <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['kmc:usedKey:edit']" />
          </el-tooltip>
          <el-tooltip content="删除" placement="top">
            <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['kmc:usedKey:remove']" />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 添加或修改在用密钥对话框 -->
    <el-dialog :title="dialog.title" v-model="dialog.visible" width="600px" append-to-body>
      <el-form ref="usedKeyFormRef" :model="form" :rules="rules" label-width="100px">
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
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" placeholder="状态">
            <el-option label="在用" value="0"></el-option>
            <el-option label="注销" value="1"></el-option>
            <el-option label="冻结" value="2"></el-option>
            <el-option label="过期" value="4"></el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="UsedKey" lang="ts">
import { ref, reactive, toRefs, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { listUsedKey, getUsedKey, delUsedKey, addUsedKey, updateUsedKey } from '@/api/kmc/usedKey/index';
import { UsedKeyVO, UsedKeyQuery, UsedKeyForm } from '@/api/kmc/usedKey/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const usedKeyList = ref<UsedKeyVO[]>([]);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
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
    const responseData = res.data;
    if (responseData && responseData.data) {
      const pageInfo = responseData.data;
      usedKeyList.value = pageInfo.data || pageInfo.records || responseData.data;
      total.value = pageInfo.totalCount || pageInfo.total || 0;
    } else if (res.rows) {
      usedKeyList.value = res.rows;
      total.value = res.total;
    } else {
      usedKeyList.value = responseData as any;
    }
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
  proxy?.resetForm('usedKeyFormRef');
};

const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

const resetQuery = () => {
  proxy?.resetForm('queryFormRef');
  handleQuery();
};

const handleSelectionChange = (selection: UsedKeyVO[]) => {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
};

const handleAdd = () => {
  reset();
  dialog.visible = true;
  dialog.title = '添加在用密钥';
};

const handleUpdate = async (row?: UsedKeyVO) => {
  reset();
  const id = row?.id || ids.value[0];
  const res = await getUsedKey(id);

  if (res.data && res.data.data) {
    Object.assign(form.value, res.data.data);
  } else {
    Object.assign(form.value, res.data);
  }

  dialog.visible = true;
  dialog.title = '修改在用密钥';
};

const submitForm = () => {
  proxy?.$refs['usedKeyFormRef'].validate(async (valid: boolean) => {
    if (valid) {
      if (form.value.id) {
        await updateUsedKey(form.value);
        ElMessage.success('修改成功');
      } else {
        await addUsedKey(form.value);
        ElMessage.success('新增成功');
      }
      dialog.visible = false;
      getList();
    }
  });
};

const handleDelete = async (row?: UsedKeyVO) => {
  const opIds = row?.id ? [row.id] : ids.value;
  try {
    await ElMessageBox.confirm('是否确认删除所选的在用密钥数据项？', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });
    await delUsedKey(opIds);
    getList();
    ElMessage.success('删除成功');
  } catch (error) {}
};

onMounted(() => {
  getList();
});
</script>
