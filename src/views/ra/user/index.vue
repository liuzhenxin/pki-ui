<template>
  <div class="app-container ra-user-page">
    <el-row :gutter="16">
      <el-col :xs="24" :sm="24" :md="6" :lg="5" :xl="4">
        <el-card shadow="never" class="dept-tree-card">
          <template #header>
            <div class="dept-tree-title">部门</div>
          </template>
          <el-input v-model="deptName" placeholder="请输入部门名称" prefix-icon="Search" clearable />
          <el-tree
            ref="deptTreeRef"
            class="dept-tree"
            node-key="id"
            :data="deptTreeOptions"
            :props="deptTreeProps"
            :expand-on-click-node="false"
            :filter-node-method="filterDeptNode"
            highlight-current
            default-expand-all
            @node-click="handleDeptNodeClick"
          />
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="24" :md="18" :lg="19" :xl="20">
        <el-form ref="queryFormRef" v-show="showSearch" :model="queryParams" :inline="true" label-width="68px">
          <el-form-item label="用户名称" prop="username">
            <el-input v-model="queryParams.username" placeholder="请输入用户名称" clearable style="width: 220px" @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item label="手机号码" prop="mobile">
            <el-input v-model="queryParams.mobile" placeholder="请输入手机号码" clearable style="width: 220px" @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item label="用户类别" prop="userCategory">
            <el-select v-model="queryParams.userCategory" placeholder="请选择类别" clearable style="width: 160px">
              <el-option v-for="item in userCategoryOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态" prop="status">
            <el-select v-model="queryParams.status" placeholder="用户状态" clearable style="width: 180px">
              <el-option v-for="dict in sys_common_status" :key="dict.value" :label="dict.label" :value="dict.value" />
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
            <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate">修改</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete">删除</el-button>
          </el-col>
          <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" :columns="columns"></right-toolbar>
        </el-row>

        <el-table v-loading="loading" :data="userList" @selection-change="handleSelectionChange">
          <el-table-column type="selection" width="50" align="center" />
          <el-table-column label="用户编号" align="center" key="id" prop="id" v-if="columns[0].visible" width="110" />
          <el-table-column label="用户名称" align="center" key="username" prop="username" v-if="columns[1].visible" show-overflow-tooltip />
          <el-table-column label="邮箱" align="center" key="mail" prop="mail" v-if="columns[2].visible" show-overflow-tooltip />
          <el-table-column label="手机号码" align="center" key="mobile" prop="mobile" v-if="columns[3].visible" width="130" />
          <el-table-column label="用户类别" align="center" key="userCategory" v-if="columns[4].visible" width="110">
            <template #default="{ row }">
              <el-tag type="info">{{ userCategoryLabel(row.userCategory) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" align="center" key="status" v-if="columns[5].visible" width="100">
            <template #default="{ row }">
              <el-switch v-model="row.status" :active-value="0" :inactive-value="1" @change="(val) => handleStatusChange(row, val as number)" />
            </template>
          </el-table-column>
          <el-table-column label="创建时间" align="center" prop="createTime" v-if="columns[6].visible" width="160">
            <template #default="{ row }">
              <span>{{ parseTime(row.createTime) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" align="center" width="180" class-name="small-padding fixed-width">
            <template #default="{ row }">
              <el-tooltip content="详情" placement="top">
                <el-button link type="primary" icon="View" @click="handleDetail(row)" />
              </el-tooltip>
              <el-tooltip content="修改" placement="top">
                <el-button link type="primary" icon="Edit" @click="handleUpdate(row)" />
              </el-tooltip>
              <el-tooltip content="删除" placement="top">
                <el-button link type="primary" icon="Delete" @click="handleDelete(row)" />
              </el-tooltip>
              <el-tooltip content="重置密码" placement="top">
                <el-button link type="primary" icon="Key" @click="handleResetPwd(row)" />
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>

        <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />
      </el-col>
    </el-row>

    <el-dialog v-model="open" :title="title" width="600px" append-to-body>
      <el-form ref="userFormRef" :model="form" :rules="rules" label-width="80px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="用户名称" prop="username">
              <el-input v-model="form.username" placeholder="请输入用户名称" maxlength="30" :disabled="form.id !== undefined" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item v-if="form.id === undefined" label="用户密码" prop="password">
              <el-input v-model="form.password" placeholder="请输入用户密码" type="password" maxlength="30" show-password />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="手机号码" prop="mobile">
              <el-input v-model="form.mobile" placeholder="请输入手机号码" maxlength="11" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱" prop="mail">
              <el-input v-model="form.mail" placeholder="请输入邮箱" maxlength="50" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="所属部门" prop="deptId">
              <el-tree-select
                v-model="form.deptId"
                :data="deptOptions"
                :props="{ value: 'id', label: 'name', children: 'children' } as any"
                value-key="id"
                placeholder="请选择所属部门"
                check-strictly
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="用户类别" prop="userCategory">
              <el-select v-model="form.userCategory" placeholder="请选择用户类别" style="width: 100%">
                <el-option v-for="item in userCategoryOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-select v-model="form.status" placeholder="请选择状态" style="width: 100%">
                <el-option v-for="dict in sys_common_status" :key="dict.value" :label="dict.label" :value="Number(dict.value)" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" placeholder="请输入内容" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="detailOpen" title="用户详情" width="520px" append-to-body>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="用户名称">{{ detail.username || '-' }}</el-descriptions-item>
        <el-descriptions-item label="用户类别">{{ userCategoryLabel(detail.userCategory) }}</el-descriptions-item>
        <el-descriptions-item label="手机号码">{{ detail.mobile || '-' }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ detail.mail || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup name="RaUser" lang="ts">
import { listUser, getUser, delUser, updateUser, resetUserPwd, changeStatus, addUser } from '@/api/ra/user';
import { listDeptSelectTree } from '@/api/ra/dept';
import { RaDeptTreeOption } from '@/api/ra/dept/types';
import { UserForm, UserQuery, UserVO } from '@/api/system/user/types';
import { FormInstance } from 'element-plus';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { sys_common_status } = toRefs<any>(proxy!.useDict('sys_common_status'));

const ALL_DEPT_ID = '__ALL__';
const userCategoryOptions = [
  { label: '个人用户', value: 'individual' },
  { label: '企业用户', value: 'organization' },
  { label: '设备用户', value: 'device' }
];

const userList = ref<UserVO[]>([]);
const deptOptions = ref<RaDeptTreeOption[]>([]);
const deptName = ref('');
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<number | string>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const isDataLoaded = ref(false);
const detailOpen = ref(false);
const detail = ref<any>({});

const deptTreeRef = ref<any>();
const queryFormRef = ref<FormInstance>();
const userFormRef = ref<FormInstance>();
const deptTreeProps = { label: 'name', children: 'children' };
const deptTreeOptions = computed<RaDeptTreeOption[]>(() => [
  {
    id: ALL_DEPT_ID,
    name: '全部部门',
    children: deptOptions.value
  }
]);

const columns = ref([
  { key: 0, label: '用户编号', visible: true },
  { key: 1, label: '用户名称', visible: true },
  { key: 2, label: '邮箱', visible: true },
  { key: 3, label: '手机号码', visible: true },
  { key: 4, label: '用户类别', visible: true },
  { key: 5, label: '状态', visible: true },
  { key: 6, label: '创建时间', visible: true }
]);

const data = reactive<{
  form: UserForm;
  queryParams: UserQuery;
  rules: any;
}>({
  form: {} as UserForm,
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    username: undefined,
    mobile: undefined,
    userCategory: undefined,
    status: undefined,
    deptId: undefined,
    superAdmin: 0
  },
  rules: {
    username: [
      { required: true, message: '用户名称不能为空', trigger: 'blur' },
      { min: 2, max: 30, message: '用户名称长度必须介于 2 和 30 之间', trigger: 'blur' }
    ],
    password: [
      { required: true, message: '用户密码不能为空', trigger: 'blur' },
      { min: 6, max: 30, message: '用户密码长度必须介于 6 和 30 之间', trigger: 'blur' }
    ],
    mail: [{ type: 'email', message: '请输入正确的邮箱地址', trigger: ['blur', 'change'] }],
    mobile: [{ pattern: /^1[3|4|5|6|7|8|9][0-9]\d{8}$/, message: '请输入正确的手机号码', trigger: 'blur' }],
    userCategory: [{ required: true, message: '用户类别不能为空', trigger: 'change' }],
    deptId: [{ required: true, message: '所属部门不能为空', trigger: 'change' }],
    status: [{ required: true, message: '状态不能为空', trigger: 'change' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

function parsePage(res: any) {
  const page = res.data || res;
  return {
    rows: page.rows || page.records || [],
    total: page.total || 0
  };
}

function normalizeDeptId(deptId?: string | number | null) {
  return deptId === undefined || deptId === null ? undefined : String(deptId);
}

function normalizeUserForm() {
  form.value.mail = form.value.mail?.trim() || undefined;
  form.value.mobile = form.value.mobile?.trim() || undefined;
  form.value.userCategory = form.value.userCategory || undefined;
  form.value.deptId = normalizeDeptId(form.value.deptId);
  form.value.roleIds = [];
}

function normalizeDeptOptions(list: RaDeptTreeOption[]): RaDeptTreeOption[] {
  return list.map((item) => ({
    ...item,
    id: String(item.id),
    pid: item.pid === undefined ? undefined : String(item.pid),
    children: item.children ? normalizeDeptOptions(item.children) : undefined
  }));
}

async function loadDeptOptions() {
  const res = await listDeptSelectTree({});
  deptOptions.value = normalizeDeptOptions((res.data || []) as RaDeptTreeOption[]);
}

watch(
  deptName,
  (value) => {
    deptTreeRef.value?.filter(value);
  },
  { flush: 'post' }
);

function filterDeptNode(value: string, data: RaDeptTreeOption) {
  if (!value || data.id === ALL_DEPT_ID) {
    return true;
  }
  return data.name?.includes(value);
}

function handleDeptNodeClick(data: RaDeptTreeOption) {
  queryParams.value.deptId = data.id === ALL_DEPT_ID ? undefined : normalizeDeptId(data.id);
  handleQuery();
}

function getList() {
  loading.value = true;
  isDataLoaded.value = false;
  listUser(queryParams.value).then((res) => {
    const page = parsePage(res);
    userList.value = page.rows;
    total.value = page.total;
    loading.value = false;
    nextTick(() => {
      isDataLoaded.value = true;
    });
  });
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryFormRef.value?.resetFields();
  queryParams.value.deptId = undefined;
  queryParams.value.superAdmin = 0;
  deptTreeRef.value?.setCurrentKey(ALL_DEPT_ID);
  handleQuery();
}

function handleSelectionChange(selection: any[]) {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length !== 1;
  multiple.value = selection.length === 0;
}

function reset() {
  form.value = {
    id: undefined,
    deptId: undefined,
    username: '',
    password: '',
    mobile: undefined,
    mail: undefined,
    userCategory: 'individual',
    status: 0,
    remark: undefined,
    postIds: [],
    roleIds: []
  };
  userFormRef.value?.resetFields();
}

function userCategoryLabel(value?: string) {
  return userCategoryOptions.find((item) => item.value === value)?.label || '-';
}

function cancel() {
  open.value = false;
  reset();
}

async function handleAdd() {
  reset();
  await loadDeptOptions();
  if (queryParams.value.deptId) {
    form.value.deptId = normalizeDeptId(queryParams.value.deptId);
  }
  open.value = true;
  title.value = '添加申请用户';
}

async function handleUpdate(row?: any) {
  reset();
  await loadDeptOptions();
  const userId = row?.id || ids.value[0];
  const response = await getUser(userId);
  const userData = response.data as any;
  form.value = {
    ...userData,
    deptId: normalizeDeptId(userData.deptId),
    password: '',
    postIds: [],
    roleIds: []
  };
  open.value = true;
  title.value = '修改申请用户';
}

function submitForm() {
  userFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) {
      return;
    }
    normalizeUserForm();
    if (form.value.id !== undefined) {
      await updateUser(form.value);
      proxy?.$modal.msgSuccess('修改成功');
    } else {
      await addUser(form.value);
      proxy?.$modal.msgSuccess('新增成功');
    }
    open.value = false;
    getList();
  });
}

function handleDelete(row?: any) {
  const userIds = row?.id || ids.value;
  proxy?.$modal
    .confirm('是否确认删除用户编号为"' + userIds + '"的数据项？')
    .then(() => delUser(userIds))
    .then(() => {
      getList();
      proxy?.$modal.msgSuccess('删除成功');
    })
    .catch(() => {});
}

function handleStatusChange(row: any, newStatus: number) {
  if (!isDataLoaded.value) {
    return;
  }
  const text = newStatus === 0 ? '启用' : '停用';
  proxy?.$modal
    .confirm('确认要"' + text + '" "' + row.username + '"用户吗?')
    .then(() => changeStatus(row.id, newStatus))
    .then(() => {
      proxy?.$modal.msgSuccess(text + '成功');
    })
    .catch(() => {
      row.status = newStatus === 0 ? 1 : 0;
    });
}

function handleResetPwd(row: any) {
  proxy
    ?.$prompt('请输入"' + row.username + '"的新密码', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      closeOnClickModal: false,
      inputPattern: /^.{6,30}$/,
      inputErrorMessage: '用户密码长度必须介于 6 和 30 之间'
    })
    .then(({ value }) => {
      resetUserPwd(row.id, value).then(() => {
        proxy?.$modal.msgSuccess('修改成功，新密码是：' + value);
      });
    })
    .catch(() => {});
}

async function handleDetail(row: any) {
  const response = await getUser(row.id);
  detail.value = response.data || {};
  detailOpen.value = true;
}

onMounted(async () => {
  await loadDeptOptions();
  deptTreeRef.value?.setCurrentKey(ALL_DEPT_ID);
  getList();
});
</script>

<style scoped lang="scss">
.ra-user-page {
  .dept-tree-card {
    min-height: 520px;
  }

  .dept-tree-title {
    font-weight: 600;
  }

  .dept-tree {
    margin-top: 12px;
  }
}
</style>
