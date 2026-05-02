<template>
  <div class="p-2">
    <el-card shadow="never" class="mb-3">
      <el-form :model="queryParams" ref="queryFormRef" :inline="true">
        <el-form-item label="CA名称" prop="name">
          <el-input v-model="queryParams.name" clearable @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-input v-model="queryParams.type" clearable @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="queryParams.status" clearable style="width: 140px">
            <el-option label="启用" value="1" />
            <el-option label="停用" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>CA 接入配置</span>
          <el-button type="primary" plain icon="Plus" v-hasPermi="['sys:ca:save']" @click="handleAdd">新增</el-button>
        </div>
      </template>
      <el-table v-loading="loading" :data="rows" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="CA名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="140" />
        <el-table-column label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="String(row.status) === '1' || row.status === 'ENABLED' ? 'success' : 'info'">
              {{ String(row.status) === '1' || row.status === 'ENABLED' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="220" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" icon="Edit" v-hasPermi="['sys:ca:modify']" @click="handleUpdate(row)">修改</el-button>
            <el-button link type="danger" icon="Delete" v-hasPermi="['sys:ca:remove']" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />
    </el-card>

    <el-dialog v-model="dialog.visible" :title="dialog.title" width="560px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="CA名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-input v-model="form.type" placeholder="ROOT / SUB / EXTERNAL" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio value="1">启用</el-radio>
            <el-radio value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="KmcCaPolicy" lang="ts">
import { getCurrentInstance, onMounted, reactive, ref } from 'vue';
import type { ComponentInternalInstance } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { addKmcCa, delKmcCa, getKmcCa, listKmcCa, updateKmcCa } from '@/api/kmc/ca';
import type { KmcCaForm, KmcCaQuery, KmcCaVO } from '@/api/kmc/ca/types';
import { readKmcPage, unwrapKmcData } from '@/api/kmc/common';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const queryFormRef = ref<FormInstance>();
const formRef = ref<FormInstance>();
const loading = ref(false);
const rows = ref<KmcCaVO[]>([]);
const total = ref(0);

const queryParams = reactive<KmcCaQuery>({
  pageNum: 1,
  pageSize: 10
});
const form = reactive<KmcCaForm>({
  name: '',
  type: '',
  status: '1',
  description: ''
});
const dialog = reactive({ visible: false, title: '' });
const rules = reactive<FormRules>({
  name: [{ required: true, message: '请输入CA名称', trigger: 'blur' }]
});

const resetForm = () => {
  Object.assign(form, { id: undefined, name: '', type: '', status: '1', description: '' });
  proxy?.resetForm('formRef');
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

const handleAdd = () => {
  resetForm();
  dialog.title = '新增CA配置';
  dialog.visible = true;
};

const handleUpdate = async (row: KmcCaVO) => {
  resetForm();
  Object.assign(form, unwrapKmcData(await getKmcCa(row.id)));
  dialog.title = '修改CA配置';
  dialog.visible = true;
};

const submitForm = async () => {
  if (!(await formRef.value?.validate().catch(() => false))) {
    return;
  }
  if (form.id) {
    await updateKmcCa(form);
  } else {
    await addKmcCa(form);
  }
  ElMessage.success('保存成功');
  dialog.visible = false;
  await getList();
};

const handleDelete = async (row: KmcCaVO) => {
  await ElMessageBox.confirm('确认删除该CA配置？', '提示', { type: 'warning' });
  await delKmcCa(row.id);
  ElMessage.success('删除成功');
  await getList();
};

onMounted(getList);
</script>

<style scoped lang="scss">
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>

