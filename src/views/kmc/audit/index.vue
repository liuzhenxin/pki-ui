<template>
  <div class="kmc-audit-page">
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

    <el-card class="audit-table-card" shadow="hover">
      <template #header>
        <el-row :gutter="10">
          <el-col :span="1.5">
            <el-button type="primary" plain icon="Plus" @click="handleAdd">新增审计员</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList" />
        </el-row>
      </template>

      <el-table v-loading="loading" border :data="userList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column label="用户名称" align="center" prop="username" :show-overflow-tooltip="true" />
        <el-table-column label="状态" align="center" width="80">
          <template #default="scope">
            <el-switch v-model="scope.row.status" :active-value="0" :inactive-value="1" active-color="#13ce66" inactive-color="#ff4949" @change="(val) => handleStatusChange(scope.row, val)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="300" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)">修改</el-button>
            <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)">删除</el-button>
            <el-button link type="primary" icon="Key" @click="handleResetPwd(scope.row)">重置密码</el-button>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <SecurityConfirm v-model="securityConfirm.visible" :title="securityConfirm.title" :action="securityConfirm.action" @confirm="securityConfirm.onConfirm" />

    <el-dialog ref="formDialogRef" v-model="dialog.visible" :title="dialog.title" width="600px" append-to-body @close="closeDialog">
      <el-form ref="userFormRef" :model="form" :rules="rules" label-width="80px">
        <el-row>
          <el-col :span="24" style="display: none">
            <el-form-item label="归属部门" prop="deptId">
              <el-input v-model="deptName" disabled />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="用户名称" prop="username">
              <el-input v-model="form.username" placeholder="请输入用户名称" maxlength="30" :disabled="form.userId != undefined" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item v-if="form.userId == undefined" label="用户密码" prop="password">
              <el-input v-model="form.password" placeholder="请输入用户密码" type="password" maxlength="20" show-password />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="状态">
              <el-radio-group v-model="form.status">
                <el-radio :value="0">正常</el-radio>
                <el-radio :value="1">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="角色" prop="roleIds">
              <el-select v-model="form.roleIds" multiple placeholder="请选择" disabled style="width: 100%">
                <el-option label="审计员" value="305" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
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

<script setup name="KmcAudit" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance, ComponentInternalInstance, onMounted } from 'vue';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { Refresh, Search, Plus, Edit, Delete, Key } from '@element-plus/icons-vue';
import { to } from 'await-to-js';
import { listUser, getUser, addUser, updateUser, delUser, resetUserPwd, changeStatus } from '@/api/system/user';
import SecurityConfirm from '@/components/SecurityConfirm/index.vue';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const securityConfirm = reactive({
  visible: false,
  title: '敏感操作安全确认',
  action: '',
  onConfirm: () => {}
});

const userList = ref<any[]>([]);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const deptName = ref('总部 (ID: 301)');

const queryFormRef = ref<FormInstance>();
const userFormRef = ref<FormInstance>();

const dialog = reactive({
  visible: false,
  title: ''
});

const initFormData = {
  userId: undefined as string | number | undefined,
  deptId: 301,
  username: '',
  password: '',
  status: 0,
  roleIds: ['305']
};

const data = reactive({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    username: '',
    status: '',
    roleId: '305'
  },
  rules: {
    username: [
      { required: true, message: '用户名称不能为空', trigger: 'blur' },
      { min: 2, max: 20, message: '用户名称长度必须介于 2 和 20 之间', trigger: 'blur' }
    ],
    password: [
      { required: true, message: '用户密码不能为空', trigger: 'blur' },
      { min: 5, max: 20, message: '用户密码长度必须介于 5 和 20 之间', trigger: 'blur' },
      { pattern: /^[^<>"'|\\]+$/, message: '不能包含非法字符：< > " \' \\ |', trigger: 'blur' }
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
  } catch (error) {
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

function handleSelectionChange(selection: any[]) {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
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
  reset();
  dialog.visible = true;
  dialog.title = '添加审计员';
  form.value.password = '';
  form.value.deptId = 301;
  form.value.roleIds = ['305'];
}

async function handleUpdate(row?: any) {
  reset();
  const userId = row?.id || ids.value[0];
  try {
    const { data } = await getUser(userId);
    dialog.visible = true;
    dialog.title = '修改审计员';
    Object.assign(form.value, data);
    if (data.id) {
      form.value.userId = data.id;
    }
    form.value.roleIds = ['305'];
    form.value.deptId = 301;
    form.value.password = '';
  } catch (error) {
    ElMessage.error('获取用户信息失败');
  }
}

async function submitForm() {
  userFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      form.value.deptId = 301;
      form.value.roleIds = ['305'];
      try {
        if (form.value.userId) {
          await updateUser(form.value);
        } else {
          await addUser(form.value);
        }
        proxy?.$modal.msgSuccess('操作成功');
        dialog.visible = false;
        await getList();
      } catch (error) {}
    }
  });
}

async function handleDelete(row?: any) {
  const userIds = row?.id || ids.value;
  const username = row?.username || '选中的用户';
  securityConfirm.action = `删除审计员 "${username}" (ID: ${userIds})`;
  securityConfirm.onConfirm = async () => {
    try {
      await delUser(userIds);
      await getList();
      proxy?.$modal.msgSuccess('删除成功');
    } catch (error) {}
  };
  securityConfirm.visible = true;
}

async function handleResetPwd(row: any) {
  const [err, res] = await to(
    ElMessageBox.prompt('请输入"' + row.username + '"的新密码', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      closeOnClickModal: false,
      inputPattern: /^.{5,20}$/,
      inputErrorMessage: '用户密码长度必须介于 5 和 20 之间',
      inputValidator: (value) => {
        if (/<|>|"|'|\||\\/.test(value)) {
          return '不能包含非法字符：< > " \' \\ |';
        }
      }
    })
  );

  if (!err && res) {
    securityConfirm.action = `重置用户 "${row.username}" 的密码`;
    securityConfirm.onConfirm = async () => {
      try {
        await resetUserPwd(row.id, res.value);
        proxy?.$modal.msgSuccess('修改成功，新密码是：' + res.value);
      } catch (error) {}
    };
    securityConfirm.visible = true;
  }
}

function reset() {
  form.value = { ...initFormData };
  userFormRef.value?.resetFields();
}

function cancel() {
  dialog.visible = false;
  reset();
}

function closeDialog() {
  dialog.visible = false;
  resetForm();
}

function resetForm() {
  userFormRef.value?.resetFields();
  userFormRef.value?.clearValidate();
  form.value.userId = undefined;
  form.value.status = 0;
}

onMounted(() => {
  getList();
});
</script>

<style scoped lang="scss">
.kmc-audit-page {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 16px;

  .mb-16px {
    margin-bottom: 16px;
  }

  .small-padding {
    .cell {
      padding: 0 4px;
    }
  }

  :deep(.el-table) {
    width: 100%;
  }

  .audit-table-card {
    width: 100%;
    min-width: 0;
  }

  :deep(.el-card__body) {
    width: 100%;
    box-sizing: border-box;
    overflow-x: auto;
  }

  .fixed-width {
    min-width: 300px;
  }
}
</style>
