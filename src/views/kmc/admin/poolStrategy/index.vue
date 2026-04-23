<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryFormRef" :inline="true" v-show="showSearch" label-width="100px">
      <el-form-item label="密码算法类型" prop="algType">
        <el-input v-model="queryParams.algType" placeholder="请输入密码算法类型(如SM2)" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="策略状态" clearable style="width: 200px">
          <el-option label="启用" :value="1" />
          <el-option label="停用" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['kmc:strategy:add']">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()" v-hasPermi="['kmc:strategy:edit']">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()" v-hasPermi="['kmc:strategy:remove']">删除</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-row>

    <el-table v-loading="loading" :data="poolStrategyList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="策略ID" align="center" prop="id" width="100" />
      <el-table-column label="算法类型" align="center" prop="algType" />
      <el-table-column label="密钥用途" align="center" prop="keyUsage" />
      <el-table-column label="低水位阈值" align="center" prop="lowWatermark" />
      <el-table-column label="高水位阈值" align="center" prop="highWatermark" />
      <el-table-column label="状态" align="center" prop="status">
        <template #default="scope">
          <el-tag :type="scope.row.status === 1 ? 'success' : 'danger'">
            {{ scope.row.status === 1 ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-tooltip content="修改" placement="top">
            <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['kmc:strategy:edit']" />
          </el-tooltip>
          <el-tooltip content="删除" placement="top">
            <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['kmc:strategy:remove']" />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 添加或修改策略对话框 -->
    <el-dialog :title="dialog.title" v-model="dialog.visible" width="500px" append-to-body>
      <el-form ref="poolStrategyFormRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="密码算法类型" prop="algType">
          <el-input v-model="form.algType" placeholder="请输入密码算法类型 (例如: SM2, RSA2048)" />
        </el-form-item>
        <el-form-item label="密钥用途" prop="keyUsage">
          <el-input v-model="form.keyUsage" placeholder="请输入密钥用途 (如 SIGN, ENCRYPT)" />
        </el-form-item>
        <el-form-item label="低水位阈值" prop="lowWatermark">
          <el-input-number v-model="form.lowWatermark" :min="1" controls-position="right" />
        </el-form-item>
        <el-form-item label="高水位阈值" prop="highWatermark">
          <el-input-number v-model="form.highWatermark" :min="form.lowWatermark || 1" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">停用</el-radio>
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

<script setup name="PoolStrategy" lang="ts">
import { ref, reactive, toRefs, onMounted, getCurrentInstance, ComponentInternalInstance } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { listPoolStrategy, getPoolStrategy, delPoolStrategy, addPoolStrategy, updatePoolStrategy } from '@/api/kmc/poolStrategy/index';
import { PoolStrategyVO, PoolStrategyQuery, PoolStrategyForm } from '@/api/kmc/poolStrategy/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const poolStrategyList = ref<PoolStrategyVO[]>([]);
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

const validateWatermark = (rule: any, value: any, callback: any) => {
  if (form.value.lowWatermark && form.value.highWatermark) {
    if (form.value.highWatermark <= form.value.lowWatermark) {
      callback(new Error('高水位阈值必须大于低水位阈值'));
    } else {
      callback();
    }
  } else {
    callback();
  }
};

const data = reactive<PageData<PoolStrategyForm, PoolStrategyQuery>>({
  form: {
    id: undefined,
    algType: '',
    keyUsage: '',
    lowWatermark: 10,
    highWatermark: 50,
    status: 1
  },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    algType: undefined,
    status: undefined
  },
  rules: {
    algType: [
      { required: true, message: '密码算法类型不能为空', trigger: 'blur' },
      { pattern: /^[A-Za-z0-9]+$/, message: '算法类型格式不正确 (字母或数字)', trigger: 'blur' }
    ],
    keyUsage: [
      { required: true, message: '密钥用途不能为空', trigger: 'blur' },
      { pattern: /^[A-Z_]+$/, message: '用途格式不正确 (大写字母和下划线)', trigger: 'blur' }
    ],
    lowWatermark: [
      { required: true, message: '低水位阈值不能为空', trigger: 'blur' },
      { type: 'number', min: 1, message: '必须是大于0的数字', trigger: 'blur' }
    ],
    highWatermark: [
      { required: true, message: '高水位阈值不能为空', trigger: 'blur' },
      { type: 'number', min: 1, message: '必须是大于0的数字', trigger: 'blur' },
      { validator: validateWatermark, trigger: 'blur' }
    ],
    status: [{ required: true, message: '状态不能为空', trigger: 'change' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询策略列表 */
const getList = async () => {
  loading.value = true;
  try {
    const res = await listPoolStrategy(queryParams.value);
    // RuoYi-Vue-Plus backend format: res.data.rows or res.data.data depends on how Page is serialized
    // Typically Result.buildSuccess(Page<...>) means standard nested data shape.
    const responseData = res.data;
    if (responseData && responseData.data) {
      // In liuzx framework it is usually res.data.data.data or res.data.data.records
      const pageInfo = responseData.data;
      poolStrategyList.value = pageInfo.data || pageInfo.records || responseData.data;
      total.value = pageInfo.totalCount || pageInfo.total || 0;
    } else if (res.rows) {
      poolStrategyList.value = res.rows;
      total.value = res.total;
    } else {
      // Fallback
      poolStrategyList.value = responseData as any;
    }
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

/** 取消按钮 */
const cancel = () => {
  dialog.visible = false;
  reset();
};

/** 表单重置 */
const reset = () => {
  form.value = {
    id: undefined,
    algType: '',
    keyUsage: '',
    lowWatermark: 10,
    highWatermark: 50,
    status: 1
  };
  proxy?.resetForm('poolStrategyFormRef');
};

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

/** 重置按钮操作 */
const resetQuery = () => {
  proxy?.resetForm('queryFormRef');
  handleQuery();
};

/** 多选框选中数据 */
const handleSelectionChange = (selection: PoolStrategyVO[]) => {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
};

/** 新增按钮操作 */
const handleAdd = () => {
  reset();
  dialog.visible = true;
  dialog.title = '添加备用密钥池策略';
};

/** 修改按钮操作 */
const handleUpdate = async (row?: PoolStrategyVO) => {
  reset();
  const id = row?.id || ids.value[0];
  const res = await getPoolStrategy(id);

  if (res.data && res.data.data) {
    Object.assign(form.value, res.data.data);
  } else {
    Object.assign(form.value, res.data);
  }

  dialog.visible = true;
  dialog.title = '修改备用密钥池策略';
};

/** 提交按钮 */
const submitForm = () => {
  proxy?.$refs['poolStrategyFormRef'].validate(async (valid: boolean) => {
    if (valid) {
      if (form.value.id) {
        await updatePoolStrategy(form.value);
        ElMessage.success('修改成功');
      } else {
        await addPoolStrategy(form.value);
        ElMessage.success('新增成功');
      }
      dialog.visible = false;
      getList();
    }
  });
};

/** 删除按钮操作 */
const handleDelete = async (row?: PoolStrategyVO) => {
  const strategyIds = row?.id ? [row.id] : ids.value;
  try {
    await ElMessageBox.confirm('是否确认删除所选的备用密钥池策略数据项？', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });
    await delPoolStrategy(strategyIds);
    getList();
    ElMessage.success('删除成功');
  } catch (error) {
    // catch cancel
  }
};

onMounted(() => {
  getList();
});
</script>
