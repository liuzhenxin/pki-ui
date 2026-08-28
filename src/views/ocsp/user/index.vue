<template>
  <div class="ocsp-user-page">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-16px">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="用户名称" prop="username">
              <el-input v-model="queryParams.username" placeholder="请输入用户名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="状态" prop="status">
              <el-select v-model="queryParams.status" placeholder="用户状态" clearable>
                <el-option label="正常" value="0" />
                <el-option label="停用" value="1" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
              <el-button icon="Refresh" @click="resetQuery">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </transition>

    <el-card class="user-table-card" shadow="hover">
      <template #header>
        <el-row :gutter="10">
          <el-col :span="1.5">
            <el-button v-hasPermi="['sys:user:save']" type="primary" plain icon="Plus" @click="handleAdd">新增用户</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList" />
        </el-row>
      </template>

      <el-table v-loading="loading" border :data="userList">
        <el-table-column label="用户名称" align="center" prop="username" :show-overflow-tooltip="true" />
        <el-table-column label="状态" align="center" width="80">
          <template #default="scope">
            <el-switch
              v-model="scope.row.status"
              :active-value="0"
              :inactive-value="1"
              active-color="#13ce66"
              inactive-color="#ff4949"
              @change="(val) => handleStatusChange(scope.row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="300">
          <template #default="scope">
            <el-button v-hasPermi="['sys:user:modify']" link type="primary" icon="Edit" @click="handleUpdate(scope.row)">修改</el-button>
            <el-button v-hasPermi="['sys:user:remove']" link type="primary" icon="Delete" @click="handleDelete(scope.row)">删除</el-button>
            <el-button v-hasPermi="['sys:user:modify']" link type="primary" icon="Key" @click="handleResetPwd(scope.row)">重置密码</el-button>
          </template>
        </el-table-column>
      </el-table>
      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <SecurityConfirm v-model="securityConfirm.visible" :title="securityConfirm.title" :action="securityConfirm.action" @confirm="securityConfirm.onConfirm" />

    <el-dialog v-model="dialog.visible" :title="dialog.title" width="600px" append-to-body>
      <el-form ref="userFormRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户名称" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名称" maxlength="30" :disabled="form.userId != undefined" />
        </el-form-item>
        <el-form-item v-if="form.userId == undefined" label="用户密码" prop="password">
          <el-input v-model="form.password" placeholder="请输入用户密码" type="password" maxlength="20" show-password />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="0">正常</el-radio>
            <el-radio :value="1">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="角色" prop="roleIds">
          <el-select v-model="form.roleIds" multiple placeholder="请选择 601 或 602" style="width: 100%">
            <el-option label="安全管理员" :value="601" />
            <el-option label="审计管理员" :value="602" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="submitForm">确 定</el-button>
        <el-button @click="dialog.visible = false">取 消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="OcspUser" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance, ComponentInternalInstance, onMounted } from 'vue';
import { ElMessage, ElMessageBox, FormInstance } from 'element-plus';
import { to } from 'await-to-js';
import { listUser, getUser, addUser, updateUser, delUser, resetUserPwd, changeStatus } from '@/api/system/user';
import SecurityConfirm from '@/components/SecurityConfirm/index.vue';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const OCSP_DEPT_ID = 601;
const ALLOWED_ROLES = [601, 602];

const securityConfirm = reactive({
  visible: false,
  title: '敏感操作安全确认',
  action: '',
  onConfirm: () => {}
});

const userList = ref<any[]>([]);
const loading = ref(true);
const showSearch = ref(true);
const total = ref(0);
const queryFormRef = ref<FormInstance>();
const userFormRef = ref<FormInstance>();
const dialog = reactive({ visible: false, title: '' });

const initFormData = {
  userId: undefined as string | number | undefined,
  deptId: OCSP_DEPT_ID,
  username: '',
  password: '',
  status: 0,
  roleIds: [601]
};

const data = reactive({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    username: '',
    status: '',
    deptId: OCSP_DEPT_ID
  },
  rules: {
    username: [
      { required: true, message: '用户名称不能为空', trigger: 'blur' },
      { min: 2, max: 20, message: '用户名称长度必须介于 2 和 20 之间', trigger: 'blur' }
    ],
    password: [
      { required: true, message: '用户密码不能为空', trigger: 'blur' },
      { min: 5, max: 20, message: '用户密码长度必须介于 5 和 20 之间', trigger: 'blur' }
    ],
    roleIds: [{ required: true, message: '用户角色不能为空', trigger: 'blur' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

async function getList() {
  loading.value = true;
  try {
    const res = await listUser(queryParams.value);
    userList.value = res.data.rows || res.data.records || [];
    total.value = res.data.total || 0;
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryFormRef.value?.resetFields();
  handleQuery();
}

async function handleStatusChange(row: any, newStatus: number) {
  const text = newStatus === 0 ? '启用' : '停用';
  try {
    await proxy?.$modal.confirm('确认要"' + text + '""' + row.username + '"用户吗?');
    await changeStatus(row.id, newStatus);
    proxy?.$modal.msgSuccess(text + '成功');
  } catch (err) {
    row.status = newStatus === 0 ? 1 : 0;
  }
}

function handleAdd() {
  form.value = { ...initFormData, roleIds: [601] };
  dialog.visible = true;
  dialog.title = '新增用户';
}

async function handleUpdate(row?: any) {
  const userId = row?.id;
  const { data: user } = await getUser(userId);
  dialog.visible = true;
  dialog.title = '修改用户';
  Object.assign(form.value, user);
  form.value.userId = user.id;
  form.value.deptId = OCSP_DEPT_ID;
  form.value.password = '';
  const rawRoles = (user.roleIds || []).map((id: any) => Number(id));
  form.value.roleIds = rawRoles.filter((id: number) => ALLOWED_ROLES.includes(id));
}

async function submitForm() {
  const valid = await userFormRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }
  const roleIds = (form.value.roleIds || []).map((id: any) => Number(id));
  if (roleIds.some((id) => !ALLOWED_ROLES.includes(id))) {
    ElMessage.error('新建用户只能绑定安全管理员或审计管理员');
    return;
  }
  form.value.deptId = OCSP_DEPT_ID;
  form.value.roleIds = roleIds;
  if (form.value.userId) {
    await updateUser(form.value);
  } else {
    await addUser(form.value);
  }
  ElMessage.success('操作成功');
  dialog.visible = false;
  await getList();
}

async function handleDelete(row?: any) {
  securityConfirm.action = `删除用户 "${row.username}"`;
  securityConfirm.onConfirm = async () => {
    await delUser(row.id);
    await getList();
    proxy?.$modal.msgSuccess('删除成功');
  };
  securityConfirm.visible = true;
}

async function handleResetPwd(row: any) {
  const [err, res] = await to(
    ElMessageBox.prompt('请输入"' + row.username + '"的新密码', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /^.{5,20}$/,
      inputErrorMessage: '用户密码长度必须介于 5 和 20 之间'
    })
  );
  if (!err && res) {
    securityConfirm.action = `重置用户 "${row.username}" 的密码`;
    securityConfirm.onConfirm = async () => {
      await resetUserPwd(row.id, res.value);
      proxy?.$modal.msgSuccess('修改成功，新密码是：' + res.value);
    };
    securityConfirm.visible = true;
  }
}

onMounted(getList);
</script>

<style scoped lang="scss">
.ocsp-user-page {
  padding: 16px;
  .mb-16px {
    margin-bottom: 16px;
  }
}
</style>
