<template>
  <div class="p-2 ra-dept-page">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-[10px]">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="部门名称" prop="name">
              <el-input v-model="queryParams.name" placeholder="请输入部门名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
              <el-button icon="Refresh" @click="resetQuery">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </transition>

    <el-card shadow="hover">
      <template #header>
        <el-row :gutter="10">
          <el-col :span="1.5">
            <el-button v-hasPermi="['sys:dept:save']" type="primary" plain icon="Plus" @click="handleAdd()">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="info" plain icon="Sort" @click="handleToggleExpandAll">展开/折叠</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList" />
        </el-row>
      </template>

      <el-table
        v-if="refreshTable"
        ref="deptTableRef"
        v-loading="loading"
        :data="deptList"
        row-key="id"
        border
        :tree-props="{ children: 'children' }"
        :default-expand-all="isExpandAll"
      >
        <el-table-column prop="name" label="部门名称" width="220" show-overflow-tooltip />
        <el-table-column prop="sort" align="center" label="排序" width="90" />
        <el-table-column label="创建时间" align="center" prop="createTime" width="180">
          <template #default="{ row }">
            <span>{{ proxy?.parseTime(row.createTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column fixed="right" align="center" label="操作" width="150">
          <template #default="{ row }">
            <el-tooltip content="修改" placement="top">
              <el-button v-hasPermi="['sys:dept:modify']" link type="primary" icon="Edit" @click="handleUpdate(row)" />
            </el-tooltip>
            <el-tooltip content="新增下级" placement="top">
              <el-button v-hasPermi="['sys:dept:save']" link type="primary" icon="Plus" @click="handleAdd(row)" />
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button v-hasPermi="['sys:dept:remove']" link type="primary" icon="Delete" @click="handleDelete(row)" />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog.visible" :title="dialog.title" destroy-on-close append-to-body width="560px">
      <el-form ref="deptFormRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="上级部门" prop="pid">
          <el-tree-select
            v-model="form.pid"
            :data="deptOptions"
            :props="{ value: 'id', label: 'name', children: 'children' } as any"
            value-key="id"
            placeholder="请选择上级部门"
            check-strictly
          />
        </el-form-item>
        <el-form-item label="部门名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入部门名称" maxlength="64" />
        </el-form-item>
        <el-form-item label="显示排序" prop="sort">
          <el-input-number v-model="form.sort" controls-position="right" :min="1" :max="9999" />
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

<script setup name="RaDept" lang="ts">
import { getDept, listDeptSelectTree, listDeptTree, modifyDept, removeDept, saveDept } from '@/api/ra/dept';
import { RaDeptForm, RaDeptQuery, RaDeptTreeOption, RaDeptVO } from '@/api/ra/dept/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const deptList = ref<RaDeptVO[]>([]);
const deptOptions = ref<RaDeptTreeOption[]>([]);
const loading = ref(false);
const showSearch = ref(true);
const isExpandAll = ref(true);
const refreshTable = ref(true);

const dialog = reactive<DialogOption>({
  visible: false,
  title: ''
});

const deptTableRef = ref<ElTableInstance>();
const queryFormRef = ref<ElFormInstance>();
const deptFormRef = ref<ElFormInstance>();

const initFormData: RaDeptForm = {
  id: undefined,
  pid: undefined,
  name: undefined,
  sort: 1
};

const data = reactive<PageData<RaDeptForm, RaDeptQuery>>({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 100,
    name: undefined
  },
  rules: {
    pid: [{ required: true, message: '上级部门不能为空', trigger: 'change' }],
    name: [{ required: true, message: '部门名称不能为空', trigger: 'blur' }],
    sort: [{ required: true, message: '显示排序不能为空', trigger: 'blur' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

const unwrapData = <T,>(res: any, fallback: T): T => {
  return (res?.data ?? fallback) as T;
};

const normalizeTree = <T extends RaDeptVO | RaDeptTreeOption>(list?: T[]): T[] => {
  return (list || []).map((item) => {
    const children = normalizeTree((item.children || []) as T[]);
    return {
      ...item,
      children: children.length > 0 ? children : undefined
    };
  });
};

const filterDeptTree = (list: RaDeptTreeOption[], excludeId?: number | string): RaDeptTreeOption[] => {
  return list
    .filter((item) => String(item.id) !== String(excludeId))
    .map((item) => ({
      ...item,
      children: item.children ? filterDeptTree(item.children, excludeId) : undefined
    }));
};

const getFirstDeptId = (list: RaDeptTreeOption[]): number | string | undefined => {
  return list[0]?.id;
};

const getList = async () => {
  loading.value = true;
  try {
    const res = await listDeptTree({ name: queryParams.value.name });
    deptList.value = normalizeTree(unwrapData<RaDeptVO[]>(res, []));
  } finally {
    loading.value = false;
  }
};

const loadDeptOptions = async (excludeId?: number | string) => {
  const res = await listDeptSelectTree();
  const options = filterDeptTree(normalizeTree(unwrapData<RaDeptTreeOption[]>(res, [])), excludeId);
  deptOptions.value = options;
  return getFirstDeptId(options);
};

const cancel = () => {
  reset();
  dialog.visible = false;
};

const reset = () => {
  form.value = { ...initFormData };
  deptFormRef.value?.resetFields();
};

const handleQuery = () => {
  getList();
};

const resetQuery = () => {
  queryFormRef.value?.resetFields();
  handleQuery();
};

const handleAdd = async (row?: RaDeptVO) => {
  reset();
  const defaultDeptId = await loadDeptOptions();
  form.value.pid = row?.id ?? defaultDeptId;
  if (!form.value.pid) {
    proxy?.$modal.msgWarning('当前账号未绑定可管理部门');
    return;
  }
  dialog.visible = true;
  dialog.title = '新增下级部门';
};

const handleUpdate = async (row: RaDeptVO) => {
  reset();
  await loadDeptOptions(row.id);
  const res = await getDept(row.id as number | string);
  const detail = unwrapData<RaDeptVO>(res, row);
  form.value = {
    id: detail.id,
    pid: detail.pid,
    name: detail.name,
    sort: detail.sort ?? 1
  };
  dialog.visible = true;
  dialog.title = '修改部门';
};

const submitForm = () => {
  deptFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) {
      return;
    }
    const payload: RaDeptForm = {
      id: form.value.id,
      pid: form.value.pid,
      name: form.value.name,
      sort: form.value.sort ?? 1
    };
    if (payload.id) {
      await modifyDept(payload);
      proxy?.$modal.msgSuccess('修改成功');
    } else {
      await saveDept(payload);
      proxy?.$modal.msgSuccess('新增成功');
    }
    dialog.visible = false;
    await getList();
  });
};

const handleDelete = async (row: RaDeptVO) => {
  await proxy?.$modal.confirm(`是否确认删除部门"${row.name}"？`);
  await removeDept([row.id as number | string]);
  proxy?.$modal.msgSuccess('删除成功');
  await getList();
};

const handleToggleExpandAll = () => {
  refreshTable.value = false;
  isExpandAll.value = !isExpandAll.value;
  nextTick(() => {
    refreshTable.value = true;
  });
};

onMounted(() => {
  getList();
});
</script>
