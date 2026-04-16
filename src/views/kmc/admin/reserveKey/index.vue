<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryFormRef" :inline="true" v-show="showSearch" label-width="100px">
      <el-form-item label="密钥类型" prop="keyType">
        <el-input
          v-model="queryParams.keyType"
          placeholder="请输入密钥类型"
          clearable
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="状态" prop="keyStatus">
        <el-select v-model="queryParams.keyStatus" placeholder="分配状态" clearable style="width: 200px">
          <el-option label="已分配" :value="1" />
          <el-option label="空闲" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()">删除</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-row>

    <el-table v-loading="loading" :data="reserveKeyList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="ID" align="center" prop="id" width="80" />
      <el-table-column label="策略ID" align="center" prop="strategyId" />
      <el-table-column label="密钥类型" align="center" prop="keyType" />
      <el-table-column label="密钥位长" align="center" prop="keyBits" />
      <el-table-column label="分配状态" align="center" prop="keyStatus">
        <template #default="scope">
          <el-tag :type="scope.row.keyStatus === 1 ? 'danger' : 'success'">
            {{ scope.row.keyStatus === 1 ? '已分配' : '空闲' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-tooltip content="修改" placement="top">
            <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" />
          </el-tooltip>
          <el-tooltip content="删除" placement="top">
            <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <pagination
      v-show="total > 0"
      :total="total"
      v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />

    <!-- 添加或修改备用密钥对话框 -->
    <el-dialog :title="dialog.title" v-model="dialog.visible" width="500px" append-to-body>
      <el-form ref="reserveKeyFormRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="策略ID" prop="strategyId">
          <el-input v-model="form.strategyId" placeholder="请输入策略ID" />
        </el-form-item>
        <el-form-item label="密钥类型" prop="keyType">
          <el-input v-model="form.keyType" placeholder="请输入密钥类型 (如 SM2)" />
        </el-form-item>
        <el-form-item label="密钥位长" prop="keyBits">
          <el-input-number v-model="form.keyBits" :min="1" controls-position="right" />
        </el-form-item>
        <el-form-item label="分配状态" prop="keyStatus">
          <el-radio-group v-model="form.keyStatus">
            <el-radio :value="0">空闲</el-radio>
            <el-radio :value="1">已分配</el-radio>
          </el-radio-group>
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

<script setup name="ReserveKey" lang="ts">
import { ref, reactive, toRefs, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  listReserveKey,
  getReserveKey,
  delReserveKey,
  addReserveKey,
  updateReserveKey
} from '@/api/kmc/reserveKey/index';
import { ReserveKeyVO, ReserveKeyQuery, ReserveKeyForm } from '@/api/kmc/reserveKey/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const reserveKeyList = ref<ReserveKeyVO[]>([]);
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

const data = reactive<PageData<ReserveKeyForm, ReserveKeyQuery>>({
  form: {
    id: undefined,
    strategyId: undefined,
    keyType: '',
    keyBits: 256,
    keyStatus: 0
  },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    keyType: undefined,
    keyStatus: undefined
  },
  rules: {
    keyType: [{ required: true, message: '密钥类型不能为空', trigger: 'blur' }],
    keyBits: [{ required: true, message: '密钥位长不能为空', trigger: 'blur' }],
    keyStatus: [{ required: true, message: '状态不能为空', trigger: 'change' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询列表 */
const getList = async () => {
  loading.value = true;
  try {
    const res = await listReserveKey(queryParams.value);
    let responseData = res.data;
    if (responseData && responseData.data) {
      const pageInfo = responseData.data;
      reserveKeyList.value = pageInfo.data || pageInfo.records || responseData.data;
      total.value = pageInfo.totalCount || pageInfo.total || 0;
    } else if (res.rows) {
      reserveKeyList.value = res.rows;
      total.value = res.total;
    } else {
        reserveKeyList.value = responseData as any;
    }
  } catch(e) {
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
    strategyId: undefined,
    keyType: '',
    keyBits: 256,
    keyStatus: 0
  };
  proxy?.resetForm('reserveKeyFormRef');
};

const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

const resetQuery = () => {
  proxy?.resetForm('queryFormRef');
  handleQuery();
};

const handleSelectionChange = (selection: ReserveKeyVO[]) => {
  ids.value = selection.map(item => item.id);
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
};

const handleAdd = () => {
  reset();
  dialog.visible = true;
  dialog.title = '添加备用密钥';
};

const handleUpdate = async (row?: ReserveKeyVO) => {
  reset();
  const id = row?.id || ids.value[0];
  const res = await getReserveKey(id);
  
  if (res.data && res.data.data) {
      Object.assign(form.value, res.data.data);
  } else {
      Object.assign(form.value, res.data);
  }
  
  dialog.visible = true;
  dialog.title = '修改备用密钥';
};

const submitForm = () => {
  proxy?.$refs['reserveKeyFormRef'].validate(async (valid: boolean) => {
    if (valid) {
      if (form.value.id) {
        await updateReserveKey(form.value);
        ElMessage.success('修改成功');
      } else {
        await addReserveKey(form.value);
        ElMessage.success('新增成功');
      }
      dialog.visible = false;
      getList();
    }
  });
};

const handleDelete = async (row?: ReserveKeyVO) => {
  const opIds = row?.id ? [row.id] : ids.value;
  try {
    await ElMessageBox.confirm('是否确认删除所选的备用密钥数据项？', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });
    await delReserveKey(opIds);
    getList();
    ElMessage.success('删除成功');
  } catch (error) {}
};

onMounted(() => {
  getList();
});
</script>
